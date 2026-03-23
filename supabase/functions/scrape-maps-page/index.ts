import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface RequestBody {
  provider?: "google_maps" | "openstreetmap";
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

// ─── GOOGLE MAPS ─────────────────────────────────────────────────────────────

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
  permanently_closed?: boolean;
}

async function fetchPlaceDetails(placeId: string, apiKey: string) {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("fields", "formatted_phone_number,international_phone_number,website,url,address_components");
  url.searchParams.set("language", "it");
  const res = await fetch(url.toString());
  const data = await res.json();
  return data.result || {};
}

function preFilterPlace(p: PlaceResult, rMin: number, recMin: number): boolean {
  if (p.permanently_closed) return false;
  if (rMin > 0 && (p.rating ?? 0) < rMin) return false;
  if (recMin > 0 && (p.user_ratings_total ?? 0) < recMin) return false;
  return true;
}

// deno-lint-ignore no-explicit-any
async function scrapeGoogleMaps(body: RequestBody, supabase: any, session: any) {
  const { session_id, query, citta, raggio_km, max_results, next_page_token, filtri } = body;

  const { data: apiKeySetting } = await supabase
    .from("app_settings").select("valore")
    .eq("chiave", "google_maps_api_key").eq("user_id", session.user_id).maybeSingle();

  const apiKey = apiKeySetting?.valore;
  if (!apiKey) {
    const msg = "Google Maps API Key non configurata. Vai in Impostazioni → API Keys.";
    await supabase.from("scraping_sessions").update({ status: "failed", error_message: msg }).eq("id", session_id);
    return ok({ error: msg });
  }

  const placesUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  placesUrl.searchParams.set("query", `${query} ${citta}`);
  placesUrl.searchParams.set("key", apiKey);
  placesUrl.searchParams.set("language", "it");
  placesUrl.searchParams.set("radius", String(raggio_km * 1000));
  if (next_page_token) placesUrl.searchParams.set("pagetoken", next_page_token);

  const placesRes = await fetch(placesUrl.toString());
  const placesData = await placesRes.json();

  if (placesData.status === "INVALID_REQUEST" && next_page_token) {
    return ok({ done: false, next_page_token, total_importati: 0, retry: true });
  }
  if (!["OK", "ZERO_RESULTS"].includes(placesData.status)) {
    const msg = `Google Places API error: ${placesData.status} — ${placesData.error_message || ""}`;
    await supabase.from("scraping_sessions").update({ status: "failed", error_message: msg }).eq("id", session_id);
    return ok({ error: msg });
  }

  const places: PlaceResult[] = placesData.results || [];
  const soloConSito = filtri?.solo_con_sito ?? false;
  const soloConTelefono = filtri?.solo_con_telefono ?? false;
  const rMin = filtri?.rating_min ?? 0;
  const recMin = filtri?.recensioni_min ?? 0;

  const { data: cur } = await supabase.from("scraping_sessions")
    .select("totale_trovati, totale_importati").eq("id", session_id).single();
  let totaleTrovati = cur?.totale_trovati ?? 0;
  let totaleImportati = cur?.totale_importati ?? 0;
  let importedCount = 0;

  const candidates: PlaceResult[] = [];
  for (const p of places) {
    if (totaleImportati + candidates.length >= max_results) break;
    totaleTrovati++;
    if (preFilterPlace(p, rMin, recMin)) candidates.push(p);
  }

  const pids = candidates.map((p) => p.place_id);
  const { data: existing } = await supabase.from("contacts").select("google_maps_place_id")
    .in("google_maps_place_id", pids.length ? pids : ["__none__"]).eq("user_id", session.user_id);
  // deno-lint-ignore no-explicit-any
  const existSet = new Set((existing || []).map((c: any) => c.google_maps_place_id));
  const newC = candidates.filter((p) => !existSet.has(p.place_id));

  for (let i = 0; i < newC.length; i += 5) {
    if (totaleImportati >= max_results) break;
    const batch = newC.slice(i, i + 5);
    const details = await Promise.all(batch.map((p) => fetchPlaceDetails(p.place_id, apiKey)));
    for (let j = 0; j < batch.length; j++) {
      if (totaleImportati >= max_results) break;
      const p = batch[j]; const d = details[j];
      const website = d.website || null;
      const phone = d.international_phone_number || d.formatted_phone_number || null;
      if (soloConSito && !website) continue;
      if (soloConTelefono && !phone) continue;
      const ac = d.address_components || [];
      let provincia = "", cap = "", regione = "";
      for (const c of ac) {
        if (c.types?.includes("administrative_area_level_2")) provincia = c.short_name;
        if (c.types?.includes("administrative_area_level_1")) regione = c.long_name;
        if (c.types?.includes("postal_code")) cap = c.long_name;
      }
      let telNorm: string | null = null;
      if (phone) { telNorm = phone.replace(/[\s\-()]/g, ""); if (!telNorm.startsWith("+")) telNorm = "+39" + telNorm; }
      const { error: ie } = await supabase.from("contacts").insert({
        azienda: p.name, indirizzo: p.formatted_address || null,
        citta, provincia: provincia || null, cap: cap || null, regione: regione || null,
        telefono: phone, telefono_normalizzato: telNorm, sito_web: website,
        google_maps_place_id: p.place_id, google_rating: p.rating || null,
        google_reviews_count: p.user_ratings_total || null,
        google_categories: (p.types || []).filter((t: string) => !["point_of_interest", "establishment"].includes(t)),
        lat: p.geometry?.location?.lat || null, lng: p.geometry?.location?.lng || null,
        fonte: "google_maps", stato: "nuovo", user_id: session.user_id, scraping_session_id: session_id,
      });
      if (!ie) { importedCount++; totaleImportati++; }
    }
  }

  const isDone = !placesData.next_page_token || totaleImportati >= max_results;
  const pct = max_results > 0 ? Math.min(100, Math.round((totaleImportati / max_results) * 100)) : 0;
  const upd: Record<string, unknown> = { totale_trovati: totaleTrovati, totale_importati: totaleImportati, progress_percent: pct };
  if (isDone) { upd.status = "completed"; upd.completed_at = new Date().toISOString(); }
  await supabase.from("scraping_sessions").update(upd).eq("id", session_id);
  return ok({ done: isDone, next_page_token: isDone ? null : placesData.next_page_token, total_importati: totaleImportati, imported_this_page: importedCount, total_trovati: totaleTrovati });
}

