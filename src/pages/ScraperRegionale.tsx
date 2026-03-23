import { useState, useRef, useCallback, useEffect } from "react";
import { Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCurrentUserId } from "@/lib/auth";

// ─── Constants ───────────────────────────────────────────────────────────────

const ITALIAN_REGIONS = [
  "Abruzzo", "Basilicata", "Calabria", "Campania", "Emilia-Romagna",
  "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardia", "Marche",
  "Molise", "Piemonte", "Puglia", "Sardegna", "Sicilia", "Toscana",
  "Trentino-Alto Adige", "Umbria", "Valle d'Aosta", "Veneto",
];

const OSM_REGION_NAMES: Record<string, string> = {
  "Friuli-Venezia Giulia": "Friuli Venezia Giulia",
  "Trentino-Alto Adige": "Trentino-Alto Adige/Südtirol",
  "Valle d'Aosta": "Valle d'Aosta / Vallée d'Aoste",
  "Emilia-Romagna": "Emilia-Romagna",
};

const OSM_TAG_MAP: Record<string, string[]> = {
  // ── Cibo & Bevande ───────────────────────────────────────────────────────
  ristorante: ['["amenity"="restaurant"]'],
  trattoria: ['["amenity"="restaurant"]'],
  osteria: ['["amenity"="restaurant"]'],
  pizzeria: ['["amenity"="restaurant"]'],
  pizze: ['["amenity"="restaurant"]'],
  sushi: ['["amenity"="restaurant"]'],
  cinese: ['["amenity"="restaurant"]'],
  giapponese: ['["amenity"="restaurant"]'],
  indiano: ['["amenity"="restaurant"]'],
  bar: ['["amenity"="bar"]', '["amenity"="cafe"]'],
  caffè: ['["amenity"="cafe"]'],
  caffe: ['["amenity"="cafe"]'],
  caffetteria: ['["amenity"="cafe"]'],
  pasticceria: ['["shop"="pastry"]'],
  gelateria: ['["shop"="ice_cream"]'],
  gelato: ['["shop"="ice_cream"]'],
  panificio: ['["shop"="bakery"]'],
  panetteria: ['["shop"="bakery"]'],
  forno: ['["shop"="bakery"]'],
  pane: ['["shop"="bakery"]'],
  alimentari: ['["shop"="convenience"]', '["shop"="supermarket"]'],
  supermercato: ['["shop"="supermarket"]'],
  macelleria: ['["shop"="butcher"]'],
  macellaio: ['["shop"="butcher"]'],
  pescheria: ['["shop"="seafood"]'],
  salumeria: ['["shop"="deli"]'],
  gastronomia: ['["shop"="deli"]'],
  enoteca: ['["shop"="wine"]'],
  vinoteca: ['["shop"="wine"]'],
  cantina: ['["craft"="winery"]', '["shop"="wine"]'],
  birrificio: ['["craft"="brewery"]'],
  ortofrutta: ['["shop"="greengrocer"]'],
  hamburgeria: ['["amenity"="fast_food"]'],
  kebab: ['["amenity"="fast_food"]'],
  piadineria: ['["amenity"="fast_food"]'],
  rosticceria: ['["amenity"="fast_food"]'],
  pub: ['["amenity"="pub"]'],
  torrefazione: ['["craft"="roaster"]'],
  // ── Alloggio ─────────────────────────────────────────────────────────────
  hotel: ['["tourism"="hotel"]'],
  albergo: ['["tourism"="hotel"]'],
  relais: ['["tourism"="hotel"]'],
  locanda: ['["tourism"="hotel"]'],
  ostello: ['["tourism"="hostel"]'],
  bnb: ['["tourism"="guest_house"]'],
  affittacamere: ['["tourism"="guest_house"]'],
  agriturismo: ['["tourism"="guest_house"]'],
  campeggio: ['["tourism"="camp_site"]'],
  residence: ['["tourism"="apartment"]'],
  // ── Sanità ───────────────────────────────────────────────────────────────
  farmacia: ['["amenity"="pharmacy"]'],
  farmacist: ['["amenity"="pharmacy"]'],
  dentista: ['["amenity"="dentist"]'],
  odontoiatr: ['["amenity"="dentist"]'],
  medico: ['["amenity"="doctors"]', '["amenity"="clinic"]'],
  clinica: ['["amenity"="clinic"]'],
  ambulatorio: ['["amenity"="clinic"]'],
  poliambulatorio: ['["amenity"="clinic"]'],
  ospedale: ['["amenity"="hospital"]'],
  veterinario: ['["amenity"="veterinary"]'],
  veterinar: ['["amenity"="veterinary"]'],
  fisioterapist: ['["healthcare"="physiotherapist"]'],
  fisioterapia: ['["healthcare"="physiotherapist"]'],
  psicologo: ['["healthcare"="psychotherapist"]'],
  psicolog: ['["healthcare"="psychotherapist"]'],
  psicoterapeut: ['["healthcare"="psychotherapist"]'],
  nutrizionist: ['["healthcare"="dietitian"]'],
  osteopat: ['["healthcare"="osteopath"]'],
  logopedist: ['["healthcare"="speech_therapist"]'],
  erboristeria: ['["shop"="herbalist"]'],
  erborist: ['["shop"="herbalist"]'],
  // ── Finanza & Legale ─────────────────────────────────────────────────────
  banca: ['["amenity"="bank"]'],
  banco: ['["amenity"="bank"]'],
  assicurazioni: ['["office"="insurance"]'],
  assicurazione: ['["office"="insurance"]'],
  avvocato: ['["office"="lawyer"]'],
  avvocati: ['["office"="lawyer"]'],
  legale: ['["office"="lawyer"]'],
  notaio: ['["office"="notary"]'],
  notai: ['["office"="notary"]'],
  commercialista: ['["office"="accountant"]'],
  consulenza: ['["office"="consulting"]'],
  consulente: ['["office"="consulting"]'],
  finanziaria: ['["office"="financial"]'],
  // ── Architettura & Ingegneria ─────────────────────────────────────────────
  geometra: ['["office"="surveyor"]'],
  geometri: ['["office"="surveyor"]'],
  architetto: ['["office"="architect"]'],
  architettura: ['["office"="architect"]'],
  ingegnere: ['["office"="engineer"]'],
  ingegneria: ['["office"="engineer"]'],
  perito: ['["office"="surveyor"]'],
  // ── Immobiliare ──────────────────────────────────────────────────────────
  immobiliare: ['["office"="estate_agent"]'],
  immobili: ['["office"="estate_agent"]'],
  // ── Edilizia & Costruzioni ────────────────────────────────────────────────
  'imprese edil': ['["craft"="construction"]'],
  'impresa edil': ['["craft"="construction"]'],
  impresa: ['["craft"="construction"]'],
  costruzioni: ['["craft"="construction"]'],
  costruttore: ['["craft"="construction"]'],
  edilizia: ['["craft"="construction"]'],
  muratore: ['["craft"="mason"]'],
  muratori: ['["craft"="mason"]'],
  ristrutturazione: ['["craft"="construction"]'],
  ristrutturazioni: ['["craft"="construction"]'],
  cartongesso: ['["craft"="construction"]'],
  ponteggi: ['["craft"="scaffolder"]'],
  ponteggio: ['["craft"="scaffolder"]'],
  demolizione: ['["craft"="demolition_contractor"]'],
  demolizioni: ['["craft"="demolition_contractor"]'],
  impermeabilizzazione: ['["craft"="waterproofer"]'],
  coibentazione: ['["craft"="insulation"]'],
  isolamento: ['["craft"="insulation"]'],
  cappotto: ['["craft"="insulation"]'],
  // ── Infissi & Serramenti ─────────────────────────────────────────────────
  infissi: ['["craft"="window_construction"]', '["shop"="doors"]'],
  infisso: ['["craft"="window_construction"]', '["shop"="doors"]'],
  serramenti: ['["craft"="window_construction"]', '["shop"="doors"]'],
  serramento: ['["craft"="window_construction"]', '["shop"="doors"]'],
  serramentist: ['["craft"="window_construction"]', '["shop"="doors"]'],
  finestre: ['["craft"="window_construction"]'],
  finestra: ['["craft"="window_construction"]'],
  porte: ['["shop"="doors"]'],
  porta: ['["shop"="doors"]'],
  portoni: ['["shop"="doors"]'],
  portone: ['["shop"="doors"]'],
  // ── Pavimenti & Rivestimenti ──────────────────────────────────────────────
  pavimenti: ['["craft"="floorer"]', '["shop"="flooring"]'],
  pavimento: ['["craft"="floorer"]', '["shop"="flooring"]'],
  parquet: ['["craft"="floorer"]'],
  piastrelle: ['["shop"="tiles"]'],
  ceramiche: ['["shop"="tiles"]'],
  ceramica: ['["shop"="tiles"]'],
  rivestimenti: ['["shop"="tiles"]', '["craft"="floorer"]'],
  mosaico: ['["shop"="tiles"]'],
  marmista: ['["craft"="stonemason"]'],
  marmo: ['["craft"="stonemason"]'],
  granito: ['["craft"="stonemason"]'],
  pietra: ['["craft"="stonemason"]'],
  // ── Coperture & Tetti ─────────────────────────────────────────────────────
  coperture: ['["craft"="roofer"]'],
  tetto: ['["craft"="roofer"]'],
  tetti: ['["craft"="roofer"]'],
  lattoniere: ['["craft"="roofer"]'],
  lattoneria: ['["craft"="roofer"]'],
  tegole: ['["craft"="roofer"]'],
  // ── Pittura & Verniciatura ────────────────────────────────────────────────
  imbianchino: ['["craft"="painter"]'],
  imbianchini: ['["craft"="painter"]'],
  pittore: ['["craft"="painter"]'],
  pittori: ['["craft"="painter"]'],
  tinteggiatura: ['["craft"="painter"]'],
  verniciatura: ['["craft"="painter"]'],
  pittura: ['["craft"="painter"]'],
  // ── Idraulica & Termoidraulica ────────────────────────────────────────────
  idraulico: ['["craft"="plumber"]'],
  idraulici: ['["craft"="plumber"]'],
  termoidraulico: ['["craft"="plumber"]'],
  termoidraulici: ['["craft"="plumber"]'],
  caldaie: ['["craft"="heating_engineer"]'],
  caldaia: ['["craft"="heating_engineer"]'],
  riscaldamento: ['["craft"="heating_engineer"]'],
  sanitari: ['["shop"="bathroom_furnishing"]'],
  bagno: ['["shop"="bathroom_furnishing"]'],
  bagni: ['["shop"="bathroom_furnishing"]'],
  // ── Climatizzazione ───────────────────────────────────────────────────────
  climatizzatori: ['["craft"="hvac"]'],
  climatizzatore: ['["craft"="hvac"]'],
  climatizzazione: ['["craft"="hvac"]'],
  condizionatori: ['["craft"="hvac"]'],
  condizionatore: ['["craft"="hvac"]'],
  ventilazione: ['["craft"="hvac"]'],
  // ── Elettricità ───────────────────────────────────────────────────────────
  elettricista: ['["craft"="electrician"]'],
  elettricisti: ['["craft"="electrician"]'],
  impianti: ['["craft"="electrician"]', '["craft"="plumber"]'],
  // ── Fotovoltaico & Solare ─────────────────────────────────────────────────
  fotovoltaico: ['["craft"="solar_panel_installer"]', '["shop"="energy"]'],
  fotovoltaici: ['["craft"="solar_panel_installer"]'],
  // ── Falegnameria ──────────────────────────────────────────────────────────
  falegname: ['["craft"="carpenter"]'],
  falegnami: ['["craft"="carpenter"]'],
  falegnamerie: ['["craft"="carpenter"]'],
  falegnameria: ['["craft"="carpenter"]'],
  // ── Fabbri & Carpenteria Metallica ────────────────────────────────────────
  fabbro: ['["craft"="locksmith"]', '["craft"="metal_construction"]'],
  fabbri: ['["craft"="locksmith"]', '["craft"="metal_construction"]'],
  carpenteria: ['["craft"="metal_construction"]'],
  carpenterie: ['["craft"="metal_construction"]'],
  serratura: ['["craft"="locksmith"]'],
  serrature: ['["craft"="locksmith"]'],
  cancelli: ['["craft"="metal_construction"]'],
  recinzioni: ['["craft"="metal_construction"]'],
  saldatura: ['["craft"="welder"]'],
  // ── Vetro ─────────────────────────────────────────────────────────────────
  vetro: ['["craft"="glazier"]'],
  vetreria: ['["craft"="glazier"]'],
  specchi: ['["craft"="glazier"]'],
  // ── Tende & Tendaggi ──────────────────────────────────────────────────────
  tende: ['["shop"="curtain"]'],
  tenda: ['["shop"="curtain"]'],
  veneziane: ['["shop"="curtain"]'],
  zanzariere: ['["shop"="curtain"]'],
  // ── Cucine & Arredamento ──────────────────────────────────────────────────
  cucine: ['["shop"="kitchen"]'],
  cucina: ['["shop"="kitchen"]'],
  arredamento: ['["shop"="furniture"]'],
  arredamenti: ['["shop"="furniture"]'],
  mobili: ['["shop"="furniture"]'],
  mobile: ['["shop"="furniture"]'],
  // ── Sicurezza ─────────────────────────────────────────────────────────────
  antifurto: ['["shop"="security"]'],
  allarme: ['["shop"="security"]'],
  videosorveglianza: ['["shop"="security"]'],
  sicurezza: ['["shop"="security"]'],
  // ── Ascensori ─────────────────────────────────────────────────────────────
  ascensore: ['["craft"="elevator_constructor"]'],
  ascensori: ['["craft"="elevator_constructor"]'],
  montacarichi: ['["craft"="elevator_constructor"]'],
  // ── Pulizie ───────────────────────────────────────────────────────────────
  pulizie: ['["craft"="cleaning"]'],
  pulizia: ['["craft"="cleaning"]'],
  lavanderia: ['["shop"="laundry"]'],
  tintoria: ['["shop"="dry_cleaning"]'],
  // ── Traslochi & Logistica ─────────────────────────────────────────────────
  traslochi: ['["craft"="mover"]'],
  trasloco: ['["craft"="mover"]'],
  // ── Auto & Moto ───────────────────────────────────────────────────────────
  meccanico: ['["shop"="car_repair"]'],
  officina: ['["shop"="car_repair"]'],
  autofficina: ['["shop"="car_repair"]'],
  gommista: ['["shop"="tyres"]'],
  gommisti: ['["shop"="tyres"]'],
  pneumatici: ['["shop"="tyres"]'],
  carrozzeria: ['["shop"="car_repair"]'],
  autolavaggio: ['["amenity"="car_wash"]'],
  autonoleggio: ['["shop"="car_rental"]'],
  concessionaria: ['["shop"="car"]'],
  moto: ['["shop"="motorcycle"]'],
  bici: ['["shop"="bicycle"]'],
  biciclette: ['["shop"="bicycle"]'],
  // ── Benessere & Bellezza ──────────────────────────────────────────────────
  parrucchiere: ['["shop"="hairdresser"]'],
  parrucchieri: ['["shop"="hairdresser"]'],
  acconciature: ['["shop"="hairdresser"]'],
  barbiere: ['["shop"="barber"]'],
  barbieri: ['["shop"="barber"]'],
  estetista: ['["shop"="beauty"]'],
  estetiste: ['["shop"="beauty"]'],
  estetica: ['["shop"="beauty"]'],
  manicure: ['["shop"="nail_salon"]'],
  unghie: ['["shop"="nail_salon"]'],
  tatuaggi: ['["shop"="tattoo"]'],
  tatuatore: ['["shop"="tattoo"]'],
  spa: ['["leisure"="spa"]'],
  massaggi: ['["leisure"="spa"]'],
  // ── Sport & Tempo Libero ──────────────────────────────────────────────────
  palestra: ['["leisure"="fitness_centre"]'],
  palestre: ['["leisure"="fitness_centre"]'],
  fitness: ['["leisure"="fitness_centre"]'],
  yoga: ['["leisure"="fitness_centre"]'],
  crossfit: ['["leisure"="fitness_centre"]'],
  piscina: ['["leisure"="swimming_pool"]'],
  piscine: ['["leisure"="swimming_pool"]'],
  danza: ['["leisure"="dance"]'],
  // ── Viaggi ────────────────────────────────────────────────────────────────
  viaggi: ['["shop"="travel_agency"]'],
  // ── Stampa & Grafica ──────────────────────────────────────────────────────
  tipografia: ['["craft"="printer"]'],
  stampa: ['["craft"="printer"]'],
  grafica: ['["office"="graphic_designer"]'],
  // ── Negozi al Dettaglio ───────────────────────────────────────────────────
  ferramenta: ['["shop"="hardware"]'],
  abbigliamento: ['["shop"="clothes"]'],
  scarpe: ['["shop"="shoes"]'],
  calzature: ['["shop"="shoes"]'],
  gioielleria: ['["shop"="jewelry"]'],
  gioiellerie: ['["shop"="jewelry"]'],
  ottico: ['["shop"="optician"]'],
  ottici: ['["shop"="optician"]'],
  occhiali: ['["shop"="optician"]'],
  profumeria: ['["shop"="perfumery"]'],
  profumerie: ['["shop"="perfumery"]'],
  fiorista: ['["shop"="florist"]'],
  fioristi: ['["shop"="florist"]'],
  fiori: ['["shop"="florist"]'],
  libreria: ['["shop"="books"]'],
  cartoleria: ['["shop"="stationery"]'],
  cancelleria: ['["shop"="stationery"]'],
  // ── Informatica & Elettronica ─────────────────────────────────────────────
  informatica: ['["shop"="computer"]'],
  computer: ['["shop"="computer"]'],
  elettronica: ['["shop"="electronics"]'],
  telefonia: ['["shop"="mobile_phone"]'],
  cellulare: ['["shop"="mobile_phone"]'],
  smartphone: ['["shop"="mobile_phone"]'],
  // ── Istruzione ────────────────────────────────────────────────────────────
  scuola: ['["amenity"="school"]'],
  asilo: ['["amenity"="kindergarten"]'],
  // ── Giardinaggio ─────────────────────────────────────────────────────────
  giardiniere: ['["craft"="gardener"]'],
  giardinieri: ['["craft"="gardener"]'],
  giardinaggio: ['["craft"="gardener"]'],
  vivaio: ['["shop"="garden_centre"]'],
  vivai: ['["shop"="garden_centre"]'],
  // ── Fotografia ────────────────────────────────────────────────────────────
  fotografia: ['["shop"="photo"]'],
  fotografo: ['["shop"="photo"]'],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Settlement {
  name: string;
  lat: number;
  lon: number;
  region: string;
  placeType: string; // city | town | village | hamlet
}

/** Adaptive radius (metres) by settlement size */
function radiusForPlace(placeType: string): number {
  switch (placeType) {
    case "city":   return 15000;
    case "town":   return 8000;
    case "village": return 4000;
    case "hamlet": return 2000;
    default:       return 5000;
  }
}

// ─── Overpass helpers ─────────────────────────────────────────────────────────

/** Fetch with timeout using AbortController */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function overpassPost(query: string, timeoutMs = 50000): Promise<any> {
  const body = `data=${encodeURIComponent(query)}`;
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  };
  // Race both servers in parallel — whichever responds first wins (same as ScraperMaps)
  const tryServer = async (url: string) => {
    const res = await fetchWithTimeout(url, init, timeoutMs);
    if (!res.ok) throw new Error(`${url} ${res.status}`);
    const data = await res.json();
    if (data?.remark?.includes("timed out")) throw new Error("server timeout");
    return data;
  };
  try {
    return await Promise.any([
      tryServer("https://overpass-api.de/api/interpreter"),
      tryServer("https://overpass.kumi.systems/api/interpreter"),
    ]);
  } catch {
    return { elements: [] };
  }
}

