import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  session_id: string;
  query: string;
  citta: string;
  raggio_km: number;
  max_results: number;
  next_page_token?: string;
  filtri?: {
    solo_con_sito?: boolean;
    solo_con_telefono?: boolean;
    rating_min?: number;
    recensioni_min?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body: RequestBody = await req.json();
    const { session_id, query, citta, raggio_km, max_results, next_page_token, filtri } = body;

    if (!session_id || !query || !citta) {
      return new Response(
        JSON.stringify({ error: "session_id, query e citta sono obbligatori" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check session status (abort if paused/stopped/completed)
    const { data: session } = await supabase
      .from("scraping_sessions")
      .select("status, user_id")
      .eq("id", session_id)
      .single();

    if (!session) {
      return new Response(
        JSON.stringify({ error: "Sessione non trovata" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (["paused", "completed", "failed"].includes(session.status)) {
      return new Response(
        JSON.stringify({ aborted: true, reason: session.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update session to running if pending
    if (session.status === "pending") {
      await supabase
        .from("scraping_sessions")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", session_id);
    }

    // Get Google Maps API key from app_settings (filtered by user_id)
    const { data: apiKeySetting } = await supabase
      .from("app_settings")
      .select("valore")
      .eq("chiave", "google_maps_api_key")
      .eq("user_id", session.user_id)
      .maybeSingle();

    const apiKey = apiKeySetting?.valore;
    if (!apiKey) {
      await supabase
        .from("scraping_sessions")
        .update({ status: "failed", error_message: "Google Maps API Key non configurata in Impostazioni" })
        .eq("id", session_id);
      return new Response(
        JSON.stringify({ error: "Google Maps API Key non configurata. Vai in Impostazioni → API Keys." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build Google Places Text Search request
    const searchQuery = `${query} ${citta}`;
    const placesUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
    placesUrl.searchParams.set("query", searchQuery);
    placesUrl.searchParams.set("key", apiKey);
    placesUrl.searchParams.set("language", "it");
    placesUrl.searchParams.set("radius", String(raggio_km * 1000));
    if (next_page_token) {
      placesUrl.searchParams.set("pagetoken", next_page_token);
    }

    const placesRes = await fetch(placesUrl.toString());
    const placesData = await placesRes.json();

    if (placesData.status === "INVALID_REQUEST" && next_page_token) {
      // Page token not yet valid, retry after delay
      return new Response(
        JSON.stringify({ done: false, next_page_token, total_importati: 0, retry: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["OK", "ZERO_RESULTS"].includes(placesData.status)) {
      const errMsg = `Google Places API error: ${placesData.status} — ${placesData.error_message || ""}`;
      await supabase
        .from("scraping_sessions")
        .update({ status: "failed", error_message: errMsg })
        .eq("id", session_id);
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const places = placesData.results || [];
    let importedCount = 0;
    const soloConSito = filtri?.solo_con_sito ?? false;
    const soloConTelefono = filtri?.solo_con_telefono ?? false;
    const ratingMin = filtri?.rating_min ?? 0;
    const recensioniMin = filtri?.recensioni_min ?? 0;

    // Get current totals
    const { data: currentSession } = await supabase
      .from("scraping_sessions")
      .select("totale_trovati, totale_importati")
      .eq("id", session_id)
      .single();

    let totaleTrovati = currentSession?.totale_trovati ?? 0;
    let totaleImportati = currentSession?.totale_importati ?? 0;

    for (const place of places) {
      // Check if max_results reached
      if (totaleImportati >= max_results) break;

      totaleTrovati++;

      // Skip permanently closed
      if (place.permanently_closed) continue;

      // Get place details for phone/website
      const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      detailsUrl.searchParams.set("place_id", place.place_id);
      detailsUrl.searchParams.set("key", apiKey);
      detailsUrl.searchParams.set("fields", "formatted_phone_number,international_phone_number,website,url,address_components,types");
      detailsUrl.searchParams.set("language", "it");

      const detailsRes = await fetch(detailsUrl.toString());
      const detailsData = await detailsRes.json();
      const details = detailsData.result || {};

      const website = details.website || null;
      const phone = details.international_phone_number || details.formatted_phone_number || null;
      const rating = place.rating ?? 0;
      const reviewsCount = place.user_ratings_total ?? 0;

      // Apply filters
      if (soloConSito && !website) continue;
      if (soloConTelefono && !phone) continue;
      if (ratingMin > 0 && rating < ratingMin) continue;
      if (recensioniMin > 0 && reviewsCount < recensioniMin) continue;

      // Check for duplicates by place_id
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("google_maps_place_id", place.place_id)
        .eq("user_id", session.user_id)
        .maybeSingle();

      if (existing) continue;

      // Extract address components
      const addressComponents = details.address_components || [];
      let provincia = "";
      let cap = "";
      let regione = "";
      for (const comp of addressComponents) {
        if (comp.types?.includes("administrative_area_level_2")) provincia = comp.short_name;
        if (comp.types?.includes("administrative_area_level_1")) regione = comp.long_name;
        if (comp.types?.includes("postal_code")) cap = comp.long_name;
      }

      // Normalize phone
      let telefonoNormalizzato: string | null = null;
      if (phone) {
        telefonoNormalizzato = phone.replace(/[\s\-()]/g, "");
        if (!telefonoNormalizzato.startsWith("+")) {
          telefonoNormalizzato = "+39" + telefonoNormalizzato;
        }
      }

      // Extract categories from types
      const categories = (place.types || []).filter(
        (t: string) => !["point_of_interest", "establishment"].includes(t)
      );

      const contact = {
        azienda: place.name,
        indirizzo: place.formatted_address || null,
        citta: citta,
        provincia: provincia || null,
        cap: cap || null,
        regione: regione || null,
        telefono: phone,
        telefono_normalizzato: telefonoNormalizzato,
        sito_web: website,
        google_maps_place_id: place.place_id,
        google_rating: rating || null,
        google_reviews_count: reviewsCount || null,
        google_categories: categories,
        lat: place.geometry?.location?.lat || null,
        lng: place.geometry?.location?.lng || null,
        fonte: "google_maps",
        stato: "nuovo",
        user_id: session.user_id,
        scraping_session_id: session_id,
      };

      const { error: insertErr } = await supabase.from("contacts").insert(contact);
      if (!insertErr) {
        importedCount++;
        totaleImportati++;
      }
    }

    // Update session counters
    const isDone = !placesData.next_page_token || totaleImportati >= max_results;
    const progressPercent = max_results > 0 ? Math.min(100, Math.round((totaleImportati / max_results) * 100)) : 0;

    const sessionUpdate: Record<string, unknown> = {
      totale_trovati: totaleTrovati,
      totale_importati: totaleImportati,
      progress_percent: progressPercent,
    };

    if (isDone) {
      sessionUpdate.status = "completed";
      sessionUpdate.completed_at = new Date().toISOString();
    }

    await supabase
      .from("scraping_sessions")
      .update(sessionUpdate)
      .eq("id", session_id);

    return new Response(
      JSON.stringify({
        done: isDone,
        next_page_token: isDone ? null : placesData.next_page_token,
        total_importati: totaleImportati,
        imported_this_page: importedCount,
        total_trovati: totaleTrovati,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("scrape-maps-page error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
