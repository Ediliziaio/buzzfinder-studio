import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Globe, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { WebScraperQueue } from "@/components/scraper/WebScraperQueue";
import { WebScraperResults } from "@/components/scraper/WebScraperResults";
import { WebScraperDetailModal } from "@/components/scraper/WebScraperDetailModal";
import { WebScraperPreviousSessions } from "@/components/scraper/WebScraperPreviousSessions";
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
// deno-lint-ignore no-explicit-any
function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || "").toLowerCase();
  return msg.includes("network") || msg.includes("fetch") || msg.includes("econnaborted") || msg.includes("failed to fetch") || err.code === "ECONNABORTED";
}

export default function ScraperWebsitesPage() {
  const [config, setConfig] = useState<WebScraperConfig>({
    timeoutSec: 12,
    delayMs: 500,
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
  // isHandleStartActive: true while handleStart's while-loop is executing in browser.
  // We combine with session.status so that after page refresh we still detect running state.
  const [isHandleStartActive, setIsHandleStartActive] = useState(false);
  const isRunning = isHandleStartActive || session?.status === "running" || session?.status === "pending";
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  // Track if we already showed the completion toast for this session
  const completionToastShownRef = useRef<string | null>(null);

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

  // isRunning is now computed (isHandleStartActive || session.status) — no useEffect needed

  // Show completion toast when session completes, with enrichment stats
  useEffect(() => {
    if (!session || !sessionId) return;
    if (session.status !== "completed") return;
    if (completionToastShownRef.current === sessionId) return;
    completionToastShownRef.current = sessionId;

    const emailsFound = jobs.filter((j) => j.status === "completed" && (j.emails_found?.length ?? 0) > 0).length;
    const phonesFound = jobs.filter((j) => j.status === "completed" && (j.phones_found?.length ?? 0) > 0).length;
    const enrichedCount = jobs.filter(
      (j) => j.status === "completed" && j.contact_id && ((j.emails_found?.length ?? 0) > 0 || (j.phones_found?.length ?? 0) > 0)
    ).length;

    const parts: string[] = [];
    if (emailsFound > 0) parts.push(`${emailsFound} email trovate`);
    if (phonesFound > 0) parts.push(`${phonesFound} telefoni trovati`);
    if (enrichedCount > 0) parts.push(`${enrichedCount} contatti arricchiti`);

    if (parts.length > 0) {
      toast.success(`Scraping completato! ${parts.join(", ")}.`);
    } else {
      toast.info("Scraping completato. Nessun dato di contatto trovato.");
    }
  }, [session?.status, sessionId]);

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
              action: { label: "Riprova", onClick: () => {} },
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

  /** Import from any contacts with sito_web — no font restriction, optional session filter */
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
    }

    const { data } = await query;
    if (data) {
      const newUrls = data.map((c) => c.sito_web!).filter(Boolean);
      handleAddUrls(newUrls);
      toast.success(`${newUrls.length} URL importati${mapsSessionIdForImport ? " dalla sessione selezionata" : " dai contatti"}`);
    }
  };

  /** Import from the most recent maps/OSM scraping session */
  const handleImportFromLastOsmSession = async () => {
    const userId = await getCurrentUserId();

    // Find most recent maps/OSM session (google_maps or openstreetmap or regional)
    const { data: lastSession } = await supabase
      .from("scraping_sessions")
      .select("id, created_at")
      .eq("user_id", userId)
      .in("tipo", ["google_maps", "openstreetmap", "regional"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastSession) {
      toast.error("Nessuna sessione OSM/Maps trovata");
      return;
    }

    const { data } = await supabase
      .from("contacts")
      .select("id, sito_web")
      .eq("user_id", userId)
      .eq("scraping_session_id", lastSession.id)
      .not("sito_web", "is", null)
      .limit(1000);

    if (data) {
      const newUrls = data.map((c) => c.sito_web!).filter(Boolean);
      handleAddUrls(newUrls);
      toast.success(`${newUrls.length} URL importati dall'ultima sessione OSM`);
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
      completionToastShownRef.current = null;

      // Find matching contacts for URLs — fetch in pages to handle large contact lists
      const contactMap = new Map<string, string>();
      let contactPage = 0;
      const PAGE_SIZE = 1000;
      while (true) {
        const { data: contacts } = await supabase
          .from("contacts")
          .select("id, sito_web")
          .eq("user_id", user_id)
          .not("sito_web", "is", null)
          .range(contactPage * PAGE_SIZE, (contactPage + 1) * PAGE_SIZE - 1);
        if (!contacts || contacts.length === 0) break;
        contacts.forEach((c) => {
          if (c.sito_web) contactMap.set(normalizeUrl(c.sito_web), c.id);
        });
        if (contacts.length < PAGE_SIZE) break;
        contactPage++;
      }

      // Insert jobs in batches of 200 to avoid request size limits
      const JOB_BATCH = 200;
      for (let i = 0; i < urls.length; i += JOB_BATCH) {
        const batch = urls.slice(i, i + JOB_BATCH).map((url) => {
          const fullUrl = url.startsWith("http") ? url : `https://${url}`;
          return {
            session_id: sess.id,
            url: fullUrl,
            contact_id: contactMap.get(normalizeUrl(url)) || null,
            status: "queued" as const,
          };
        });
        await supabase.from("scraping_jobs").insert(batch);
      }

      toast.info(`${urls.length} siti in coda. Avvio scraping…`);
      setIsHandleStartActive(true);

      const edgeConfig = {
        timeout_sec: config.timeoutSec,
        delay_ms: config.delayMs,
        max_retries: config.maxRetries,
        crawl_depth: config.crawlDepth,
        search_pages: config.searchPages,
      };

      let totalCompleted = 0;
      let totalErrors = 0;
      let totalEnriched = 0;
      let round = 0;

      while (true) {
        round++;

        // Before each invocation check if user paused/stopped via DB
        const { data: sessionCheck } = await supabase
          .from("scraping_sessions")
          .select("status")
          .eq("id", sess.id)
          .single();
        if (sessionCheck?.status === "paused" || sessionCheck?.status === "completed") break;

        const res = await supabase.functions.invoke("scrape-website", {
          body: { session_id: sess.id, config: edgeConfig },
        });

        if (res?.error && !res?.data) {
          throw new Error(`Edge function error: ${res.error.message || JSON.stringify(res.error)}`);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = res?.data as any;
        if (d?.error && !d?.ok) throw new Error(d.error);

        if (d?.completed) totalCompleted += d.completed;
        if (d?.errors) totalErrors += d.errors;
        if (d?.enriched) totalEnriched += d.enriched;

        // Paused/stopped by user inside edge function — don't restart
        if (d?.interrupted) break;

        // Time budget exceeded — re-invoke to continue remaining jobs
        if (d?.needsRestart) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        break;
      }

      const parts: string[] = [];
      if (totalCompleted > 0) parts.push(`${totalCompleted} completati`);
      if (totalEnriched > 0) parts.push(`${totalEnriched} arricchiti`);
      if (totalErrors > 0) parts.push(`${totalErrors} errori`);
      toast.success(parts.length > 0 ? `Scraping completato: ${parts.join(", ")}` : "Scraping completato!");
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
    } finally {
      setIsHandleStartActive(false);
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
    completionToastShownRef.current = prevSessionId; // don't re-show toast for old sessions
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

  // Stats with email/phone counts
  const completedJobs = jobs.filter((j) => j.status === "completed");
  const emailsFoundCount = completedJobs.reduce((sum, j) => sum + (j.emails_found?.length ?? 0), 0);
  const phonesFoundCount = completedJobs.reduce((sum, j) => sum + (j.phones_found?.length ?? 0), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mobileFoundCount = completedJobs.reduce((sum, j) => sum + (((j.social_found as any)?.phones_mobile as string[] | undefined)?.length ?? 0), 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const landlineFoundCount = completedJobs.reduce((sum, j) => sum + (((j.social_found as any)?.phones_landline as string[] | undefined)?.length ?? 0), 0);

  const queueStats = {
    queued: jobs.filter((j) => j.status === "queued").length + (isRunning ? 0 : urls.length),
    processing: jobs.filter((j) => j.status === "processing").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
    emailsFound: emailsFoundCount,
    phonesFound: phonesFoundCount,
    mobileFound: mobileFoundCount,
    landlineFound: landlineFoundCount,
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left — Queue */}
      <div className="w-[400px] shrink-0 flex flex-col gap-2 overflow-hidden">
        <div className="flex items-center gap-3 shrink-0">
          <Globe className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">SCRAPER SITI WEB</h1>
        </div>

        {/* OSM import button */}
        <Button
          variant="outline"
          size="sm"
          className="font-mono text-[10px] h-7 w-full shrink-0"
          onClick={handleImportFromLastOsmSession}
          disabled={isRunning}
        >
          Importa da ultima sessione OSM
        </Button>

        {/* Queue takes all remaining space — controls always visible at bottom */}
        <div className="flex-1 min-h-0 overflow-hidden">
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
        </div>

        <WebScraperPreviousSessions
          sessions={allSessions}
          onLoad={handleLoadPreviousSession}
        />
      </div>

      {/* Right — Results */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stats banner */}
        {(emailsFoundCount > 0 || phonesFoundCount > 0) && (
          <div className="flex items-center gap-4 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 mb-3 text-xs font-mono text-primary">
            {emailsFoundCount > 0 && <span>{emailsFoundCount} email trovate</span>}
            {phonesFoundCount > 0 && <span>{phonesFoundCount} telefoni trovati</span>}
          </div>
        )}

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
