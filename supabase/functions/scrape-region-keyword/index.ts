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
  session_id: string;
  region: string;
  keyword: string;
  user_id: string;
  max_results_per_city?: number;
  use_google_maps?: boolean;
}

// ─── SECURITY: Rate Limiter con Token Bucket ─────────────────────────────────

class TokenBucketLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly rate: number;
  private readonly capacity: number;

  constructor(rate: number, capacity: number) {
    this.rate = rate;
    this.capacity = capacity;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  async acquire(tokens: number = 1, timeoutMs: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      this.refill();
      
      if (this.tokens >= tokens) {
        this.tokens -= tokens;
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error("Timeout acquisizione token");
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.rate);
    this.lastRefill = now;
  }
}

const globalRateLimiter = new TokenBucketLimiter(2.0, 5);

// ─── SECURITY: Circuit Breaker ───────────────────────────────────────────────

enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open"
}

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number | null = null;
  
  constructor(
    private readonly failureThreshold: number = 5,
    private readonly recoveryTimeoutMs: number = 60000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.recoveryTimeoutMs) {
        console.log("Circuit Breaker: passaggio a HALF_OPEN");
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error("Circuit Breaker: servizio temporaneamente non disponibile");
      }
    }

    try {
      const result = await fn();
      if (this.state === CircuitState.HALF_OPEN) {
        console.log("Circuit Breaker: successo, chiusura circuito");
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
      }
      return result;
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.failureThreshold) {
        console.error(`Circuit Breaker: soglia raggiunta (${this.failureThreshold}), apertura circuito`);
        this.state = CircuitState.OPEN;
      }
      throw error;
    }
  }
}

const googleMapsCircuitBreaker = new CircuitBreaker(3, 30000);

// ─── GEO: Recupero Città da Regione ──────────────────────────────────────────

