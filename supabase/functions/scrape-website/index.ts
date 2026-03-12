import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ── Dynamic CORS ── */
function getAllowedOrigins(): string[] {
  const env = Deno.env.get("ALLOWED_ORIGINS") || "";
  const origins = env.split(",").map((o) => o.trim()).filter(Boolean);
  // Fallback: Supabase project URL + Lovable preview/published
  const projectUrl = Deno.env.get("SUPABASE_URL") || "";
  if (projectUrl) origins.push(projectUrl);
  origins.push("https://buzzfinder-studio.lovable.app");
  return origins;
}

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const allowed = getAllowedOrigins();
  const matchedOrigin = allowed.find((o) => origin === o || origin.endsWith(".lovable.app"));
  return {
    "Access-Control-Allow-Origin": matchedOrigin || allowed[0] || "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Vary": "Origin",
  };
}

/* ── SSRF Protection ── */
const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^fd/i,
];

const BLOCKED_HOSTS = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata.google",
  "169.254.169.254",
  "metadata",
  "kubernetes.default",
]);

function validateScrapeUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  // Only allow http/https
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block known internal hosts
  if (BLOCKED_HOSTS.has(hostname)) return false;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;

  // Block private/reserved IPs
  for (const re of PRIVATE_IP_RANGES) {
    if (re.test(hostname)) return false;
  }

  // Must have at least one dot (real domain)
  if (!hostname.includes(".")) return false;

  return true;
}

/* ── Rate limiter per domain ── */
const domainInflight = new Map<string, number>();
const MAX_PER_DOMAIN = 3;

function getDomain(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return url; }
}

async function acquireDomainSlot(domain: string): Promise<void> {
  while ((domainInflight.get(domain) ?? 0) >= MAX_PER_DOMAIN) {
    await new Promise((r) => setTimeout(r, 200));
  }
  domainInflight.set(domain, (domainInflight.get(domain) ?? 0) + 1);
}

function releaseDomainSlot(domain: string): void {
  const cur = domainInflight.get(domain) ?? 1;
  if (cur <= 1) domainInflight.delete(domain);
  else domainInflight.set(domain, cur - 1);
}

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
  if (!validateScrapeUrl(url)) {
    throw new Error("URL non valido o non autorizzato");
  }

  const domain = getDomain(url);
  await acquireDomainSlot(domain);

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
    releaseDomainSlot(domain);
  }
}

function extractContactPageLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(CONTACT_PAGE_RE.source, CONTACT_PAGE_RE.flags);
  while ((m = re.exec(html)) !== null) {
    try {
      const full = new URL(m[1], baseUrl).href;
      if (validateScrapeUrl(full)) links.push(full);
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
  const cors = getCorsHeaders(req);
  const requestId = crypto.randomUUID();
  const withHeaders = (extra: Record<string, string> = {}) => ({
    ...cors,
    "X-Request-ID": requestId,
    ...extra,
  });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: withHeaders() });
  }

  try {
    /* ── JWT Authentication ── */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: withHeaders({ "Content-Type": "application/json" }) },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Token non valido" }),
        { status: 401, headers: withHeaders({ "Content-Type": "application/json" }) },
      );
    }
    const authenticatedUserId = claimsData.claims.sub as string;

    const { session_id, urls, config, retry_job_id } = await req.json();

    if (!session_id || (!urls?.length && !retry_job_id)) {
      return new Response(
        JSON.stringify({ error: "session_id and urls required" }),
        { status: 400, headers: withHeaders({ "Content-Type": "application/json" }) },
      );
    }

    // Pre-validate all URLs upfront
    if (urls?.length) {
      for (const u of urls) {
        const full = u.startsWith("http") ? u : `https://${u}`;
        if (!validateScrapeUrl(full)) {
          return new Response(
            JSON.stringify({ error: `URL non valido o non autorizzato: ${u}` }),
            { status: 400, headers: withHeaders({ "Content-Type": "application/json" }) },
          );
        }
      }
    }

    const sb = createClient(supabaseUrl, serviceKey);

    const { data: session } = await sb
      .from("scraping_sessions")
      .select("id, user_id, status")
      .eq("id", session_id)
      .single();
    if (!session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: withHeaders({ "Content-Type": "application/json" }) },
      );
    }

    /* ── Ownership check ── */
    if (session.user_id !== authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: "Accesso negato: sessione non appartenente all'utente" }),
        { status: 403, headers: withHeaders({ "Content-Type": "application/json" }) },
      );
    }

    await sb
      .from("scraping_sessions")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", session_id);

    const timeoutMs = (config?.timeout_sec || 15) * 1000;
    const delayMs = config?.delay_ms || 1500;
    const crawlDepth = config?.crawl_depth || "homepage";

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
      const { data: currentSession } = await sb
        .from("scraping_sessions")
        .select("status")
        .eq("id", session_id)
        .single();
      if (currentSession?.status === "paused" || currentSession?.status === "completed") {
        break;
      }

      // Validate URL before processing
      if (!validateScrapeUrl(job.url)) {
        await sb.from("scraping_jobs").update({
          status: "failed",
          error_message: "URL non valido o non autorizzato",
          processing_time_ms: 0,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        errors++;
        continue;
      }

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

      const total = jobsToProcess.length;
      const processed = completed + errors;
      await sb.from("scraping_sessions").update({
        progress_percent: Math.round((processed / total) * 100),
        totale_importati: completed,
        totale_errori: errors,
      }).eq("id", session_id);

      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

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
