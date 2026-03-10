import { useState, useMemo, useEffect } from "react";
import { Search, Play, Pause, Square, Download, ListPlus, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { triggerN8nWebhook, getN8nSettings, checkN8nHealth } from "@/services/n8n";
import { useScrapingSession, useScrapingSessions } from "@/hooks/useScrapingSession";
import { MapsConfigPanel } from "@/components/scraper/MapsConfigPanel";
import { MapsProgressBox } from "@/components/scraper/MapsProgressBox";
import { MapsResultsTable } from "@/components/scraper/MapsResultsTable";
import { MapsPreviousSessions } from "@/components/scraper/MapsPreviousSessions";
import { toast } from "sonner";
import type { Contact, ScrapingSession } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface MapsConfig {
  query: string;
  citta: string[];
  raggio: number;
  maxResults: number;
  soloConSito: boolean;
  soloConTelefono: boolean;
  ratingMin: number;
  recensioniMin: number;
}

export default function ScraperMapsPage() {
  const [config, setConfig] = useState<MapsConfig>({
    query: "",
    citta: [],
    raggio: 25,
    maxResults: 1000,
    soloConSito: true,
    soloConTelefono: false,
    ratingMin: 0,
    recensioniMin: 0,
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [results, setResults] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [lastImported, setLastImported] = useState<{ azienda: string; citta: string | null; hasSito: boolean; hasTel: boolean }[]>([]);

  const activeSession = useScrapingSession(activeSessionId);
  const { sessions: previousSessions, refetch: refetchSessions, hasMore, loadMore } = useScrapingSessions();

  const isRunning = activeSession?.status === "running";
  const isPending = activeSession?.status === "pending";

  // Load results for active session (filtered by scraping_session_id)
  useEffect(() => {
    if (!activeSessionId) return;

    const loadResults = async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("scraping_session_id", activeSessionId)
        .order("created_at", { ascending: false })
        .limit(5000);
      setResults((data as unknown as Contact[]) || []);
    };

    loadResults();

    // Subscribe to new contacts for this session only
    const channel = supabase
      .channel(`new-contacts-${activeSessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "contacts",
          filter: `scraping_session_id=eq.${activeSessionId}`,
        },
        (payload) => {
          const c = payload.new as unknown as Contact;
          setResults((prev) => [c, ...prev]);
          setLastImported((prev) => [
            { azienda: c.azienda, citta: c.citta, hasSito: !!c.sito_web, hasTel: !!c.telefono },
            ...prev,
          ].slice(0, 5));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSessionId]);

  const handleStart = async () => {
    if (!config.query || !config.citta) {
      toast.error("Inserisci categoria e città");
      return;
    }

    // Check n8n health first
    const n8nOk = await checkN8nHealth();
    if (!n8nOk) {
      toast.error("n8n non raggiungibile. Verifica la connessione in Impostazioni → API Keys.", {
        duration: 6000,
        action: { label: "Impostazioni", onClick: () => window.location.assign("/settings") },
      });
      return;
    }

    try {
      // Create session in DB
      const { data: session, error } = await supabase
        .from("scraping_sessions")
        .insert({
          tipo: "google_maps",
          query: config.query,
          citta: config.citta,
          raggio: config.raggio,
          max_results: config.maxResults,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      setActiveSessionId(session.id);

      // Get n8n settings
      const settings = await getN8nSettings();
      const webhookPath = settings.n8n_webhook_scrape_maps || "/webhook/scrape-maps";

      // Trigger n8n
      await toast.promise(
        triggerN8nWebhook(webhookPath, {
          session_id: session.id,
          query: config.query,
          citta: config.citta,
          raggio_km: config.raggio,
          max_results: config.maxResults,
          filtri: {
            solo_con_sito: config.soloConSito,
            solo_con_telefono: config.soloConTelefono,
            rating_min: config.ratingMin,
            recensioni_min: config.recensioniMin,
          },
        }),
        {
          loading: "Avvio job scraping su n8n...",
          success: "Job avviato! Monitoraggio in corso.",
          error: (err) => `Errore: ${err.message}`,
        }
      );

      refetchSessions();
    } catch (err: any) {
      toast.error(err.message || "Errore avvio scraping");
      // Cleanup: mark session as failed if it was created
      if (activeSessionId) {
        await supabase.from("scraping_sessions").update({ status: "failed", error_message: err.message }).eq("id", activeSessionId);
      }
    }
  };

  const handlePause = async () => {
    if (!activeSessionId) return;
    await supabase
      .from("scraping_sessions")
      .update({ status: "paused" })
      .eq("id", activeSessionId);
    toast.info("Scraping in pausa — n8n verificherà lo stato al prossimo ciclo e si fermerà automaticamente.", { duration: 5000 });
  };

  const handleStop = async () => {
    setShowStopConfirm(true);
  };

  const confirmStop = async () => {
    setShowStopConfirm(false);
    if (!activeSessionId) return;
    await supabase
      .from("scraping_sessions")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", activeSessionId);
    toast.info("Scraping fermato");
    refetchSessions();
  };

  const handleLoadSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    const { data } = await supabase
      .from("contacts")
      .select("*")
      .eq("scraping_session_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(5000);
    setResults((data as unknown as Contact[]) || []);
  };

  const costEstimate = useMemo(() => {
    // Google Places: ~$0.032 per Text Search + $0.017 per Place Details
    // Approx €0.045 per result → €2.50 per 1000
    const costPer1000 = 2.5;
    return ((config.maxResults / 1000) * costPer1000).toFixed(2);
  }, [config.maxResults]);

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left panel — Config */}
      <div className="w-[380px] shrink-0 flex flex-col gap-4 overflow-y-auto pr-2">
        <div className="flex items-center gap-3">
          <Search className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">SCRAPER GOOGLE MAPS</h1>
        </div>

        <MapsConfigPanel
          config={config}
          onChange={setConfig}
          costEstimate={costEstimate}
          isRunning={isRunning || isPending}
          onStart={handleStart}
          onPause={handlePause}
          onStop={handleStop}
        />

        {/* Progress box */}
        {activeSession && (activeSession.status === "running" || activeSession.status === "pending") && (
          <>
            <MapsProgressBox session={activeSession} />
            {/* Live feed */}
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

        {/* Previous sessions */}
        <MapsPreviousSessions
          sessions={previousSessions}
          onLoad={handleLoadSession}
          hasMore={hasMore}
          onLoadMore={loadMore}
        />
      </div>

      {/* Right panel — Results */}
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

      {/* Stop confirmation dialog */}
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