async function fetchCitiesForRegion(region: string): Promise<string[]> {
  // Dataset statico delle principali città italiane per regione
  const italianCities: Record<string, string[]> = {
    "lombardia": ["Milano", "Bergamo", "Brescia", "Como", "Cremona", "Lecco", "Lodi", "Mantova", "Monza", "Pavia", "Sondrio", "Varese"],
    "lazio": ["Roma", "Latina", "Frosinone", "Rieti", "Viterbo", "Tivoli", "Civitavecchia", "Anzio", "Velletri", "Albano Laziale"],
    "campania": ["Napoli", "Salerno", "Caserta", "Avellino", "Benevento", "Torre del Greco", "Giugliano in Campania", "Castellammare di Stabia"],
    "sicilia": ["Palermo", "Catania", "Messina", "Siracusa", "Trapani", "Ragusa", "Agrigento", "Caltanissetta", "Enna"],
    "veneto": ["Venezia", "Verona", "Padova", "Vicenza", "Treviso", "Rovigo", "Belluno", "Chioggia", "Bassano del Grappa"],
    "piemonte": ["Torino", "Novara", "Alessandria", "Asti", "Cuneo", "Biella", "Vercelli", "Verbano-Cusio-Ossola"],
    "emilia-romagna": ["Bologna", "Modena", "Parma", "Reggio Emilia", "Ferrara", "Ravenna", "Rimini", "Piacenza", "Forlì", "Cesena"],
    "puglia": ["Bari", "Lecce", "Taranto", "Foggia", "Brindisi", "Barletta", "Andria", "Trani", "Altamura"],
    "toscana": ["Firenze", "Pisa", "Livorno", "Arezzo", "Siena", "Grosseto", "Prato", "Pistoia", "Massa", "Carrara", "Lucca"],
    "calabria": ["Reggio Calabria", "Catanzaro", "Cosenza", "Crotone", "Vibo Valentia", "Lamezia Terme"],
    "liguria": ["Genova", "La Spezia", "Savona", "Imperia", "Sanremo", "Rapallo"],
    "marche": ["Ancona", "Pesaro", "Urbino", "Macerata", "Ascoli Piceno", "Fermo", "Civitanova Marche"],
    "abruzzo": ["L'Aquila", "Pescara", "Chieti", "Teramo", "Avezzano", "Lanciano"],
    "umbria": ["Perugia", "Terni", "Assisi", "Spoleto", "Orvieto", "Foligno"],
    "basilicata": ["Potenza", "Matera", "Pisticci", "Melfi", "Lauria"],
    "molise": ["Campobasso", "Isernia", "Termoli", "Venafro"],
    "valle-d-aosta": ["Aosta", "Courmayeur", "Saint-Vincent"],
    "sardegna": ["Cagliari", "Sassari", "Nuoro", "Oristano", "Olbia", "Alghero", "Carbonia", "Iglesias"]
  };

  const regionKey = region.toLowerCase().trim();
  
  // Cerca corrispondenza esatta o parziale
  for (const [key, cities] of Object.entries(italianCities)) {
    if (key.includes(regionKey) || regionKey.includes(key)) {
      return cities;
    }
  }
  
  // Fallback: usa Nominatim per trovare città della regione
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(region)}&countrycodes=it&limit=50`;
    const res = await fetch(url, { 
      headers: { "User-Agent": "BuzzFinderBot/1.0" },
      signal: AbortSignal.timeout(8000)
    });
    
    if (!res.ok) return [];
    const data = await res.json();
    
    // Filtra solo le città (non province o regioni)
    const cities = data
      .filter((item: any) => item.type === 'city' || item.type === 'town' || item.type === 'village')
      .map((item: any) => item.name)
      .slice(0, 30); // Limite di sicurezza
    
    return cities.length > 0 ? cities : italianCities["lombardia"] || [];
  } catch (err) {
    console.error("Errore nel recupero città:", err);
    return italianCities["lombardia"] || []; // Fallback sicuro
  }
}

// ─── GOOGLE MAPS SCRAPER ─────────────────────────────────────────────────────

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  rating?: number;
  user_ratings_total?: number;
  types?: string[];
}

async function scrapeCityWithKeyword(
  city: string,
  keyword: string,
  apiKey: string,
  supabase: any,
  session: any,
  maxResults: number
): Promise<{ imported: number; found: number }> {
  const query = `${keyword} a ${city}`;
  const placesUrl = new URL("https://maps.googleapis.com/maps/api/place/textsearch/json");
  placesUrl.searchParams.set("query", query);
  placesUrl.searchParams.set("key", apiKey);
  placesUrl.searchParams.set("language", "it");
  placesUrl.searchParams.set("maxresults", "20");

  let totalFound = 0;
  let totalImported = 0;
  let nextPageToken: string | null = null;
  let attempts = 0;

  while (totalImported < maxResults && attempts < 3) {
    try {
      await globalRateLimiter.acquire(1, 10000);
      
      const urlWithToken = nextPageToken ? `${placesUrl.toString()}&pagetoken=${nextPageToken}` : placesUrl.toString();
      
      const placesData = await googleMapsCircuitBreaker.execute(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(urlWithToken, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.json();
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      });

      if (!["OK", "ZERO_RESULTS"].includes(placesData.status)) {
        if (placesData.status === "INVALID_REQUEST" && nextPageToken) {
          attempts++;
          nextPageToken = null;
          continue;
        }
        console.warn(`Google API status: ${placesData.status} per ${city}`);
        break;
      }

      const places: PlaceResult[] = placesData.results || [];
      if (places.length === 0) break;

      totalFound += places.length;

      // Deduplicazione
      const pids = places.map(p => p.place_id);
      const { data: existing } = await supabase.from("contacts")
        .select("google_maps_place_id")
        .in("google_maps_place_id", pids.length ? pids : ["__none__"])
        .eq("user_id", session.user_id);
      
      const existSet = new Set((existing || []).map((c: any) => c.google_maps_place_id));
      const newPlaces = places.filter(p => !existSet.has(p.place_id));

      // Fetch details e inserimento
      for (let i = 0; i < newPlaces.length && totalImported < maxResults; i += 5) {
        const batch = newPlaces.slice(i, i + 5);
        
        const details = await Promise.all(batch.map(async (p) => {
          await globalRateLimiter.acquire(1, 10000);
          return googleMapsCircuitBreaker.execute(async () => {
            const detailUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
            detailUrl.searchParams.set("place_id", p.place_id);
            detailUrl.searchParams.set("key", apiKey);
            detailUrl.searchParams.set("fields", "formatted_phone_number,international_phone_number,website,address_components");
            const res = await fetch(detailUrl.toString());
            const data = await res.json();
            return data.result || {};
          });
        }));

        for (let j = 0; j < batch.length && totalImported < maxResults; j++) {
          const p = batch[j];
          const d = details[j];
          
          const website = d.website || null;
          const phone = d.international_phone_number || d.formatted_phone_number || null;
          
          const ac = d.address_components || [];
          let provincia = "", cap = "", regione = "";
          for (const c of ac) {
            if (c.types?.includes("administrative_area_level_2")) provincia = c.short_name;
            if (c.types?.includes("administrative_area_level_1")) regione = c.long_name;
            if (c.types?.includes("postal_code")) cap = c.long_name;
          }
          
          let telNorm: string | null = null;
          if (phone) {
            telNorm = phone.replace(/[\s\-()]/g, "");
            if (!telNorm.startsWith("+")) telNorm = "+39" + telNorm;
          }

          const { error: ie } = await supabase.from("contacts").upsert({
            azienda: p.name.replace(/\s+/g, ' ').trim(),
            indirizzo: p.formatted_address || null,
            citta: city,
            provincia: provincia || null,
            cap: cap || null,
            regione: regione || null,
            telefono: phone,
            telefono_normalizzato: telNorm,
            sito_web: website,
            google_maps_place_id: p.place_id,
            google_rating: p.rating || null,
            google_reviews_count: p.user_ratings_total || null,
            google_categories: (p.types || []).filter((t: string) => !["point_of_interest", "establishment"].includes(t)),
            lat: p.geometry?.location?.lat || null,
            lng: p.geometry?.location?.lng || null,
            fonte: "google_maps_region_search",
            stato: "nuovo",
            user_id: session.user_id,
            scraping_session_id: session.session_id,
          }, { onConflict: "google_maps_place_id,user_id" });

          if (!ie) totalImported++;
        }
      }

      nextPageToken = placesData.next_page_token || null;
      attempts = 0; // Reset on success
      
      if (!nextPageToken) break;
      await new Promise(r => setTimeout(r, 2000)); // Delay per page token

    } catch (err) {
      attempts++;
      console.error(`Errore scraping ${city}:`, err instanceof Error ? err.message : String(err));
      if (attempts >= 3) break;
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return { found: totalFound, imported: totalImported };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body: RequestBody = await req.json();
    const { session_id, region, keyword, user_id, max_results_per_city = 20, use_google_maps = true } = body;

    if (!session_id || !region || !keyword || !user_id) {
      return ok({ error: "session_id, region, keyword e user_id sono obbligatori" });
    }

    const { data: session } = await supabase
      .from("scraping_sessions")
      .select("status, user_id, totale_trovati, totale_importati")
      .eq("id", session_id)
      .single();
    
    if (!session) return ok({ error: "Sessione non trovata" });
    if (["paused", "completed", "failed"].includes(session.status)) {
      return ok({ aborted: true, reason: session.status });
    }

    // Inizializza sessione
    await supabase.from("scraping_sessions")
      .update({ status: "running", started_at: new Date().toISOString(), progress_percent: 0 })
      .eq("id", session_id);

    // Recupera API Key
    const { data: apiKeySetting } = await supabase
      .from("app_settings")
      .select("valore")
      .eq("chiave", "google_maps_api_key")
      .eq("user_id", user_id)
      .maybeSingle();

    const apiKey = apiKeySetting?.valore;
    if (!apiKey && use_google_maps) {
      const msg = "Google Maps API Key non configurata";
      await supabase.from("scraping_sessions")
        .update({ status: "failed", error_message: msg })
        .eq("id", session_id);
      return ok({ error: msg });
    }

    // Fase 1: Recupera città
    console.log(`Recupero città per regione: ${region}`);
    const cities = await fetchCitiesForRegion(region);
    
    if (cities.length === 0) {
      const msg = `Nessuna città trovata per la regione: ${region}`;
      await supabase.from("scraping_sessions")
        .update({ status: "failed", error_message: msg })
        .eq("id", session_id);
      return ok({ error: msg });
    }

    console.log(`Trovate ${cities.length} città per ${region}`);

    // Fase 2: Itera su ogni città
    let totalFound = session.totale_trovati || 0;
    let totalImported = session.totale_importati || 0;
    const totalCities = cities.length;
    let processedCities = 0;

    for (const city of cities) {
      try {
        console.log(`Scraping: "${keyword}" a ${city}`);
        
        const result = await scrapeCityWithKeyword(
          city,
          keyword,
          apiKey || "",
          supabase,
          { session_id, user_id },
          max_results_per_city
        );

        totalFound += result.found;
        totalImported += result.imported;
        processedCities++;

        // Aggiorna progresso basato sulle città elaborate
        const progress = Math.round((processedCities / totalCities) * 100);
        
        await supabase.from("scraping_sessions").update({
          totale_trovati: totalFound,
          totale_importati: totalImported,
          progress_percent: progress,
          updated_at: new Date().toISOString()
        }).eq("id", session_id);

        // Check timeout globale (55 secondi)
        if (Date.now() - new Date(session.started_at || Date.now()).getTime() > 55000) {
          console.warn("Timeout globale raggiunto");
          break;
        }

      } catch (err) {
        console.error(`Errore nella città ${city}:`, err);
        // Continua con la prossima città invece di fallire tutto
        processedCities++;
      }
    }

    // Completa sessione
    await supabase.from("scraping_sessions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      progress_percent: 100,
      totale_trovati: totalFound,
      totale_importati: totalImported
    }).eq("id", session_id);

    return ok({
      done: true,
      cities_processed: processedCities,
      total_found: totalFound,
      total_imported: totalImported
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    console.error("scrape-region-keyword error:", msg);
    
    // Tenta di aggiornare lo stato della sessione
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const body: RequestBody = await req.json();
      await supabase.from("scraping_sessions")
        .update({ status: "failed", error_message: msg.substring(0, 500) })
        .eq("id", body.session_id);
    } catch {}
    
    return ok({ error: msg });
  }
});
