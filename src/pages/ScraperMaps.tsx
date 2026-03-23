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

    // Build Overpass clauses: prefer indexed tag clauses; fall back to regex name search
    const tagClauses: string[] = [];
    for (const [key, clauses] of Object.entries(OSM_TAG_MAP)) {
      if (ql.includes(key) || key.includes(ql.replace(/i$/, "")) || key.startsWith(ql.slice(0, 6))) {
        tagClauses.push(...clauses.map((c) => `nwr${c}(around:${r},${lat},${lon})`));
      }
    }
    // Use tag clauses only when available (indexed, fast). Name regex is a full-scan and can timeout.
    const allClauses = tagClauses.length > 0
      ? [...new Set(tagClauses)]
      : [`nwr["name"~"${sq}",i](around:${r},${lat},${lon})`];
    const ovQ = `[out:json][timeout:60];(${allClauses.join(";")};);out body center ${lim};`;

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
    const useTagSearch = tagClauses.length > 0;

    // In-memory filter: if tag-based search, accept all (Overpass already filtered);
    // if name-only, require name match
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates = elements.filter((el: any) => {
      const t = el.tags || {}; if (!t.name) return false;
      if (useTagSearch) return true; // tag search already targeted correct category
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
