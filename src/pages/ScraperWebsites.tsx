import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Globe, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { WebScraperQueue } from "@/components/scraper/WebScraperQueue";
import { WebScraperResults } from "@/components/scraper/WebScraperResults";
import { WebScraperDetailModal } from "@/components/scraper/WebScraperDetailModal";
import { WebScraperPreviousSessions } from "@/components/scraper/WebScraperPreviousSessions";
import { triggerN8nWebhook, getN8nSettings, checkN8nHealth } from "@/services/n8n";
import { useScrapingSessions } from "@/hooks/useScrapingSession";
import { toast } from "sonner";
import type { ScrapingSession, ScrapingJob, Contact } from "@/types";
import { Button } from "@/components/ui/button";
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

/** Check if an error is a network error */
function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("network") || msg.includes("fetch") || msg.includes("econnaborted") || msg.includes("failed to fetch") || err.code === "ECONNABORTED";
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

  const { sessions: allSessions } = useScrapingSessions();

  // Derive isPausing: session is paused but some jobs are still processing
  const isPausing = useMemo(() => {
    return session?.status === "paused" && jobs.some((j) => j.status === "processing");
  }, [session, jobs]);

  // Derive isPaused (fully paused, no processing jobs left)
  const isPaused = useMemo(() => {
    return session?.status === "paused" && !jobs.some((j) => j.status === "processing");
  }, [session, jobs]);

  // Subscribe to session + jobs updates with debounced job batching
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    const jobBuffer = new Map<string, ScrapingJob>();
    const newJobBuffer: ScrapingJob[] = [];
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushJobUpdates = () => {
      if (cancelled) return;
      flushTimer = null;
      const updates = new Map(jobBuffer);
      const inserts = [...newJobBuffer];
      jobBuffer.clear();
      newJobBuffer.length = 0;

      if (updates.size > 0 || inserts.length > 0) {
        setJobs((prev) => {
          let next = prev;
          if (updates.size > 0) {
            next = next.map((j) => updates.has(j.id) ? updates.get(j.id)! : j);
          }
          if (inserts.length > 0) {
            const existingIds = new Set(next.map((j) => j.id));
            const truly = inserts.filter((j) => !existingIds.has(j.id));
            if (truly.length > 0) next = [...next, ...truly];
          }
          return next;
        });
      }
    };

    const scheduleFlush = () => {
      if (flushTimer) return;
      flushTimer = setTimeout(flushJobUpdates, 300);
    };

    const channel = supabase
      .channel(`web-session-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "scraping_sessions", filter: `id=eq.${sessionId}` },
        (payload) => { if (!cancelled) setSession(payload.new as unknown as ScrapingSession); }
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "scraping_jobs", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (cancelled) return;
          if (payload.eventType === "INSERT") {
            newJobBuffer.push(payload.new as unknown as ScrapingJob);
          } else if (payload.eventType === "UPDATE") {
            const job = payload.new as unknown as ScrapingJob;
            jobBuffer.set(job.id, job);
          }
          scheduleFlush();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (flushTimer) clearTimeout(flushTimer);
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Derive running state
  useEffect(() => {
    setIsRunning(session?.status === "running" || session?.status === "pending");
  }, [session]);

  // Optimize: only re-fetch contacts when completed job IDs change
  const completedJobContactIds = useMemo(() => {
    const completed = jobs.filter((j) => j.status === "completed" && j.contact_id);
    return [...new Set(completed.map((j) => j.contact_id))].sort().join(",");
  }, [jobs]);

  // Fetch contacts with cancelled flag to prevent state update after unmount
  useEffect(() => {
    if (!completedJobContactIds) return;
    let cancelled = false;
    const contactIds = completedJobContactIds.split(",");
    const completedJobs = jobs.filter((j) => j.status === "completed" && j.contact_id);

    supabase
      .from("contacts")
      .select("*")
      .in("id", contactIds)
      .limit(1000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          if (isNetworkError(error)) {
            toast.error("Errore di rete nel caricamento contatti", {
              action: { label: "Riprova", onClick: () => {} }, // re-trigger handled by dep change
            });
          }
          return;
        }
        if (data) {
          const contacts = (data as unknown as Contact[]).map((c) => ({
            ...c,
            _jobs: completedJobs.filter((j) => j.contact_id === c.id),
          }));
          setEnrichedContacts(contacts);
        }
      });

    return () => { cancelled = true; };
  }, [completedJobContactIds]);

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

  const handleImportFromMaps = async () => {
    const userId = await getCurrentUserId();
    let query = supabase
      .from("contacts")
      .select("id, sito_web")
      .eq("user_id", userId)
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
    const userId = await getCurrentUserId();
    const { data } = await supabase
      .from("contacts")
      .select("id, sito_web")
      .eq("user_id", userId)
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

    let createdSessionId: string | null = null;
    try {
      const user_id = await getCurrentUserId();

      // Try n8n first, fallback to edge function
      let useEdgeFunction = false;
      let n8nSettings: Record<string, string> = {};

      const n8nOk = await checkN8nHealth();
      if (n8nOk) {
        n8nSettings = await getN8nSettings();
      } else {
        useEdgeFunction = true;
      }

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

      // Find matching contacts for URLs (with user_id filter)
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, sito_web")
        .eq("user_id", user_id)
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

      if (useEdgeFunction) {
        await toast.promise(
          supabase.functions.invoke("scrape-website", {
            body: {
              session_id: sess.id,
              urls: urls.map((u) => (u.startsWith("http") ? u : `https://${u}`)),
              config: {
                timeout_sec: config.timeoutSec,
                delay_ms: config.delayMs,
                max_retries: config.maxRetries,
                crawl_depth: config.crawlDepth,
                search_pages: config.searchPages,
              },
            },
          }),
          {
            loading: "Avvio scraping siti (modalità autonoma)...",
            success: "Scraping completato!",
            error: (err) => `Errore: ${err.message}`,
          }
        );
      } else {
        const webhookPath = n8nSettings.n8n_webhook_scrape_websites || "/webhook/scrape-websites";
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
      }
    } catch (err: any) {
      if (isNetworkError(err)) {
        toast.error("Errore di rete. Verifica la connessione.", {
          action: { label: "Riprova", onClick: () => handleStart() },
        });
      } else {
        toast.error(err.message || "Errore avvio scraping");
      }
      if (createdSessionId) {
        await supabase.from("scraping_sessions").update({ status: "failed", error_message: err.message }).eq("id", createdSessionId);
      }
    }
  };

  const handlePause = async () => {
    if (!sessionId) return;
    const { error } = await supabase.from("scraping_sessions").update({ status: "paused", paused_at: new Date().toISOString() }).eq("id", sessionId);
    if (error) toast.error("Errore durante la pausa");
    else toast.info("Scraping in pausa", { duration: 5000 });
  };

  const handleResume = async () => {
    if (!sessionId) return;
    try {
      // Reset stale "processing" jobs (stuck for >2 min) back to "queued"
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      await supabase
        .from("scraping_jobs")
        .update({ status: "queued", error_message: null, updated_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("status", "processing")
        .lt("updated_at", twoMinAgo);

      // Update session to running
      await supabase.from("scraping_sessions").update({
        status: "running",
        resumed_at: new Date().toISOString(),
      }).eq("id", sessionId);

      // Re-invoke the edge function with same session_id (it will pick up queued jobs)
      await supabase.functions.invoke("scrape-website", {
        body: {
          session_id: sessionId,
          urls: [],
          config: {
            timeout_sec: config.timeoutSec,
            delay_ms: config.delayMs,
            max_retries: config.maxRetries,
            crawl_depth: config.crawlDepth,
            search_pages: config.searchPages,
          },
        },
      });

      toast.success("Scraping ripreso!");
    } catch (err: any) {
      if (isNetworkError(err)) {
        toast.error("Errore di rete. Verifica la connessione.", {
          action: { label: "Riprova", onClick: () => handleResume() },
        });
      } else {
        toast.error(err.message || "Errore ripresa scraping");
      }
    }
  };

  const handleStop = async () => {
    setShowStopConfirm(true);
  };

  const confirmStop = async () => {
    setShowStopConfirm(false);
    if (!sessionId) return;

    // Set session as completed with interrupted_at
    const { error } = await supabase.from("scraping_sessions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      interrupted_at: new Date().toISOString(),
    }).eq("id", sessionId);

    if (error) {
      toast.error("Errore durante lo stop");
      return;
    }

    // Reset remaining processing/queued jobs
    await supabase.from("scraping_jobs")
      .update({ status: "failed", error_message: "Fermato dall'utente", updated_at: new Date().toISOString() })
      .eq("session_id", sessionId)
      .in("status", ["processing", "queued"]);

    toast.info("Scraping fermato");
  };

  const handleRetryJob = async (job: ScrapingJob) => {
    await supabase.from("scraping_jobs").update({ status: "queued", error_message: null, tentativo: (job.tentativo || 1) + 1 }).eq("id", job.id);
    toast.info(`Riprova: ${job.url}`);
    try {
      await supabase.functions.invoke("scrape-website", {
        body: {
          session_id: job.session_id,
          urls: [job.url],
          retry_job_id: job.id,
        },
      });
    } catch (err: any) {
      if (isNetworkError(err)) {
        toast.error("Errore di rete. Verifica la connessione.", {
          action: { label: "Riprova", onClick: () => handleRetryJob(job) },
        });
      } else {
        toast.error(`Errore retry: ${err.message}`);
      }
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

  const handleLoadPreviousSession = async (prevSessionId: string) => {
    setSessionId(prevSessionId);
    const { data: sessData } = await supabase
      .from("scraping_sessions")
      .select("*")
      .eq("id", prevSessionId)
      .maybeSingle();
    if (sessData) setSession(sessData as unknown as ScrapingSession);

    const { data: jobsData } = await supabase
      .from("scraping_jobs")
      .select("*")
      .eq("session_id", prevSessionId)
      .limit(1000);
    if (jobsData) setJobs(jobsData as unknown as ScrapingJob[]);
    toast.success("Sessione caricata");
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
          isPausing={isPausing}
          isPaused={isPaused}
          onResume={handleResume}
          stats={queueStats}
        />

        <WebScraperPreviousSessions
          sessions={allSessions}
          onLoad={handleLoadPreviousSession}
        />
      </div>

      {/* Right — Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Memory warning banner */}
        {enrichedContacts.length > 1000 && (
          <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 mb-3 text-xs text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {enrichedContacts.length.toLocaleString()} contatti in memoria. Esporta i risultati o filtra per migliorare le prestazioni.
            </span>
          </div>
        )}
        <WebScraperResults
          enrichedContacts={enrichedContacts}
          jobs={jobs}
          onDetailClick={handleShowDetail}
        />
      </div>

      {/* Detail modal */}
      <WebScraperDetailModal
        job={detailJob}
        contact={detailContact}
        open={!!detailJob}
        onOpenChange={(open) => { if (!open) { setDetailJob(null); setDetailContact(null); } }}
      />

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
