import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapsConfigPanel } from "@/components/scraper/MapsConfigPanel";
import { MapsProgressBox } from "@/components/scraper/MapsProgressBox";
import { MapsResultsTable } from "@/components/scraper/MapsResultsTable";
import { MapsPreviousSessions } from "@/components/scraper/MapsPreviousSessions";
import { toast } from "sonner";
import { getCurrentUserId } from "@/lib/auth";
import type { Contact } from "@/types";
import { useScrapingSession, useScrapingSessions } from "@/hooks/useScrapingSession";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface MapsConfig {
  provider: "google_maps" | "openstreetmap";
  query: string;
  citta: string;
  raggio: number;
  maxResults: number;
  soloConSito: boolean;
  soloConTelefono: boolean;
  ratingMin: number;
  recensioniMin: number;
}

export default function ScraperMapsPage() {
  const [config, setConfig] = useState<MapsConfig>({
    provider: "openstreetmap",
    query: "", citta: "", raggio: 25, maxResults: 500,
    soloConSito: false, soloConTelefono: false, ratingMin: 0, recensioniMin: 0,
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [results, setResults] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [isRunningLocal, setIsRunningLocal] = useState(false);
  const [lastImported, setLastImported] = useState<
    { azienda: string; citta: string | null; hasSito: boolean; hasTel: boolean }[]
  >([]);

  const isPaused = useRef(false);
  const isStopped = useRef(false);
  // Store config in ref so the loop always has the latest snapshot at start
  const configRef = useRef(config);
  configRef.current = config;

  const activeSession = useScrapingSession(activeSessionId);
  const { sessions: previousSessions, refetch: refetchSessions, hasMore, loadMore } = useScrapingSessions();

  const isRunning =
    isRunningLocal || activeSession?.status === "running" || activeSession?.status === "pending";

  const loadResultsForSession = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("scraping_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(5000);
    setResults((data as unknown as Contact[]) || []);
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    loadResultsForSession(activeSessionId);
    const channel = supabase
      .channel(`new-contacts-${activeSessionId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "contacts", filter: `scraping_session_id=eq.${activeSessionId}` },
        (payload) => {
          const c = payload.new as unknown as Contact;
          setResults((prev) => [c, ...prev.slice(0, 4999)]);
          setLastImported((prev) =>
            [{ azienda: c.azienda, citta: c.citta, hasSito: !!c.sito_web, hasTel: !!c.telefono }, ...prev].slice(0, 5)
          );
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSessionId, loadResultsForSession]);

  // ─── OSM: query Nominatim + Overpass directly from the browser (no IP blocking) ───

  // Italian term → OSM Overpass tag clauses (supports common B2B/B2C categories)
  const OSM_TAG_MAP: Record<string, string[]> = {
    // ── Cibo & Bevande ─────────────────────────────────────────────────────
    ristorante: ['["amenity"="restaurant"]'],
    trattoria: ['["amenity"="restaurant"]'],
    osteria: ['["amenity"="restaurant"]'],
    pizzeria: ['["amenity"="restaurant"]'],
    sushi: ['["amenity"="restaurant"]'],
    cinese: ['["amenity"="restaurant"]'],
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
    alimentari: ['["shop"="convenience"]', '["shop"="supermarket"]'],
    supermercato: ['["shop"="supermarket"]'],
    macelleria: ['["shop"="butcher"]'],
    pescheria: ['["shop"="seafood"]'],
    salumeria: ['["shop"="deli"]'],
    gastronomia: ['["shop"="deli"]'],
    enoteca: ['["shop"="wine"]'],
    cantina: ['["craft"="winery"]', '["shop"="wine"]'],
    birrificio: ['["craft"="brewery"]'],
    ortofrutta: ['["shop"="greengrocer"]'],
    hamburgeria: ['["amenity"="fast_food"]'],
    kebab: ['["amenity"="fast_food"]'],
    piadineria: ['["amenity"="fast_food"]'],
    rosticceria: ['["amenity"="fast_food"]'],
    pub: ['["amenity"="pub"]'],
    torrefazione: ['["craft"="roaster"]'],
    // ── Alloggio ───────────────────────────────────────────────────────────
    hotel: ['["tourism"="hotel"]'],
    albergo: ['["tourism"="hotel"]'],
    relais: ['["tourism"="hotel"]'],
    locanda: ['["tourism"="hotel"]'],
    ostello: ['["tourism"="hostel"]'],
    bnb: ['["tourism"="guest_house"]'],
    affittacamere: ['["tourism"="guest_house"]'],
    agriturismo: ['["tourism"="guest_house"]'],
    campeggio: ['["tourism"="camp_site"]'],
    // ── Sanità ─────────────────────────────────────────────────────────────
    farmacia: ['["amenity"="pharmacy"]'],
    dentista: ['["amenity"="dentist"]'],
    odontoiatr: ['["amenity"="dentist"]'],
    medico: ['["amenity"="doctors"]', '["amenity"="clinic"]'],
    clinica: ['["amenity"="clinic"]'],
    ambulatorio: ['["amenity"="clinic"]'],
    ospedale: ['["amenity"="hospital"]'],
    veterinario: ['["amenity"="veterinary"]'],
    veterinar: ['["amenity"="veterinary"]'],
    fisioterapist: ['["healthcare"="physiotherapist"]'],
    fisioterapia: ['["healthcare"="physiotherapist"]'],
    psicologo: ['["healthcare"="psychotherapist"]'],
    psicolog: ['["healthcare"="psychotherapist"]'],
    nutrizionist: ['["healthcare"="dietitian"]'],
    osteopat: ['["healthcare"="osteopath"]'],
    logopedist: ['["healthcare"="speech_therapist"]'],
    erboristeria: ['["shop"="herbalist"]'],
    erborist: ['["shop"="herbalist"]'],
    // ── Finanza & Legale ───────────────────────────────────────────────────
    banca: ['["amenity"="bank"]'],
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
    // ── Architettura & Ingegneria ──────────────────────────────────────────
    geometra: ['["office"="surveyor"]'],
    geometri: ['["office"="surveyor"]'],
    architetto: ['["office"="architect"]'],
    architettura: ['["office"="architect"]'],
    ingegnere: ['["office"="engineer"]'],
    ingegneria: ['["office"="engineer"]'],
    // ── Immobiliare ────────────────────────────────────────────────────────
    immobiliare: ['["office"="estate_agent"]'],
    immobili: ['["office"="estate_agent"]'],
    // ── Edilizia & Costruzioni ─────────────────────────────────────────────
    'imprese edil': ['["craft"="construction"]'],
    'impresa edil': ['["craft"="construction"]'],
    impresa: ['["craft"="construction"]'],
    costruzioni: ['["craft"="construction"]'],
    edilizia: ['["craft"="construction"]'],
    muratore: ['["craft"="mason"]'],
    muratori: ['["craft"="mason"]'],
    ristrutturazione: ['["craft"="construction"]'],
    ristrutturazioni: ['["craft"="construction"]'],
    cartongesso: ['["craft"="construction"]'],
    ponteggi: ['["craft"="scaffolder"]'],
    demolizione: ['["craft"="demolition_contractor"]'],
    demolizioni: ['["craft"="demolition_contractor"]'],
    impermeabilizzazione: ['["craft"="waterproofer"]'],
    coibentazione: ['["craft"="insulation"]'],
    isolamento: ['["craft"="insulation"]'],
    cappotto: ['["craft"="insulation"]'],
    // ── Infissi & Serramenti ───────────────────────────────────────────────
    infissi: ['["craft"="window_construction"]', '["shop"="doors"]'],
    infisso: ['["craft"="window_construction"]', '["shop"="doors"]'],
    serramenti: ['["craft"="window_construction"]', '["shop"="doors"]'],
    serramento: ['["craft"="window_construction"]', '["shop"="doors"]'],
    serramentist: ['["craft"="window_construction"]', '["shop"="doors"]'],
    finestre: ['["craft"="window_construction"]'],
    finestra: ['["craft"="window_construction"]'],
    porte: ['["shop"="doors"]'],
    portoni: ['["shop"="doors"]'],
    // ── Pavimenti & Rivestimenti ───────────────────────────────────────────
    pavimenti: ['["craft"="floorer"]', '["shop"="flooring"]'],
    pavimento: ['["craft"="floorer"]', '["shop"="flooring"]'],
    parquet: ['["craft"="floorer"]'],
    piastrelle: ['["shop"="tiles"]'],
    ceramiche: ['["shop"="tiles"]'],
    ceramica: ['["shop"="tiles"]'],
    rivestimenti: ['["shop"="tiles"]', '["craft"="floorer"]'],
    marmista: ['["craft"="stonemason"]'],
    marmo: ['["craft"="stonemason"]'],
    granito: ['["craft"="stonemason"]'],
    // ── Coperture ─────────────────────────────────────────────────────────
    coperture: ['["craft"="roofer"]'],
    tetto: ['["craft"="roofer"]'],
    tetti: ['["craft"="roofer"]'],
    lattoniere: ['["craft"="roofer"]'],
    lattoneria: ['["craft"="roofer"]'],
    // ── Pittura ───────────────────────────────────────────────────────────
    imbianchino: ['["craft"="painter"]'],
    imbianchini: ['["craft"="painter"]'],
    pittore: ['["craft"="painter"]'],
    tinteggiatura: ['["craft"="painter"]'],
    verniciatura: ['["craft"="painter"]'],
    pittura: ['["craft"="painter"]'],
    // ── Idraulica & Termoidraulica ─────────────────────────────────────────
    idraulico: ['["craft"="plumber"]'],
    idraulici: ['["craft"="plumber"]'],
    termoidraulico: ['["craft"="plumber"]'],
    caldaie: ['["craft"="heating_engineer"]'],
    caldaia: ['["craft"="heating_engineer"]'],
    riscaldamento: ['["craft"="heating_engineer"]'],
    sanitari: ['["shop"="bathroom_furnishing"]'],
    bagno: ['["shop"="bathroom_furnishing"]'],
    bagni: ['["shop"="bathroom_furnishing"]'],
    // ── Climatizzazione ───────────────────────────────────────────────────
    climatizzatori: ['["craft"="hvac"]'],
    climatizzatore: ['["craft"="hvac"]'],
    climatizzazione: ['["craft"="hvac"]'],
    condizionatori: ['["craft"="hvac"]'],
    condizionatore: ['["craft"="hvac"]'],
    ventilazione: ['["craft"="hvac"]'],
    // ── Elettricità ───────────────────────────────────────────────────────
    elettricista: ['["craft"="electrician"]'],
    elettricisti: ['["craft"="electrician"]'],
    impianti: ['["craft"="electrician"]', '["craft"="plumber"]'],
    // ── Fotovoltaico ──────────────────────────────────────────────────────
    fotovoltaico: ['["craft"="solar_panel_installer"]', '["shop"="energy"]'],
    fotovoltaici: ['["craft"="solar_panel_installer"]'],
    // ── Falegnameria ──────────────────────────────────────────────────────
    falegname: ['["craft"="carpenter"]'],
    falegnami: ['["craft"="carpenter"]'],
    falegnamerie: ['["craft"="carpenter"]'],
    falegnameria: ['["craft"="carpenter"]'],
    // ── Fabbri & Carpenteria ──────────────────────────────────────────────
    fabbro: ['["craft"="locksmith"]', '["craft"="metal_construction"]'],
    fabbri: ['["craft"="locksmith"]', '["craft"="metal_construction"]'],
    carpenteria: ['["craft"="metal_construction"]'],
    serratura: ['["craft"="locksmith"]'],
    serrature: ['["craft"="locksmith"]'],
    cancelli: ['["craft"="metal_construction"]'],
    recinzioni: ['["craft"="metal_construction"]'],
    saldatura: ['["craft"="welder"]'],
    // ── Vetro ─────────────────────────────────────────────────────────────
    vetro: ['["craft"="glazier"]'],
    vetreria: ['["craft"="glazier"]'],
    specchi: ['["craft"="glazier"]'],
    // ── Tende ─────────────────────────────────────────────────────────────
    tende: ['["shop"="curtain"]'],
    tenda: ['["shop"="curtain"]'],
    veneziane: ['["shop"="curtain"]'],
    zanzariere: ['["shop"="curtain"]'],
    // ── Cucine & Arredamento ──────────────────────────────────────────────
    cucine: ['["shop"="kitchen"]'],
    cucina: ['["shop"="kitchen"]'],
    arredamento: ['["shop"="furniture"]'],
    arredamenti: ['["shop"="furniture"]'],
    mobili: ['["shop"="furniture"]'],
    mobile: ['["shop"="furniture"]'],
    // ── Sicurezza ─────────────────────────────────────────────────────────
    antifurto: ['["shop"="security"]'],
    allarme: ['["shop"="security"]'],
    videosorveglianza: ['["shop"="security"]'],
    sicurezza: ['["shop"="security"]'],
    // ── Ascensori ─────────────────────────────────────────────────────────
    ascensore: ['["craft"="elevator_constructor"]'],
    ascensori: ['["craft"="elevator_constructor"]'],
    montacarichi: ['["craft"="elevator_constructor"]'],
    // ── Pulizie ───────────────────────────────────────────────────────────
    pulizie: ['["craft"="cleaning"]'],
    pulizia: ['["craft"="cleaning"]'],
    lavanderia: ['["shop"="laundry"]'],
    tintoria: ['["shop"="dry_cleaning"]'],
    // ── Traslochi ─────────────────────────────────────────────────────────
    traslochi: ['["craft"="mover"]'],
    trasloco: ['["craft"="mover"]'],
    // ── Auto & Moto ───────────────────────────────────────────────────────
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
    // ── Benessere & Bellezza ──────────────────────────────────────────────
    parrucchiere: ['["shop"="hairdresser"]'],
    parrucchieri: ['["shop"="hairdresser"]'],
    acconciature: ['["shop"="hairdresser"]'],
    barbiere: ['["shop"="barber"]'],
    estetista: ['["shop"="beauty"]'],
    estetiste: ['["shop"="beauty"]'],
    estetica: ['["shop"="beauty"]'],
    manicure: ['["shop"="nail_salon"]'],
    unghie: ['["shop"="nail_salon"]'],
    tatuaggi: ['["shop"="tattoo"]'],
    spa: ['["leisure"="spa"]'],
    massaggi: ['["leisure"="spa"]'],
    // ── Sport & Tempo Libero ──────────────────────────────────────────────
    palestra: ['["leisure"="fitness_centre"]'],
    palestre: ['["leisure"="fitness_centre"]'],
    fitness: ['["leisure"="fitness_centre"]'],
    yoga: ['["leisure"="fitness_centre"]'],
    piscina: ['["leisure"="swimming_pool"]'],
    piscine: ['["leisure"="swimming_pool"]'],
    danza: ['["leisure"="dance"]'],
    // ── Viaggi ────────────────────────────────────────────────────────────
    viaggi: ['["shop"="travel_agency"]'],
    // ── Stampa & Grafica ──────────────────────────────────────────────────
    tipografia: ['["craft"="printer"]'],
    stampa: ['["craft"="printer"]'],
    grafica: ['["office"="graphic_designer"]'],
    // ── Negozi al Dettaglio ───────────────────────────────────────────────
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
    // ── Informatica & Elettronica ─────────────────────────────────────────
    informatica: ['["shop"="computer"]'],
    computer: ['["shop"="computer"]'],
    elettronica: ['["shop"="electronics"]'],
    telefonia: ['["shop"="mobile_phone"]'],
    cellulare: ['["shop"="mobile_phone"]'],
    smartphone: ['["shop"="mobile_phone"]'],
    // ── Istruzione ────────────────────────────────────────────────────────
    scuola: ['["amenity"="school"]'],
    asilo: ['["amenity"="kindergarten"]'],
    // ── Giardinaggio ─────────────────────────────────────────────────────
    giardiniere: ['["craft"="gardener"]'],
    giardinieri: ['["craft"="gardener"]'],
    giardinaggio: ['["craft"="gardener"]'],
    vivaio: ['["shop"="garden_centre"]'],
    vivai: ['["shop"="garden_centre"]'],
    // ── Fotografia ────────────────────────────────────────────────────────
    fotografia: ['["shop"="photo"]'],
    fotografo: ['["shop"="photo"]'],
  };

  const runOSMScrapingLocal = useCallback(async (sessionId: string, loopConfig: MapsConfig) => {
    await supabase.from("scraping_sessions")
      .update({ status: "running", started_at: new Date().toISOString() }).eq("id", sessionId);

    // 1. Nominatim geocoding
    const nomResp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(loopConfig.citta + " Italy")}&format=json&limit=1&countrycodes=it`,
      { headers: { "User-Agent": "BuzzFinderBot/1.0" } }
    );
    if (!nomResp.ok) throw new Error(`Nominatim error ${nomResp.status}`);
    const nomData = await nomResp.json();
    if (!nomData?.length) throw new Error(`Città "${loopConfig.citta}" non trovata in OpenStreetMap`);

    const lat = parseFloat(nomData[0].lat);
    const lon = parseFloat(nomData[0].lon);
    const r = loopConfig.raggio * 1000;
    const sq = loopConfig.query.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const lim = Math.min(loopConfig.maxResults, 1000);
    const ql = loopConfig.query.toLowerCase();

    // Build Overpass clauses — flexible stem matching against OSM_TAG_MAP
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
    // If no tag clauses: broad indexed query (shop/craft/office) + client-side filter
    // This avoids slow regex full-scans that time out on Overpass
    const useBroadFallback = tagClauses.length === 0;
    const allClauses = tagClauses.length > 0
      ? [...new Set(tagClauses)]
      : [
          `nwr["shop"](around:${r},${lat},${lon})`,
          `nwr["craft"](around:${r},${lat},${lon})`,
          `nwr["office"](around:${r},${lat},${lon})`,
        ];
    // Broad fallback fetches more elements to compensate for client-side filtering
    const effectiveLim = useBroadFallback ? Math.min(lim * 4, 2000) : lim;
    const ovQ = `[out:json][timeout:60];(${allClauses.join(";")};);out body center ${effectiveLim};`;

    // 2. Overpass from browser (not blocked unlike edge functions)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function tryOv(url: string): Promise<any> {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(ovQ)}` });
      if (!res.ok) throw new Error(`${url} ${res.status}`);
      return res.json();
    }
    const ovData = await Promise.any([
      tryOv("https://overpass-api.de/api/interpreter"),
      tryOv("https://overpass.kumi.systems/api/interpreter"),
    ]);
    if (ovData?.remark?.includes("timed out")) throw new Error(`Overpass timeout — riprova con un raggio più piccolo`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elements: any[] = ovData.elements || [];

    // Tag-matched → accept all (Overpass already filtered by category)
    // Broad fallback → filter client-side by name containing keyword
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates = elements.filter((el: any) => {
      const t = el.tags || {}; if (!t.name) return false;
      if (!useBroadFallback) return true;
      return t.name.toLowerCase().includes(ql);
    }).slice(0, loopConfig.maxResults * 2);

    // Bulk dedup (1 DB query)
    const user_id = await getCurrentUserId();
    // deno-lint-ignore no-explicit-any
    const cNames = [...new Set(candidates.map((el: any) => el.tags?.name).filter(Boolean))] as string[];
    const { data: exRows } = await supabase.from("contacts").select("azienda")
      .eq("citta", loopConfig.citta).eq("user_id", user_id)
      .in("azienda", cNames.length ? cNames : ["__none__"]);
    // deno-lint-ignore no-explicit-any
    const exSet = new Set((exRows || []).map((r: any) => r.azienda));

    // Build insert rows
    // deno-lint-ignore no-explicit-any
    const rows: any[] = [];
    for (const el of candidates) {
      if (rows.length >= loopConfig.maxResults || isStopped.current) break;
      const t = el.tags || {}; const name: string = t.name;
      if (exSet.has(name)) continue;
      // Collect website from all possible OSM tags
      const rawWebsite =
        t.website || t["website:official"] || t["contact:website"] ||
        t["contact:url"] || t["url"] || t["brand:website"] ||
        t["operator:website"] || null;
      // Normalize: ensure https:// prefix, strip trailing slashes
      const website = rawWebsite
        ? (rawWebsite.startsWith("http") ? rawWebsite : `https://${rawWebsite}`).replace(/\/$/, "")
        : null;
      const phone =
        t.phone || t["contact:phone"] || t["contact:mobile"] ||
        t["phone:mobile"] || t["contact:whatsapp"] || null;
      const email = t.email || t["contact:email"] || t["email:business"] || null;
      if (loopConfig.soloConSito && !website) continue;
      if (loopConfig.soloConTelefono && !phone) continue;
      const citta = loopConfig.citta;
      const indirizzo = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ") || null;
      // Google Maps search URL (lets user find the GMB page and reviews)
      const gmb_url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name} ${citta}${indirizzo ? " " + indirizzo : ""}`)}`;
      rows.push({
        azienda: name, citta,
        indirizzo,
        cap: t["addr:postcode"] || null,
        telefono: phone || null, sito_web: website, email,
        lat: el.lat ?? el.center?.lat ?? null, lng: el.lon ?? el.center?.lon ?? null,
        google_categories: [t.amenity, t.shop, t.craft, t.office, t.tourism, t.healthcare, t.leisure].filter(Boolean),
        note: gmb_url,   // store GMB link in note field for table display
        fonte: "openstreetmap", stato: "nuovo",
        user_id, scraping_session_id: sessionId,
      });
      exSet.add(name);
    }

    // Bulk insert in chunks of 100
    let imported = 0;
    for (let i = 0; i < rows.length; i += 100) {
      if (isStopped.current) break;
      const { error: ie } = await supabase.from("contacts").insert(rows.slice(i, i + 100));
      if (!ie) imported += rows.slice(i, i + 100).length;
    }

    await supabase.from("scraping_sessions").update({
      status: "completed", completed_at: new Date().toISOString(),
      totale_trovati: elements.length, totale_importati: imported, progress_percent: 100,
    }).eq("id", sessionId);

    toast.success(`Scraping completato: ${imported} contatti importati da OpenStreetMap`);
  }, [refetchSessions]);

  const runScrapingLoop = useCallback(async (sessionId: string, loopConfig: MapsConfig) => {
    let nextPageToken: string | undefined = undefined;
    isPaused.current = false;
    isStopped.current = false;
    setIsRunningLocal(true);
    try {
      while (true) {
        if (isStopped.current) break;
        while (isPaused.current && !isStopped.current) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (isStopped.current) break;

        const { data, error } = await supabase.functions.invoke("scrape-maps-page", {
          body: {
            provider: loopConfig.provider,
            session_id: sessionId,
            query: loopConfig.query,
            citta: loopConfig.citta,
            raggio_km: loopConfig.raggio,
            max_results: loopConfig.maxResults,
            next_page_token: nextPageToken || undefined,
            filtri: {
              solo_con_sito: loopConfig.soloConSito,
              solo_con_telefono: loopConfig.soloConTelefono,
              rating_min: loopConfig.ratingMin,
              recensioni_min: loopConfig.recensioniMin,
            },
          },
        });

        if (error) {
          const realMessage = data?.error || error.message || "Errore Edge Function";
          throw new Error(realMessage);
        }
        if (data?.aborted) break;
        if (data?.error) throw new Error(data.error);
        if (data?.retry) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        nextPageToken = data?.next_page_token || undefined;
        if (data?.done || !nextPageToken) {
          toast.success(`Scraping completato: ${data?.total_importati ?? 0} contatti importati`);
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      toast.error(`Errore scraping: ${message}`);
      await supabase.from("scraping_sessions")
        .update({ status: "failed", error_message: message }).eq("id", sessionId);
    } finally {
      setIsRunningLocal(false);
      refetchSessions();
    }
  }, [refetchSessions]);

  const handleStart = async () => {
    if (!config.query || !config.citta) { toast.error("Inserisci categoria e città"); return; }
    try {
      const user_id = await getCurrentUserId();
      // Snapshot config at start time
      const startConfig = { ...config };
      const filtri = {
        solo_con_sito: startConfig.soloConSito,
        solo_con_telefono: startConfig.soloConTelefono,
        rating_min: startConfig.ratingMin,
        recensioni_min: startConfig.recensioniMin,
      };
      const { data: session, error } = await supabase
        .from("scraping_sessions")
        .insert({
          user_id, tipo: startConfig.provider, query: startConfig.query, citta: startConfig.citta,
          raggio: startConfig.raggio, max_results: startConfig.maxResults, status: "pending",
          filtri,
        })
        .select().single();
      if (error) throw error;
      setActiveSessionId(session.id);
      setResults([]);
      setLastImported([]);
      toast.info("Scraping avviato...");
      if (startConfig.provider === "openstreetmap") {
        // OSM: run entirely client-side to avoid Overpass IP blocking on edge functions
        setIsRunningLocal(true);
        runOSMScrapingLocal(session.id, startConfig)
          .catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : "Errore sconosciuto";
            toast.error(`Errore scraping OSM: ${msg}`);
            supabase.from("scraping_sessions").update({ status: "failed", error_message: msg }).eq("id", session.id);
          })
          .finally(() => {
            setIsRunningLocal(false);
            refetchSessions();
            // Reload results after scraping completes (contacts are bulk-inserted at the end)
            loadResultsForSession(session.id);
          });
      } else {
        runScrapingLoop(session.id, startConfig);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Errore");
    }
  };

  const handlePause = async () => {
    if (!activeSessionId) return;
    isPaused.current = true;
    const { error } = await supabase.from("scraping_sessions").update({ status: "paused" }).eq("id", activeSessionId);
    if (error) toast.error("Errore durante la pausa");
    else toast.info("Scraping in pausa");
  };

  const handleResume = async () => {
    if (!activeSessionId) return;
    isPaused.current = false;
    const { error } = await supabase.from("scraping_sessions").update({ status: "running" }).eq("id", activeSessionId);
    if (error) toast.error("Errore durante la ripresa");
    else toast.info("Scraping ripreso");
  };

  const handleStop = () => setShowStopConfirm(true);

  const confirmStop = async () => {
    setShowStopConfirm(false);
    isStopped.current = true;
    if (activeSessionId) {
      await supabase.from("scraping_sessions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", activeSessionId);
    }
    setIsRunningLocal(false);
    toast.info("Scraping fermato — risultati parziali salvati");
    refetchSessions();
  };

  const handleLoadSession = async (sessionId: string) => {
    isStopped.current = true;
    setIsRunningLocal(false);
    setActiveSessionId(sessionId);
    await loadResultsForSession(sessionId);
  };

  const costEstimate = useMemo(() => ((config.maxResults / 1000) * 2.5).toFixed(2), [config.maxResults]);
  const isPausedState = activeSession?.status === "paused";

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      <div className="w-[380px] shrink-0 flex flex-col gap-4 overflow-y-auto pr-2">
        <div className="flex items-center gap-3">
          <Search className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">SCRAPER MAPPE</h1>
        </div>

        <MapsConfigPanel
          config={config}
          onChange={setConfig}
          costEstimate={costEstimate}
          isRunning={isRunning}
          isPaused={isPausedState}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
        />

        {activeSession && (activeSession.status === "running" || activeSession.status === "pending" || activeSession.status === "paused" || activeSession.status === "completed") && (
          <>
            <MapsProgressBox session={activeSession} />
            {lastImported.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
                <div className="terminal-header text-xs">ULTIMI IMPORTATI</div>
                {lastImported.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-primary">•</span>
                    <span className="text-foreground truncate flex-1">{c.azienda}</span>
                    {c.citta && <span className="text-muted-foreground">{c.citta}</span>}
                    {c.hasSito && <span className="text-primary" title="Con sito">🌐</span>}
                    {c.hasTel && <span className="text-info" title="Con telefono">📞</span>}
                    {!c.hasSito && !c.hasTel && <span className="text-muted-foreground" title="Solo indirizzo">📍</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <MapsPreviousSessions
          sessions={previousSessions}
          onLoad={handleLoadSession}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <MapsResultsTable
          results={results}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          sessionId={activeSessionId}
          totalFound={activeSession?.totale_trovati || results.length}
          duplicates={activeSession ? (activeSession.totale_trovati - activeSession.totale_importati) : 0}
        />
      </div>

      <AlertDialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fermare lo scraping?</AlertDialogTitle>
            <AlertDialogDescription>
              Lo scraping verrà interrotto. I risultati già importati verranno mantenuti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStop} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
