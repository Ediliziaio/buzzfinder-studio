import { useState, useEffect, useCallback, useRef } from "react";
import { Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { WebScraperQueue } from "@/components/scraper/WebScraperQueue";
import { WebScraperResults } from "@/components/scraper/WebScraperResults";
import { WebScraperDetailModal } from "@/components/scraper/WebScraperDetailModal";
import { triggerN8nWebhook, getN8nSettings, checkN8nHealth } from "@/services/n8n";
import { useScrapingSessions } from "@/hooks/useScrapingSession";
import { toast } from "sonner";
import type { ScrapingSession, ScrapingJob, Contact } from "@/types";
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

export interface WebScraperConfig {
  timeoutSec: number;
  delayMs: number;
  maxRetries: number;
  crawlDepth: "homepage" | "homepage_contacts";
  searchPages: { contatti: boolean; chiSiamo: boolean; tutte: boolean };
}

/** Normalize URL for dedup comparison */
function normalizeUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "").toLowerCase();
}

export default function ScraperWebsitesPage() {
  const [config, setConfig] = useState<WebScraperConfig>({
    timeoutSec: 15,
    delayMs: 1500,
    maxRetries: 2,
    crawlDepth: "homepage_contacts",
    searchPages: { contatti: true, chiSiamo: true, tutte: false },
  });

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<ScrapingSession | null>(null);
  const [jobs, setJobs] = useState<ScrapingJob[]>([]);
  const [enrichedContacts, setEnrichedContacts] = useState<(Contact & { _jobs?: ScrapingJob[] })[]>([]);
  const [detailJob, setDetailJob] = useState<ScrapingJob | null>(null);
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [urls, setUrls] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  // Subscribe to session updates
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`web-session-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "scraping_sessions", filter: `id=eq.${sessionId}` },
        (payload) => setSession(payload.new as unknown as ScrapingSession)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "scraping_jobs", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setJobs((prev) => [...prev, payload.new as unknown as ScrapingJob]);
          } else if (payload.eventType === "UPDATE") {
            setJobs((prev) => prev.map((j) => j.id === (payload.new as any).id ? payload.new as unknown as ScrapingJob : j));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // Derive running state
  useEffect(() => {
    setIsRunning(session?.status === "running" || session?.status === "pending");
  }, [session]);

  // Load enriched contacts when jobs complete
  useEffect(() => {
    const completedJobs = jobs.filter((j) => j.status === "completed" && j.contact_id);
    if (completedJobs.length === 0) return;
    const contactIds = [...new Set(completedJobs.map((j) => j.contact_id))];
    supabase
      .from("contacts")
      .select("*")
      .in("id", contactIds)
      .limit(1000)
      .then(({ data }) => {
        if (data) {
          const contacts = (data as unknown as Contact[]).map((c) => ({
            ...c,
            _jobs: completedJobs.filter((j) => j.contact_id === c.id),
          }));
          setEnrichedContacts(contacts);
        }
      });
  }, [jobs]);

  const handleAddUrls = (newUrls: string[]) => {
    setUrls((prev) => {
      const existingNormalized = new Set(prev.map(normalizeUrl));
      const unique = newUrls.filter((u) => {
        if (!u) return false;
        const norm = normalizeUrl(u);
        if (existingNormalized.has(norm)) return false;
        existingNormalized.add(norm);
        return true;
      });
      return [...prev, ...unique];
    });
  };

  const [mapsSessionIdForImport, setMapsSessionIdForImport] = useState<string | null>(null);
  const { sessions: mapsSessions } = useScrapingSessions();

  const handleImportFromMaps = async () => {
    let query = supabase
      .from("contacts")
      .select("id, sito_web")
      .not("sito_web", "is", null)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (mapsSessionIdForImport) {
      query = query.eq("scraping_session_id", mapsSessionIdForImport);
    } else {
      query = query.eq("fonte", "google_maps");
    }

    const { data } = await query;
    if (data) {
      const newUrls = data.map((c) => c.sito_web!).filter(Boolean);
      handleAddUrls(newUrls);
      toast.success(`${newUrls.length} URL importati${mapsSessionIdForImport ? " dalla sessione selezionata" : " da Maps"}`);
    }
  };

  const handleImportFromContacts = async () => {
    const { data } = await supabase
      .from("contacts")
      .select("id, sito_web")
      .not("sito_web", "is", null)
      .is("email", null)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data) {
      const newUrls = data.map((c) => c.sito_web!).filter(Boolean);
      handleAddUrls(newUrls);
      toast.success(`${newUrls.length} URL importati (contatti senza email)`);
    }
  };

  const handleStart = async () => {
    if (urls.length === 0) {
      toast.error("Nessun URL in coda");
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

    let createdSessionId: string | null = null;
    try {
      const user_id = await getCurrentUserId();
      // Create session
      const { data: sess, error } = await supabase
        .from("scraping_sessions")
        .insert({
          user_id,
          tipo: "website",
          status: "pending",
          max_results: urls.length,
        })
        .select()
        .single();
      if (error) throw error;
      createdSessionId = sess.id;
      setSessionId(sess.id);
      setSession(sess as unknown as ScrapingSession);

      // Find matching contacts for URLs (with limit)
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, sito_web")
        .not("sito_web", "is", null)
        .limit(1000);

      const contactMap = new Map<string, string>();
      contacts?.forEach((c) => {
        if (c.sito_web) {
          contactMap.set(normalizeUrl(c.sito_web), c.id);
        }
      });

      // Create jobs
      const jobInserts = urls.map((url) => {
        const fullUrl = url.startsWith("http") ? url : `https://${url}`;
        return {
          session_id: sess.id,
          url: fullUrl,
          contact_id: contactMap.get(normalizeUrl(url)) || null,
          status: "queued" as const,
        };
      });

      await supabase.from("scraping_jobs").insert(jobInserts);

      // Trigger n8n
      const settings = await getN8nSettings();
      const webhookPath = settings.n8n_webhook_scrape_websites || "/webhook/scrape-websites";

      await toast.promise(
        triggerN8nWebhook(webhookPath, {
          session_id: sess.id,
          urls: urls.map((u) => (u.startsWith("http") ? u : `https://${u}`)),
          config: {
            timeout_sec: config.timeoutSec,
            delay_ms: config.delayMs,
            max_retries: config.maxRetries,
            crawl_depth: config.crawlDepth,
            search_pages: config.searchPages,
          },
        }),
        {
          loading: "Avvio scraping siti su n8n...",
          success: "Job avviato!",
          error: (err) => `Errore: ${err.message}`,
        }
      );
    } catch (err: any) {
      toast.error(err.message || "Errore avvio scraping");
      // Cleanup: mark session as failed using the local variable (not stale state)
      if (createdSessionId) {
        await supabase.from("scraping_sessions").update({ status: "failed", error_message: err.message }).eq("id", createdSessionId);
      }
    }
  };

  const handlePause = async () => {
    if (!sessionId) return;
    const { error } = await supabase.from("scraping_sessions").update({ status: "paused" }).eq("id", sessionId);
    if (error) toast.error("Errore durante la pausa");
    else toast.info("Scraping in pausa — n8n verificherà lo stato al prossimo ciclo e si fermerà automaticamente.", { duration: 5000 });
  };

  const handleStop = async () => {
    setShowStopConfirm(true);
  };

  const confirmStop = async () => {
    setShowStopConfirm(false);
    if (!sessionId) return;
    const { error } = await supabase.from("scraping_sessions").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", sessionId);
    if (error) toast.error("Errore durante lo stop");
    else toast.info("Scraping fermato");
  };

  const handleRetryJob = async (job: ScrapingJob) => {
    await supabase.from("scraping_jobs").update({ status: "queued", error_message: null, tentativo: (job.tentativo || 1) + 1 }).eq("id", job.id);
    toast.info(`Riprova: ${job.url}`);
    // Re-trigger n8n for single job retry
    try {
      const settings = await getN8nSettings();
      const webhookPath = settings.n8n_webhook_scrape_websites || "/webhook/scrape-websites";
      await triggerN8nWebhook(webhookPath, {
        session_id: job.session_id,
        urls: [job.url],
        retry_job_id: job.id,
      });
    } catch (err: any) {
      toast.error(`Errore retry: ${err.message}`);
    }
  };

  const handleClearQueue = () => {
    setUrls([]);
    toast.info("Coda svuotata");
  };

  const handleShowDetail = (job: ScrapingJob) => {
    setDetailJob(job);
    if (job.contact_id) {
      supabase.from("contacts").select("*").eq("id", job.contact_id).maybeSingle().then(({ data }) => {
        setDetailContact(data as unknown as Contact);
      });
    }
  };

  const queueStats = {
    queued: jobs.filter((j) => j.status === "queued").length + (isRunning ? 0 : urls.length),
    processing: jobs.filter((j) => j.status === "processing").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left — Queue */}
      <div className="w-[400px] shrink-0 flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">SCRAPER SITI WEB</h1>
        </div>

        <WebScraperQueue
          urls={urls}
          jobs={jobs}
          config={config}
          onConfigChange={setConfig}
          onAddUrls={handleAddUrls}
          onImportFromMaps={handleImportFromMaps}
          onImportFromContacts={handleImportFromContacts}
          onStart={handleStart}
          onPause={handlePause}
          onStop={handleStop}
          onClearQueue={handleClearQueue}
          onJobClick={handleShowDetail}
          onRetryJob={handleRetryJob}
          isRunning={isRunning}
          stats={queueStats}
        />
      </div>

      {/* Right — Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <WebScraperResults
          enrichedContacts={enrichedContacts}
          jobs={jobs}
          onDetailClick={handleShowDetail}
        />
      </div>

      {/* Detail modal */}
      {detailJob && (
        <WebScraperDetailModal
          job={detailJob}
          contact={detailContact}
          onClose={() => { setDetailJob(null); setDetailContact(null); }}
        />
      )}
      {/* Stop confirmation dialog */}
      <AlertDialog open={showStopConfirm} onOpenChange={setShowStopConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fermare lo scraping?</AlertDialogTitle>
            <AlertDialogDescription>
              Lo scraping verrà interrotto. I risultati già elaborati verranno mantenuti.
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
