import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Regex helpers ── */
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_IT_RE =
  /(?:\+39[\s.\-]?)?(?:0[1-9]\d{1,3}|3[0-9]{2})[\s.\-\/]?\d{3,4}[\s.\-\/]?\d{3,4}/g;
const SOCIAL_RE: Record<string, RegExp> = {
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[^\s"'<>]+/gi,
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi,
};
const CONTACT_PAGE_RE = /href="(\/[^"]*(?:contatt|contact|chi-siamo|about|who)[^"]*)"/gi;

const JUNK_EMAILS = new Set([
  "noreply@", "no-reply@", "mailer-daemon@", "postmaster@",
  "webmaster@", "hostmaster@", "abuse@",
]);

function cleanEmails(raw: string[]): string[] {
  const seen = new Set<string>();
  return raw.filter((e) => {
    const lower = e.toLowerCase();
    if (seen.has(lower)) return false;
    if (JUNK_EMAILS.has(lower.split("@")[0] + "@")) return false;
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".svg")) return false;
    seen.add(lower);
    return true;
  });
}

function cleanPhones(raw: string[]): string[] {
  const seen = new Set<string>();
  return raw.filter((p) => {
    const normalized = p.replace(/[\s.\-\/]/g, "");
    if (normalized.length < 6 || normalized.length > 15) return false;
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function extractSocial(html: string): Record<string, string> {
  const social: Record<string, string> = {};
  for (const [platform, re] of Object.entries(SOCIAL_RE)) {
    const match = html.match(re);
    if (match) social[platform] = match[0];
  }
  return social;
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BuzzFinderBot/1.0; +https://buzzfinder-studio.lovable.app)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function extractContactPageLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CONTACT_PAGE_RE.source, CONTACT_PAGE_RE.flags);
  while ((m = re.exec(html)) !== null) {
    try {
      const full = new URL(m[1], baseUrl).href;
      links.push(full);
    } catch { /* ignore */ }
  }
  return [...new Set(links)].slice(0, 5);
}

interface ScrapeResult {
  emails: string[];
  phones: string[];
  social: Record<string, string>;
}

async function scrapeUrl(
  url: string,
  timeoutMs: number,
  crawlDepth: string,
): Promise<ScrapeResult> {
  const html = await fetchHtml(url, timeoutMs);

  let allEmails = html.match(EMAIL_RE) || [];
  let allPhones = html.match(PHONE_IT_RE) || [];
  const social = extractSocial(html);

  // If crawlDepth includes contacts, try sub-pages
  if (crawlDepth === "homepage_contacts") {
    const subLinks = extractContactPageLinks(html, url);
    for (const link of subLinks) {
      try {
        const subHtml = await fetchHtml(link, timeoutMs);
        allEmails = allEmails.concat(subHtml.match(EMAIL_RE) || []);
        allPhones = allPhones.concat(subHtml.match(PHONE_IT_RE) || []);
        const subSocial = extractSocial(subHtml);
        for (const [k, v] of Object.entries(subSocial)) {
          if (!social[k]) social[k] = v;
        }
      } catch { /* skip sub-page errors */ }
    }
  }

  return {
    emails: cleanEmails(allEmails),
    phones: cleanPhones(allPhones),
    social,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { session_id, urls, config, retry_job_id } = await req.json();

    if (!session_id || (!urls?.length && !retry_job_id)) {
      return new Response(
        JSON.stringify({ error: "session_id and urls required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Verify session exists
    const { data: session } = await sb
      .from("scraping_sessions")
      .select("id, user_id, status")
      .eq("id", session_id)
      .single();
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Mark session running
    await sb
      .from("scraping_sessions")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", session_id);

    const timeoutMs = (config?.timeout_sec || 15) * 1000;
    const delayMs = config?.delay_ms || 1500;
    const crawlDepth = config?.crawl_depth || "homepage";

    // Get jobs to process
    let jobsToProcess: Array<{ id: string; url: string; contact_id: string | null }>;
    if (retry_job_id) {
      const { data } = await sb
        .from("scraping_jobs")
        .select("id, url, contact_id")
        .eq("id", retry_job_id);
      jobsToProcess = data || [];
    } else {
      const { data } = await sb
        .from("scraping_jobs")
        .select("id, url, contact_id")
        .eq("session_id", session_id)
        .eq("status", "queued");
      jobsToProcess = data || [];
    }

    let completed = 0;
    let errors = 0;

    for (const job of jobsToProcess) {
      // Check if session was paused/stopped
      const { data: currentSession } = await sb
        .from("scraping_sessions")
        .select("status")
        .eq("id", session_id)
        .single();
      if (currentSession?.status === "paused" || currentSession?.status === "completed") {
        break;
      }

      // Mark processing
      await sb
        .from("scraping_jobs")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", job.id);

      const start = Date.now();
      try {
        const result = await scrapeUrl(job.url, timeoutMs, crawlDepth);
        const processingTime = Date.now() - start;

        await sb.from("scraping_jobs").update({
          status: "completed",
          emails_found: result.emails,
          phones_found: result.phones,
          social_found: result.social,
          processing_time_ms: processingTime,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);

        completed++;
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        await sb.from("scraping_jobs").update({
          status: "failed",
          error_message: errorMessage,
          processing_time_ms: Date.now() - start,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        errors++;
      }

      // Update session progress
      const total = jobsToProcess.length;
      const processed = completed + errors;
      await sb.from("scraping_sessions").update({
        progress_percent: Math.round((processed / total) * 100),
        totale_importati: completed,
        totale_errori: errors,
      }).eq("id", session_id);

      // Delay between requests
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    // Mark session completed
    await sb.from("scraping_sessions").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      progress_percent: 100,
      totale_trovati: completed + errors,
      totale_importati: completed,
      totale_errori: errors,
    }).eq("id", session_id);

    return new Response(
      JSON.stringify({ ok: true, completed, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
