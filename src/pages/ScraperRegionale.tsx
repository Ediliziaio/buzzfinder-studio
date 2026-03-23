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
  ristorante: ['["amenity"="restaurant"]', '["amenity"="fast_food"]'],
  trattoria: ['["amenity"="restaurant"]'],
  osteria: ['["amenity"="restaurant"]'],
  pizzeria: ['["amenity"="restaurant"]'],
  bar: ['["amenity"="bar"]', '["amenity"="cafe"]'],
  caffè: ['["amenity"="cafe"]'],
  caffe: ['["amenity"="cafe"]'],
  hotel: ['["tourism"="hotel"]', '["tourism"="guest_house"]'],
  albergo: ['["tourism"="hotel"]'],
  farmacia: ['["amenity"="pharmacy"]'],
  dentista: ['["amenity"="dentist"]'],
  medico: ['["amenity"="doctors"]', '["amenity"="clinic"]'],
  clinica: ['["amenity"="clinic"]'],
  banca: ['["amenity"="bank"]'],
  idraulico: ['["craft"="plumber"]'],
  idraulici: ['["craft"="plumber"]'],
  elettricista: ['["craft"="electrician"]'],
  elettricisti: ['["craft"="electrician"]'],
  parrucchiere: ['["shop"="hairdresser"]'],
  parrucchieri: ['["shop"="hairdresser"]'],
  estetista: ['["shop"="beauty"]'],
  estetiste: ['["shop"="beauty"]'],
  supermercato: ['["shop"="supermarket"]'],
  ferramenta: ['["shop"="hardware"]'],
  falegname: ['["craft"="carpenter"]'],
  falegnami: ['["craft"="carpenter"]'],
  falegnamerie: ['["craft"="carpenter"]'],
  geometra: ['["office"="surveyor"]'],
  geometri: ['["office"="surveyor"]'],
  avvocato: ['["office"="lawyer"]'],
  avvocati: ['["office"="lawyer"]'],
  commercialista: ['["office"="accountant"]'],
  commercialisti: ['["office"="accountant"]'],
  serramentist: ['["craft"="window_construction"]', '["shop"="doors"]'],
  'imprese edil': ['["craft"="construction"]'],
  muratore: ['["craft"="mason"]'],
  muratori: ['["craft"="mason"]'],
  panificio: ['["shop"="bakery"]'],
  panetteria: ['["shop"="bakery"]'],
  forno: ['["shop"="bakery"]'],
  pasticceria: ['["shop"="pastry"]'],
  gelateria: ['["shop"="ice_cream"]'],
  ottico: ['["shop"="optician"]'],
  ottici: ['["shop"="optician"]'],
  veterinario: ['["amenity"="veterinary"]'],
  veterinari: ['["amenity"="veterinary"]'],
  meccanico: ['["shop"="car_repair"]'],
  officina: ['["shop"="car_repair"]'],
  gommista: ['["shop"="tyres"]'],
  gommisti: ['["shop"="tyres"]'],
  libreria: ['["shop"="books"]'],
  abbigliamento: ['["shop"="clothes"]'],
  scarpe: ['["shop"="shoes"]'],
  gioielleria: ['["shop"="jewelry"]'],
  gioiellerie: ['["shop"="jewelry"]'],
  fiorista: ['["shop"="florist"]'],
  fioristi: ['["shop"="florist"]'],
  profumeria: ['["shop"="perfumery"]'],
  profumerie: ['["shop"="perfumery"]'],
  fisioterapist: ['["healthcare"="physiotherapist"]'],
  impresa: ['["craft"="construction"]'],
  notaio: ['["office"="notary"]'],
  notai: ['["office"="notary"]'],
  psicologo: ['["healthcare"="psychotherapist"]'],
  psicologi: ['["healthcare"="psychotherapist"]'],
  palestra: ['["leisure"="fitness_centre"]'],
  palestre: ['["leisure"="fitness_centre"]'],
  piscina: ['["leisure"="swimming_pool"]'],
  piscine: ['["leisure"="swimming_pool"]'],
  autolavaggio: ['["amenity"="car_wash"]'],
  fotografia: ['["shop"="photo"]'],
  fotografo: ['["shop"="photo"]'],
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Settlement {
  name: string;
  lat: number;
  lon: number;
  region: string;
}

