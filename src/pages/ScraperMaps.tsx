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
    query: "",
    citta: "",
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
  const { sessions: previousSessions, refetch: refetchSessions } = useScrapingSessions();

  const isRunning = activeSession?.status === "running";
  const isPending = activeSession?.status === "pending";

  // Load results for active session
  useEffect(() => {
    if (!activeSessionId) return;

    const loadResults = async () => {
      const { data } = await supabase
        .from("contacts")
        .select("*")
        .eq("fonte", "google_maps")
        .order("created_at", { ascending: false })
        .limit(5000);
      setResults((data as unknown as Contact[]) || []);
    };

    loadResults();

    // Subscribe to new contacts
    const channel = supabase
      .channel("new-contacts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contacts" },
        (payload) => {
          setResults((prev) => [payload.new as unknown as Contact, ...prev]);
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
          supabase_url: import.meta.env.VITE_SUPABASE_URL,
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
    }
  };

  const handlePause = async () => {
    if (!activeSessionId) return;
    await supabase
      .from("scraping_sessions")
      .update({ status: "paused" })
      .eq("id", activeSessionId);
    toast.info("Scraping in pausa");
  };

  const handleStop = async () => {
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
      .eq("fonte", "google_maps")
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
          <MapsProgressBox session={activeSession} />
        )}

        {/* Previous sessions */}
        <MapsPreviousSessions
          sessions={previousSessions}
          onLoad={handleLoadSession}
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
    </div>
  );
}