// ─── OPENSTREETMAP ────────────────────────────────────────────────────────────

function escapeOSM(s: string) { return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }

// deno-lint-ignore no-explicit-any
async function scrapeOpenStreetMap(body: RequestBody, supabase: any, session: any) {
  const { session_id, query, citta, raggio_km, max_results, filtri } = body;
  const soloConSito = filtri?.solo_con_sito ?? false;
  const soloConTelefono = filtri?.solo_con_telefono ?? false;

  // 1. Nominatim geocoding (8s timeout)
  const nomRes = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(citta + " Italy")}&format=json&limit=1&countrycodes=it`,
    { headers: { "User-Agent": "BuzzFinderBot/1.0" }, signal: AbortSignal.timeout(8000) }
  );
  if (!nomRes.ok) {
    const msg = `Nominatim error ${nomRes.status}`;
    await supabase.from("scraping_sessions").update({ status: "failed", error_message: msg }).eq("id", session_id);
    return ok({ error: msg });
  }
  const nomData = await nomRes.json();
  if (!nomData?.length) {
    const msg = `Città "${citta}" non trovata in OpenStreetMap`;
    await supabase.from("scraping_sessions").update({ status: "failed", error_message: msg }).eq("id", session_id);
    return ok({ error: msg });
  }

  const lat = parseFloat(nomData[0].lat);
  const lon = parseFloat(nomData[0].lon);
  const r = raggio_km * 1000;
  const sq = escapeOSM(query);
  // cap at 300 results per call to stay within 30s edge function limit
  const lim = Math.min(max_results, 300);
  const q = `[out:json][timeout:20];(nwr["name"~"${sq}",i](around:${r},${lat},${lon});nwr["shop"~"${sq}",i](around:${r},${lat},${lon});nwr["craft"~"${sq}",i](around:${r},${lat},${lon});nwr["office"~"${sq}",i](around:${r},${lat},${lon}););out body center ${lim};`;
  const payload = `data=${encodeURIComponent(q)}`;

  // 2. Try all 3 endpoints in PARALLEL — use the first to succeed
  // deno-lint-ignore no-explicit-any
  async function tryOverpass(url: string): Promise<any> {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
      signal: AbortSignal.timeout(23000),
    });
    if (!res.ok) { const t = await res.text(); throw new Error(`${new URL(url).hostname} ${res.status}: ${t.slice(0,80)}`); }
    return res.json();
  }

  // deno-lint-ignore no-explicit-any
  let ovData: any;
  try {
    ovData = await Promise.any([
      tryOverpass("https://overpass-api.de/api/interpreter"),
      tryOverpass("https://overpass.kumi.systems/api/interpreter"),
      tryOverpass("https://lz4.overpass-api.de/api/interpreter"),
    ]);
  } catch (e) {
    const msg = `Overpass API non disponibile: ${e instanceof Error ? e.message : String(e)}`;
    await supabase.from("scraping_sessions").update({ status: "failed", error_message: msg }).eq("id", session_id);
    return ok({ error: msg });
  }

  // deno-lint-ignore no-explicit-any
  const elements: any[] = ovData.elements || [];
  const ql = query.toLowerCase();

  // In-memory filter
  // deno-lint-ignore no-explicit-any
  const candidates = elements.filter((el: any) => {
    const t = el.tags || {};
    const n: string = t.name; if (!n) return false;
    return n.toLowerCase().includes(ql) ||
      [t.shop, t.craft, t.office, t.amenity, t.tourism].filter(Boolean).some((v: string) => v.toLowerCase().includes(ql));
  }).slice(0, max_results * 2);

  // Bulk dedup (1 query)
  // deno-lint-ignore no-explicit-any
  const cNames = [...new Set(candidates.map((el: any) => el.tags?.name).filter(Boolean))];
  const { data: existingRows } = await supabase.from("contacts").select("azienda")
    .eq("citta", citta).eq("user_id", session.user_id)
    .in("azienda", cNames.length ? cNames : ["__none__"]);
  // deno-lint-ignore no-explicit-any
  const existSet = new Set((existingRows || []).map((r: any) => r.azienda));

  // Build insert list
  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  for (const el of candidates) {
    if (rows.length >= max_results) break;
    const t = el.tags || {};
    const name: string = t.name;
    if (existSet.has(name)) continue;
    const website = t.website || t["contact:website"] || t["contact:url"] || null;
    const phone = t.phone || t["contact:phone"] || t["contact:mobile"] || null;
    if (soloConSito && !website) continue;
    if (soloConTelefono && !phone) continue;
    rows.push({
      azienda: name, citta,
      indirizzo: [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ") || null,
      cap: t["addr:postcode"] || null,
      telefono: phone || null, sito_web: website, email: t.email || t["contact:email"] || null,
      lat: el.lat ?? el.center?.lat ?? null, lng: el.lon ?? el.center?.lon ?? null,
      google_categories: [t.amenity, t.shop, t.craft, t.office, t.tourism].filter(Boolean),
      fonte: "openstreetmap", stato: "nuovo",
      user_id: session.user_id, scraping_session_id: session_id,
    });
    existSet.add(name);
  }

  // Bulk insert (chunks of 100)
  let importedCount = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const { error: ie } = await supabase.from("contacts").insert(rows.slice(i, i + 100));
    if (!ie) importedCount += rows.slice(i, i + 100).length;
  }

  await supabase.from("scraping_sessions").update({
    status: "completed", completed_at: new Date().toISOString(),
    totale_trovati: elements.length, totale_importati: importedCount, progress_percent: 100,
  }).eq("id", session_id);

  return ok({ done: true, next_page_token: null, total_importati: importedCount, imported_this_page: importedCount, total_trovati: elements.length });
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body: RequestBody = await req.json();
    const { session_id, query, citta, provider = "google_maps" } = body;

    if (!session_id || !query || !citta) return ok({ error: "session_id, query e citta sono obbligatori" });

    const { data: session } = await supabase
      .from("scraping_sessions").select("status, user_id").eq("id", session_id).single();
    if (!session) return ok({ error: "Sessione non trovata" });
    if (["paused", "completed", "failed"].includes(session.status)) return ok({ aborted: true, reason: session.status });
    if (session.status === "pending") {
      await supabase.from("scraping_sessions").update({ status: "running", started_at: new Date().toISOString() }).eq("id", session_id);
    }

    return provider === "openstreetmap"
      ? scrapeOpenStreetMap(body, supabase, session)
      : scrapeGoogleMaps(body, supabase, session);

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("scrape-maps-page error:", msg);
    return ok({ error: msg });
  }
});