async function fetchSettlements(
  regions: string[],
  minTypes: string[],
  onProgress?: (msg: string) => void,
): Promise<Settlement[]> {
  const results: Settlement[] = [];

  // Only query city/town/village for the settlement list.
  // Hamlets are too numerous (10k+ per region) and cause timeouts.
  // They are covered naturally by the larger radius of nearby towns.
  const safeTypes = minTypes.filter((t) => t !== "hamlet");
  if (safeTypes.length === 0) safeTypes.push("village");

  for (const region of regions) {
    const osmName = OSM_REGION_NAMES[region] || region;
    onProgress?.(`Cerco insediamenti in ${region}...`);

    // Step 1: get province IDs within this region (faster than direct place query)
    // Use admin_level=6 for Italian provinces inside the region area
    const placeFilter = safeTypes.map((t) => `node["place"="${t}"](area.region);`).join("");
    const q = [
      `[out:json][timeout:60];`,
      `area["name"="${osmName}"]["admin_level"="4"]["boundary"="administrative"]->.region;`,
      `(${placeFilter});`,
      `out center 5000;`,
    ].join("");

    const data = await overpassPost(q, 35000); // 35s browser timeout < 60s server timeout

    onProgress?.(`${region}: ${data.elements?.length ?? 0} insediamenti trovati`);

    const seen = new Set<string>();
    for (const el of data.elements || []) {
      if (!el.tags?.name) continue;
      const key = el.tags.name.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      results.push({
        name: el.tags.name,
        lat,
        lon,
        region,
        placeType: el.tags.place || "village",
      });
    }
  }
  return results;
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function ScraperRegionalePage() {
  // Config state
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [maxPerCity, setMaxPerCity] = useState(500);
  const [delayBetweenCities, setDelayBetweenCities] = useState(1500);
  const [minPlaceType, setMinPlaceType] = useState<string[]>(["city", "town", "village", "hamlet"]);

  // Runtime state
  const [isRunning, setIsRunning] = useState(false);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [currentCityIndex, setCurrentCityIndex] = useState(0);
  const [totalFound, setTotalFound] = useState(0);
  const [totalWithEmail, setTotalWithEmail] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<"idle" | "fetching" | "running" | "paused" | "completed" | "stopped">("idle");

  const isPaused = useRef(false);
  const isStopped = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  const addLog = useCallback((line: string) => {
    const ts = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLog((prev) => [...prev, `[${ts}] ${line}`].slice(-50));
  }, []);

  // ─── Per-city scraping ─────────────────────────────────────────────────────

  const scrapeCity = useCallback(
    async (
      settlement: Settlement,
      kw: string,
      max: number,
      parentSessionId: string,
      user_id: string
    ): Promise<{ imported: number; withEmail: number }> => {
      const { lat, lon, name, placeType } = settlement;
      const r = radiusForPlace(placeType); // adaptive radius
      const ql = kw.toLowerCase();

      // Strategy: always query ALL shops/crafts/offices/amenities (all indexed, fast),
      // then filter client-side by name containing the keyword.
      // This mirrors exactly how Scraper Maps works for Italian B2B categories:
      // most Italian OSM businesses don't have specific craft/shop tags, they just
      // have the keyword in their business name (e.g. "Infissi Rossi").
      // Additionally, if OSM_TAG_MAP has specific tags for this keyword, include them
      // so category-tagged businesses (e.g. amenity=restaurant) are also captured.
      const tagClauses: string[] = [];
      for (const [key, clauses] of Object.entries(OSM_TAG_MAP)) {
        const match =
          ql === key ||
          ql.includes(key) ||
          key.includes(ql) ||
          (ql.length >= 5 && key.startsWith(ql.slice(0, 5))) ||
          (key.length >= 5 && ql.startsWith(key.slice(0, 5)));
        if (match) {
          tagClauses.push(...clauses.map((c) => `nwr${c}(around:${r},${lat},${lon})`));
        }
      }
      // Always include broad indexed queries (never use slow name-regex in Overpass)
      const broadClauses = [
        `nwr["shop"](around:${r},${lat},${lon})`,
        `nwr["craft"](around:${r},${lat},${lon})`,
        `nwr["office"](around:${r},${lat},${lon})`,
        `nwr["amenity"](around:${r},${lat},${lon})`,
      ];
      const allClauses = [...new Set([...broadClauses, ...tagClauses])];
      const lim = 2000; // fetch many, filter client-side
      const ovQ = `[out:json][timeout:60];(${allClauses.join(";")};);out body center ${lim};`;

      // Same fetch pattern as ScraperMaps (no AbortController — server enforces 60s timeout)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tryOvCity = async (url: string): Promise<any> => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(ovQ)}`,
        });
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        return res.json();
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let ovData: any;
      try {
        ovData = await Promise.any([
          tryOvCity("https://overpass-api.de/api/interpreter"),
          tryOvCity("https://overpass.kumi.systems/api/interpreter"),
        ]);
      } catch {
        throw new Error(`Overpass non raggiungibile per ${name}`);
      }
      if (ovData?.remark?.includes("timed out")) {
        throw new Error(`Overpass timeout per ${name}`);
      }
      if (!ovData?.elements?.length) return { imported: 0, withEmail: 0 };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elements: any[] = ovData?.elements || [];

      // Build a set of expected tag key=value pairs from tagClauses for fast lookup
      // e.g. ["amenity"="restaurant"] → "amenity=restaurant"
      const expectedTagPairs = new Set(
        tagClauses.map((c) => {
          const m = c.match(/\["(\w+)"="([^"]+)"\]/);
          return m ? `${m[1]}=${m[2]}` : "";
        }).filter(Boolean)
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidates = elements
        .filter((el: any) => {
          const t = el.tags || {};
          if (!t.name) return false;
          // Accept if name contains keyword (primary strategy for Italian OSM data)
          if (t.name.toLowerCase().includes(ql)) return true;
          // Accept if element has a specific OSM tag matching the keyword category
          if (expectedTagPairs.size > 0) {
            for (const [k, v] of Object.entries(t)) {
              if (expectedTagPairs.has(`${k}=${v}`)) return true;
            }
          }
          return false;
        })
        .filter((el: any, idx: number, arr: any[]) => {
          // Deduplicate by OSM id
          return arr.findIndex((e: any) => e.id === el.id) === idx;
        })
        .slice(0, max * 2);

      // Bulk dedup
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cNames = [...new Set(candidates.map((el: any) => el.tags?.name).filter(Boolean))] as string[];
      const { data: exRows } = await supabase
        .from("contacts")
        .select("azienda")
        .eq("citta", name)
        .eq("user_id", user_id)
        .in("azienda", cNames.length ? cNames : ["__none__"]);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exSet = new Set((exRows || []).map((r: any) => r.azienda));

      // Build rows
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = [];
      let emailCount = 0;
      for (const el of candidates) {
        if (rows.length >= max || isStopped.current) break;
        const t = el.tags || {};
        const elName: string = t.name;
        if (exSet.has(elName)) continue;

        const rawWebsite =
          t.website || t["website:official"] || t["contact:website"] ||
          t["contact:url"] || t["url"] || t["brand:website"] ||
          t["operator:website"] || null;
        const website = rawWebsite
          ? (rawWebsite.startsWith("http") ? rawWebsite : `https://${rawWebsite}`).replace(/\/$/, "")
          : null;
        const phone =
          t.phone || t["contact:phone"] || t["contact:mobile"] ||
          t["phone:mobile"] || t["contact:whatsapp"] || null;
        const email = t.email || t["contact:email"] || t["email:business"] || null;

        const indirizzo =
          [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ") || null;
        const gmb_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${elName} ${name}${indirizzo ? " " + indirizzo : ""}`)}`;

        if (email) emailCount++;

        rows.push({
          azienda: elName,
          citta: name,
          indirizzo,
          cap: t["addr:postcode"] || null,
          telefono: phone || null,
          sito_web: website,
          email,
          lat: el.lat ?? el.center?.lat ?? null,
          lng: el.lon ?? el.center?.lon ?? null,
          google_categories: [
            t.amenity, t.shop, t.craft, t.office, t.tourism, t.healthcare, t.leisure,
          ].filter(Boolean),
          note: gmb_url,
          fonte: "openstreetmap",
          stato: "nuovo",
          user_id,
          scraping_session_id: parentSessionId,
        });
        exSet.add(elName);
      }

      // Bulk insert in chunks of 100
      let imported = 0;
      for (let i = 0; i < rows.length; i += 100) {
        if (isStopped.current) break;
        const chunk = rows.slice(i, i + 100);
        const { error: ie } = await supabase.from("contacts").insert(chunk);
        if (!ie) imported += chunk.length;
        else console.error(`Insert error in ${name}:`, ie.message, ie.details);
      }

      return { imported, withEmail: emailCount };
    },
    []
  );

  // ─── Main flow ─────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (selectedRegions.length === 0) {
      toast.error("Seleziona almeno una regione");
      return;
    }
    if (!keyword.trim()) {
      toast.error("Inserisci una categoria (es. ristorante)");
      return;
    }
    if (minPlaceType.length === 0) {
      toast.error("Seleziona almeno un tipo di insediamento");
      return;
    }

    isPaused.current = false;
    isStopped.current = false;
    setIsRunning(true);
    setLog([]);
    setSettlements([]);
    setCurrentCityIndex(0);
    setTotalFound(0);
    setTotalWithEmail(0);
    setSessionStatus("fetching");

    try {
      const user_id = await getCurrentUserId();

      // Create regional session
      const { data: session, error: sessionErr } = await supabase
        .from("scraping_sessions")
        .insert({
          user_id,
          tipo: "regional",
          query: keyword,
          citta: selectedRegions.join(", "),
          raggio: maxPerCity,
          max_results: maxPerCity,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (sessionErr) throw sessionErr;
      const sid = session.id;
      setSessionId(sid);

      // Phase 1: fetch settlements
      addLog(`Avvio fase 1: ricerca insediamenti in ${selectedRegions.join(", ")}...`);
      let fetchedSettlements: Settlement[] = [];
      try {
        fetchedSettlements = await fetchSettlements(selectedRegions, minPlaceType, addLog);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Errore Overpass";
        addLog(`ERRORE fetch insediamenti: ${msg}`);
        toast.error(msg);
        await supabase.from("scraping_sessions").update({ status: "failed", error_message: msg }).eq("id", sid);
        setIsRunning(false);
        setSessionStatus("idle");
        return;
      }

      setSettlements(fetchedSettlements);
      const regionCounts = selectedRegions
        .map((r) => `${r}: ${fetchedSettlements.filter((s) => s.region === r).length}`)
        .join(", ");
      addLog(`Trovati ${fetchedSettlements.length} comuni — ${regionCounts}`);
      toast.info(`Trovati ${fetchedSettlements.length} comuni. Avvio scraping...`);

      if (fetchedSettlements.length === 0) {
        await supabase.from("scraping_sessions").update({ status: "completed", completed_at: new Date().toISOString(), totale_importati: 0 }).eq("id", sid);
        setIsRunning(false);
        setSessionStatus("completed");
        return;
      }

      // Phase 2: scrape each city
      setSessionStatus("running");
      let cumulativeFound = 0;
      let cumulativeEmail = 0;

      for (let i = 0; i < fetchedSettlements.length; i++) {
        if (isStopped.current) {
          addLog("Scraping interrotto dall'utente.");
          break;
        }

        // Pause loop
        while (isPaused.current && !isStopped.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (isStopped.current) {
          addLog("Scraping interrotto dall'utente.");
          break;
        }

        const settlement = fetchedSettlements[i];
        setCurrentCityIndex(i + 1);

        try {
          const { imported, withEmail } = await scrapeCity(
            settlement,
            keyword,
            maxPerCity,
            sid,
            user_id
          );
          cumulativeFound += imported;
          cumulativeEmail += withEmail;
          setTotalFound(cumulativeFound);
          setTotalWithEmail(cumulativeEmail);

          const emailNote = withEmail > 0 ? ` (${withEmail} email)` : "";
          addLog(`✓ ${settlement.name} [${settlement.region}]: ${imported} ${keyword}${emailNote}`);

          // Update session progress
          const progressPercent = Math.round(((i + 1) / fetchedSettlements.length) * 100);
          await supabase.from("scraping_sessions").update({
            totale_importati: cumulativeFound,
            progress_percent: progressPercent,
          }).eq("id", sid);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Errore";
          addLog(`✗ ${settlement.name}: ${msg}`);
        }

        // Delay between cities
        if (i < fetchedSettlements.length - 1 && !isStopped.current) {
          await new Promise((r) => setTimeout(r, delayBetweenCities));
        }
      }

      // Finalize session
      const finalStatus = isStopped.current ? "stopped" : "completed";
      await supabase.from("scraping_sessions").update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        totale_trovati: fetchedSettlements.length,
        totale_importati: cumulativeFound,
        progress_percent: 100,
      }).eq("id", sid);

      addLog(`--- Completato: ${cumulativeFound} contatti da ${fetchedSettlements.length} comuni ---`);
      toast.success(`Scraping completato: ${cumulativeFound} contatti importati`);
      setSessionStatus("completed");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore sconosciuto";
      toast.error(`Errore: ${msg}`);
      addLog(`ERRORE: ${msg}`);
      if (sessionId) {
        await supabase.from("scraping_sessions").update({ status: "failed", error_message: msg }).eq("id", sessionId);
      }
      setSessionStatus("idle");
    } finally {
      setIsRunning(false);
    }
  };

  const handlePause = async () => {
    if (!sessionId) return;
    isPaused.current = true;
    setSessionStatus("paused");
    await supabase.from("scraping_sessions").update({ status: "paused" }).eq("id", sessionId);
    addLog("--- Scraping in pausa ---");
    toast.info("Scraping in pausa");
  };

  const handleResume = async () => {
    if (!sessionId) return;
    isPaused.current = false;
    setSessionStatus("running");
    await supabase.from("scraping_sessions").update({ status: "running" }).eq("id", sessionId);
    addLog("--- Scraping ripreso ---");
    toast.info("Scraping ripreso");
  };

  const handleStop = () => {
    isStopped.current = true;
    setSessionStatus("stopped");
    addLog("--- Stop richiesto, attesa completamento città corrente... ---");
    toast.info("Stop richiesto — risultati parziali salvati");
  };

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const togglePlaceType = (type: string) => {
    setMinPlaceType((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const progressPercent =
    settlements.length > 0
      ? Math.round((currentCityIndex / settlements.length) * 100)
      : 0;

  const statusBadge = () => {
    if (sessionStatus === "running")
      return <span className="px-2 py-0.5 rounded text-xs font-mono bg-green-500/20 text-green-400 border border-green-500/30">IN ESECUZIONE</span>;
    if (sessionStatus === "paused")
      return <span className="px-2 py-0.5 rounded text-xs font-mono bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">IN PAUSA</span>;
    if (sessionStatus === "fetching")
      return <span className="px-2 py-0.5 rounded text-xs font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30">RICERCA COMUNI...</span>;
    if (sessionStatus === "completed")
      return <span className="px-2 py-0.5 rounded text-xs font-mono bg-primary/20 text-primary border border-primary/30">COMPLETATO</span>;
    if (sessionStatus === "stopped")
      return <span className="px-2 py-0.5 rounded text-xs font-mono bg-destructive/20 text-destructive border border-destructive/30">FERMATO</span>;
    return null;
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* ─── Left panel ────────────────────────────────────────────────────── */}
      <div className="w-[380px] shrink-0 flex flex-col gap-4 overflow-y-auto pr-2">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Globe2 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">SCRAPER REGIONALE</h1>
        </div>

        {/* Region selector */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="terminal-header text-xs">REGIONI ITALIANE</div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedRegions([...ITALIAN_REGIONS])}
              className="text-xs px-2 py-1 rounded border border-primary bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-mono font-medium"
              disabled={isRunning}
            >
              🇮🇹 Tutto Italia
            </button>
            <button
              onClick={() => setSelectedRegions([])}
              className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              disabled={isRunning}
            >
              Nessuna
            </button>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {ITALIAN_REGIONS.map((region) => (
              <label key={region} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedRegions.includes(region)}
                  onChange={() => toggleRegion(region)}
                  disabled={isRunning}
                  className="h-3.5 w-3.5 rounded border-border accent-primary"
                />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">
                  {region}
                </span>
              </label>
            ))}
          </div>
          {selectedRegions.length > 0 && (
            <div className="text-xs text-primary font-mono">
              {selectedRegions.length} region{selectedRegions.length === 1 ? "e" : "i"} selezionat{selectedRegions.length === 1 ? "a" : "e"}
            </div>
          )}
        </div>

        {/* Keyword */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <div className="terminal-header text-xs">CATEGORIA</div>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="es. ristorante, idraulico, palestra..."
            disabled={isRunning}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm font-mono text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary transition-colors disabled:opacity-50"
          />
        </div>

        {/* Config */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="terminal-header text-xs">CONFIGURAZIONE</div>

          {/* Max per city */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Max contatti per città</label>
            <div className="flex gap-2">
              {[100, 200, 500, 9999].map((v) => (
                <button
                  key={v}
                  onClick={() => setMaxPerCity(v)}
                  disabled={isRunning}
                  className={`flex-1 text-xs py-1 rounded border transition-colors ${
                    maxPerCity === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  } disabled:opacity-50`}
                >
                  {v === 9999 ? "∞ Tutti" : v}
                </button>
              ))}
            </div>
          </div>

          {/* Delay */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Pausa tra città</label>
            <div className="flex gap-2">
              {[
                { label: "1s", value: 1000 },
                { label: "1.5s", value: 1500 },
                { label: "2s", value: 2000 },
                { label: "3s", value: 3000 },
              ].map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setDelayBetweenCities(value)}
                  disabled={isRunning}
                  className={`flex-1 text-xs py-1 rounded border transition-colors ${
                    delayBetweenCities === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                  } disabled:opacity-50`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Place types */}
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tipi di insediamento</label>
            <div className="flex flex-col gap-1">
              {[
                { key: "city", label: "Città (capoluoghi)" },
                { key: "town", label: "Comune / Town" },
                { key: "village", label: "Paese / Village" },
                { key: "hamlet", label: "Frazione / Hamlet" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={minPlaceType.includes(key)}
                    onChange={() => togglePlaceType(key)}
                    disabled={isRunning}
                    className="h-3.5 w-3.5 rounded border-border accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2">
          {!isRunning && sessionStatus !== "running" && sessionStatus !== "paused" && (
            <button
              onClick={handleStart}
              className="w-full py-2 rounded bg-primary text-primary-foreground text-sm font-ui font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              disabled={selectedRegions.length === 0 || !keyword.trim()}
            >
              Avvia Scraping Regionale
            </button>
          )}

          {isRunning && sessionStatus === "running" && (
            <div className="flex gap-2">
              <button
                onClick={handlePause}
                className="flex-1 py-2 rounded border border-yellow-500/50 bg-yellow-500/10 text-yellow-400 text-sm font-ui hover:bg-yellow-500/20 transition-colors"
              >
                Pausa
              </button>
              <button
                onClick={handleStop}
                className="flex-1 py-2 rounded border border-destructive/50 bg-destructive/10 text-destructive text-sm font-ui hover:bg-destructive/20 transition-colors"
              >
                Stop
              </button>
            </div>
          )}

          {isRunning && sessionStatus === "paused" && (
            <div className="flex gap-2">
              <button
                onClick={handleResume}
                className="flex-1 py-2 rounded bg-primary text-primary-foreground text-sm font-ui hover:bg-primary/90 transition-colors"
              >
                Riprendi
              </button>
              <button
                onClick={handleStop}
                className="flex-1 py-2 rounded border border-destructive/50 bg-destructive/10 text-destructive text-sm font-ui hover:bg-destructive/20 transition-colors"
              >
                Stop
              </button>
            </div>
          )}

          {isRunning && sessionStatus === "fetching" && (
            <button disabled className="w-full py-2 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 text-sm font-ui opacity-70 cursor-not-allowed">
              Ricerca comuni in corso...
            </button>
          )}
        </div>

        {/* Stats summary */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-1">
          <div className="terminal-header text-xs mb-2">STATISTICHE</div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">Comuni da processare</span>
            <span className="text-foreground">{settlements.length || "—"}</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">Comuni processati</span>
            <span className="text-foreground">{currentCityIndex}</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">Trovati finora</span>
            <span className="text-primary font-bold">{totalFound}</span>
          </div>
          <div className="flex justify-between text-xs font-mono">
            <span className="text-muted-foreground">Con email</span>
            <span className="text-foreground">{totalWithEmail}</span>
          </div>
        </div>
      </div>

      {/* ─── Right panel ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Status + progress */}
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="terminal-header text-xs">AVANZAMENTO</div>
            {statusBadge()}
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
              <span>
                {currentCityIndex > 0
                  ? `Comune ${currentCityIndex} di ${settlements.length}`
                  : settlements.length > 0
                  ? `${settlements.length} comuni trovati`
                  : "In attesa..."}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded border border-border bg-background/50 p-2 text-center">
              <div className="text-xs text-muted-foreground font-mono mb-0.5">Regioni</div>
              <div className="text-lg font-bold font-mono text-foreground">{selectedRegions.length}</div>
            </div>
            <div className="rounded border border-border bg-background/50 p-2 text-center">
              <div className="text-xs text-muted-foreground font-mono mb-0.5">Comuni</div>
              <div className="text-lg font-bold font-mono text-foreground">{currentCityIndex}</div>
            </div>
            <div className="rounded border border-border bg-background/50 p-2 text-center">
              <div className="text-xs text-muted-foreground font-mono mb-0.5">Trovati</div>
              <div className="text-lg font-bold font-mono text-primary">{totalFound}</div>
            </div>
            <div className="rounded border border-border bg-background/50 p-2 text-center">
              <div className="text-xs text-muted-foreground font-mono mb-0.5">Con Email</div>
              <div className="text-lg font-bold font-mono text-foreground">{totalWithEmail}</div>
            </div>
          </div>
        </div>

        {/* Terminal log */}
        <div className="flex-1 rounded-lg border border-border bg-card flex flex-col overflow-hidden">
          <div className="terminal-header text-xs px-4 py-2 border-b border-border shrink-0">
            LOG — ULTIMI 50 EVENTI
          </div>
          <div
            ref={logRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-0.5"
            style={{ backgroundColor: "hsl(var(--background))" }}
          >
            {log.length === 0 ? (
              <div className="text-muted-foreground italic">
                In attesa di avvio...
              </div>
            ) : (
              log.map((line, i) => {
                const isError = line.includes("ERRORE") || line.includes("✗");
                const isSuccess = line.includes("✓");
                const isInfo = line.includes("---");
                return (
                  <div
                    key={i}
                    className={
                      isError
                        ? "text-destructive"
                        : isSuccess
                        ? "text-green-400"
                        : isInfo
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  >
                    {line}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