// ─── Overpass helpers ─────────────────────────────────────────────────────────

async function fetchSettlements(
  regions: string[],
  minTypes: string[]
): Promise<Settlement[]> {
  const results: Settlement[] = [];
  for (const region of regions) {
    const osmName = OSM_REGION_NAMES[region] || region;
    const placeTypes = minTypes
      .map((t) => `node["place"="${t}"](area.r);`)
      .join("\n");
    const q = `[out:json][timeout:120];area["name"="${osmName}"]["admin_level"="4"]->.r;(${placeTypes});out center 5000;`;

    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(q)}`,
    });
    if (!res.ok) throw new Error(`Overpass error ${res.status} per ${region}`);
    const data = await res.json();
    for (const el of data.elements || []) {
      if (el.tags?.name) {
        results.push({
          name: el.tags.name,
          lat: el.lat ?? el.center?.lat,
          lon: el.lon ?? el.center?.lon,
          region,
        });
      }
    }
  }
  return results;
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function ScraperRegionalePage() {
  // Config state
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [maxPerCity, setMaxPerCity] = useState(50);
  const [delayBetweenCities, setDelayBetweenCities] = useState(2000);
  const [minPlaceType, setMinPlaceType] = useState<string[]>(["city", "town", "village"]);

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
      const { lat, lon, name } = settlement;
      const r = 5000; // 5 km radius
      const ql = kw.toLowerCase();

      // Build Overpass tag clauses
      const tagClauses: string[] = [];
      for (const [key, clauses] of Object.entries(OSM_TAG_MAP)) {
        if (
          ql.includes(key) ||
          key.includes(ql.replace(/i$/, "")) ||
          key.startsWith(ql.slice(0, 6))
        ) {
          tagClauses.push(
            ...clauses.map((c) => `nwr${c}(around:${r},${lat},${lon})`)
          );
        }
      }
      const sq = kw.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      const allClauses =
        tagClauses.length > 0
          ? [...new Set(tagClauses)]
          : [`nwr["name"~"${sq}",i](around:${r},${lat},${lon})`];
      const lim = Math.min(max, 1000);
      const ovQ = `[out:json][timeout:30];(${allClauses.join(";")};);out body center ${lim};`;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async function tryOv(url: string): Promise<any> {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(ovQ)}`,
        });
        if (!res.ok) throw new Error(`${url} ${res.status}`);
        return res.json();
      }

      let ovData;
      try {
        ovData = await Promise.any([
          tryOv("https://overpass-api.de/api/interpreter"),
          tryOv("https://overpass.kumi.systems/api/interpreter"),
        ]);
      } catch {
        // If both fail, skip this city
        return { imported: 0, withEmail: 0 };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elements: any[] = ovData?.elements || [];
      const useTagSearch = tagClauses.length > 0;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const candidates = elements
        .filter((el: any) => {
          const t = el.tags || {};
          if (!t.name) return false;
          if (useTagSearch) return true;
          return t.name.toLowerCase().includes(ql);
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
        const { error: ie } = await supabase.from("contacts").insert(rows.slice(i, i + 100));
        if (!ie) imported += rows.slice(i, i + 100).length;
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
          raggio: 5,
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
        fetchedSettlements = await fetchSettlements(selectedRegions, minPlaceType);
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
      const finalStatus = isStopped.current ? "completed" : "completed";
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
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedRegions([...ITALIAN_REGIONS])}
              className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              disabled={isRunning}
            >
              Seleziona tutto
            </button>
            <button
              onClick={() => setSelectedRegions([])}
              className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary transition-colors"
              disabled={isRunning}
            >
              Deseleziona tutto
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
              {[50, 100, 200, 500].map((v) => (
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
                  {v}
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
                { label: "2s", value: 2000 },
                { label: "3s", value: 3000 },
                { label: "5s", value: 5000 },
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
                { key: "city", label: "Città" },
                { key: "town", label: "Comune / Town" },
                { key: "village", label: "Paese / Village" },
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
