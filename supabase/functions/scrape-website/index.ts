import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* ── Dynamic CORS ── */
function getCorsHeaders(_req: Request): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

/* ── SSRF Protection (private IPs only, no geo-blocking) ── */
const PRIVATE_IP_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
  /^169\.254\./, /^0\./, /^::1$/, /^fc00:/i, /^fe80:/i, /^fd/i,
];

const BLOCKED_HOSTS = new Set([
  "localhost", "metadata.google.internal", "metadata.google",
  "169.254.169.254", "metadata", "kubernetes.default",
]);

function validateScrapeUrl(url: string): boolean {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  const hostname = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(hostname)) return false;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal")) return false;
  for (const re of PRIVATE_IP_RANGES) { if (re.test(hostname)) return false; }
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

// Improved phone regex: international +39, formats like 0x-xxx, 3xx-xxx, (0x)xxx
const PHONE_IT_RE =
  /(?:\+39[\s.\-]?)?(?:\(0[1-9]\d{0,3}\)|0[1-9]\d{1,3}|3[0-9]{2})[\s.\-\/]?\d{3,4}[\s.\-\/]?\d{3,4}/g;

const SOCIAL_RE: Record<string, RegExp> = {
  linkedin: /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[^\s"'<>]+/gi,
  facebook: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi,
  instagram: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi,
};

// More contact page patterns: contatti, contact, chi-siamo, about, dove-siamo, info, reach-us
const CONTACT_PAGE_RE =
  /href="(\/[^"]*(?:contatt|contact|chi-siamo|about|dove-siamo|info|reach-us|who)[^"]*)"/gi;

const JUNK_EMAILS = new Set([
  "noreply@", "no-reply@", "mailer-daemon@", "postmaster@",
  "webmaster@", "hostmaster@", "abuse@",
]);

// File extensions to strip from emails (tracking pixels, assets)
const JUNK_EMAIL_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js",
  ".ico", ".bmp", ".tiff", ".woff", ".ttf",
]);

function cleanEmails(raw: string[]): string[] {
  const seen = new Set<string>();
  return raw.filter((e) => {
    const lower = e.toLowerCase();
    if (seen.has(lower)) return false;
    const prefix = lower.split("@")[0] + "@";
    if (JUNK_EMAILS.has(prefix)) return false;
    // Strip tracking pixel emails (email ending in image/asset extension)
    for (const ext of JUNK_EMAIL_EXTS) {
      if (lower.endsWith(ext)) return false;
    }
    // Must have valid domain part
    const parts = lower.split("@");
    if (parts.length !== 2) return false;
    if (!parts[1].includes(".")) return false;
    seen.add(lower);
    return true;
  });
}

function cleanPhones(raw: string[]): string[] {
  const seen = new Set<string>();
  return raw.filter((p) => {
    const normalized = p.replace(/[\s.\-\/()]/g, "");
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

/* ── JSON-LD structured data extraction ── */
function extractFromJsonLd(html: string): { emails: string[]; phones: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];
  const jsonLdRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = jsonLdRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(m[1]);
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (item.email) emails.push(item.email);
        if (item.telephone) phones.push(item.telephone);
        // ContactPoint nested
        if (item.contactPoint) {
          const pts = Array.isArray(item.contactPoint) ? item.contactPoint : [item.contactPoint];
          for (const pt of pts) {
            if (pt.email) emails.push(pt.email);
            if (pt.telephone) phones.push(pt.telephone);
          }
        }
      }
    } catch { /* ignore malformed JSON-LD */ }
  }
  return { emails, phones };
}

/* ── hCard microformat extraction ── */
function extractFromHCard(html: string): { emails: string[]; phones: string[] } {
  const emails: string[] = [];
  const phones: string[] = [];

  // hCard email: <a class="email" href="mailto:...">
  const emailRe = /class="[^"]*email[^"]*"[^>]*href="mailto:([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = emailRe.exec(html)) !== null) emails.push(m[1]);

  // hCard tel: <a class="tel" href="tel:...">
  const telRe = /class="[^"]*tel[^"]*"[^>]*href="tel:([^"]+)"/gi;
  while ((m = telRe.exec(html)) !== null) phones.push(m[1]);

  // Also catch mailto: and tel: links broadly
  const mailtoRe = /href="mailto:([^"?]+)"/gi;
  while ((m = mailtoRe.exec(html)) !== null) emails.push(m[1]);

  const telLinkRe = /href="tel:([^"]+)"/gi;
  while ((m = telLinkRe.exec(html)) !== null) phones.push(m[1].replace(/[\s.\-]/g, ""));

  return { emails, phones };
}

/* ── Footer HTML extraction ── */
function extractFooterHtml(html: string): string {
  const footerRe = /<footer[\s\S]*?<\/footer>/gi;
  const matches = html.match(footerRe);
  return matches ? matches.join("\n") : "";
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
        "User-Agent": "Mozilla/5.0 (compatible; BuzzFinderBot/1.0; +https://buzzfinder-studio.lovable.app)",
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

/* ── InterruptedError for pause detection ── */
class InterruptedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InterruptedError";
  }
}

interface ScrapeResult {
  emails: string[];
  phones: string[];
  social: Record<string, string>;
}

// deno-lint-ignore no-explicit-any
async function isSessionPaused(sb: any, session_id: string): Promise<boolean> {
  const { data } = await sb
    .from("scraping_sessions")
    .select("status")
    .eq("id", session_id)
    .single();
  return data?.status === "paused" || data?.status === "completed";
}

async function scrapeUrl(
  url: string,
  timeoutMs: number,
  crawlDepth: string,
  // deno-lint-ignore no-explicit-any
  sb: any,
  session_id: string,
): Promise<ScrapeResult> {
  const html = await fetchHtml(url, timeoutMs);

  // Extract from multiple sources
  const footerHtml = extractFooterHtml(html);
  const combinedHtml = html + "\n" + footerHtml;

  let allEmails: string[] = (combinedHtml.match(EMAIL_RE) || []);
  let allPhones: string[] = (combinedHtml.match(PHONE_IT_RE) || []);
  const social = extractSocial(html);

  // JSON-LD structured data
  const jsonLd = extractFromJsonLd(html);
  allEmails = allEmails.concat(jsonLd.emails);
  allPhones = allPhones.concat(jsonLd.phones);

  // hCard microformats
  const hcard = extractFromHCard(html);
  allEmails = allEmails.concat(hcard.emails);
  allPhones = allPhones.concat(hcard.phones);

  if (crawlDepth === "homepage_contacts") {
    const subLinks = extractContactPageLinks(html, url);
    for (const link of subLinks) {
      // Check pause status before each sub-page fetch
      if (await isSessionPaused(sb, session_id)) {
        throw new InterruptedError("Session paused by user");
      }
      try {
        const subHtml = await fetchHtml(link, timeoutMs);
        const subFooter = extractFooterHtml(subHtml);
        const subCombined = subHtml + "\n" + subFooter;

        allEmails = allEmails.concat(subCombined.match(EMAIL_RE) || []);
        allPhones = allPhones.concat(subCombined.match(PHONE_IT_RE) || []);

        const subJsonLd = extractFromJsonLd(subHtml);
        allEmails = allEmails.concat(subJsonLd.emails);
        allPhones = allPhones.concat(subJsonLd.phones);

        const subHCard = extractFromHCard(subHtml);
        allEmails = allEmails.concat(subHCard.emails);
        allPhones = allPhones.concat(subHCard.phones);

        const subSocial = extractSocial(subHtml);
        for (const [k, v] of Object.entries(subSocial)) {
          if (!social[k]) social[k] = v;
        }
      } catch (err) {
        if (err instanceof InterruptedError) throw err;
        /* skip sub-page errors */
      }
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

  // Always return HTTP 200 — errors go in the body
  try {
    /* ── JWT Authentication ── */
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 200, headers: withHeaders({ "Content-Type": "application/json" }) },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token non valido" }),
        { status: 200, headers: withHeaders({ "Content-Type": "application/json" }) },
      );
    }
    const authenticatedUserId = user.id;

    const { session_id, urls, config, retry_job_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: "session_id required" }),
        { status: 200, headers: withHeaders({ "Content-Type": "application/json" }) },
      );
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
        { status: 200, headers: withHeaders({ "Content-Type": "application/json" }) },
      );
    }

    /* ── Ownership check ── */
    if (session.user_id !== authenticatedUserId) {
      return new Response(
        JSON.stringify({ error: "Accesso negato: sessione non appartenente all'utente" }),
        { status: 200, headers: withHeaders({ "Content-Type": "application/json" }) },
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
    let contactsEnriched = 0;
    let interrupted = false;

    const BATCH_SIZE = 3;
    const total = jobsToProcess.length;

    const processJob = async (
      job: { id: string; url: string; contact_id: string | null },
    ): Promise<"completed" | "error" | "interrupted"> => {
      // Validate URL
      if (!validateScrapeUrl(job.url)) {
        await sb.from("scraping_jobs").update({
          status: "failed",
          error_message: "URL non valido o non autorizzato",
          processing_time_ms: 0,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        return "error";
      }

      await sb
        .from("scraping_jobs")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", job.id);

      const start = Date.now();
      try {
        const result = await scrapeUrl(job.url, timeoutMs, crawlDepth, sb, session_id);
        const processingTime = Date.now() - start;

        await sb.from("scraping_jobs").update({
          status: "completed",
          emails_found: result.emails,
          phones_found: result.phones,
          social_found: result.social,
          processing_time_ms: processingTime,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);

        // Write back found data to contacts table
        if (job.contact_id && (result.emails.length > 0 || result.phones.length > 0)) {
          const updates: Record<string, unknown> = {};
          if (result.emails.length > 0) updates.email = result.emails[0];
          if (result.phones.length > 0) updates.telefono = result.phones[0];
          if (result.social?.linkedin) updates.linkedin_url = result.social.linkedin;
          if (result.social?.facebook) updates.facebook_url = result.social.facebook;
          if (result.social?.instagram) updates.instagram_url = result.social.instagram;
          await sb.from("contacts").update(updates).eq("id", job.contact_id);
          contactsEnriched++;
        }

        return "completed";
      } catch (err: unknown) {
        if (err instanceof InterruptedError) {
          await sb.from("scraping_jobs").update({
            status: "queued",
            error_message: "Interrotto per pausa",
            processing_time_ms: Date.now() - start,
            updated_at: new Date().toISOString(),
          }).eq("id", job.id);
          return "interrupted";
        }
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        await sb.from("scraping_jobs").update({
          status: "failed",
          error_message: errorMessage,
          processing_time_ms: Date.now() - start,
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        return "error";
      }
    };

    // Process in parallel batches of 3
    for (let i = 0; i < jobsToProcess.length; i += BATCH_SIZE) {
      // Check session status before each batch
      if (await isSessionPaused(sb, session_id)) {
        interrupted = true;
        break;
      }

      const batch = jobsToProcess.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(batch.map((job) => processJob(job)));

      for (const r of results) {
        if (r === "completed") completed++;
        else if (r === "error") errors++;
        else if (r === "interrupted") { interrupted = true; }
      }

      if (interrupted) break;

      const processed = completed + errors;
      await sb.from("scraping_sessions").update({
        progress_percent: Math.round((processed / total) * 100),
        totale_importati: completed,
        totale_errori: errors,
      }).eq("id", session_id);

      if (delayMs > 0 && i + BATCH_SIZE < jobsToProcess.length) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }

    // Only set completed if not interrupted by pause
    if (!interrupted) {
      await sb.from("scraping_sessions").update({
        status: "completed",
        completed_at: new Date().toISOString(),
        progress_percent: 100,
        totale_trovati: completed + errors,
        totale_importati: completed,
        totale_errori: errors,
      }).eq("id", session_id);
    } else {
      // Set interrupted_at and update counts, but keep current status (paused/completed)
      await sb.from("scraping_sessions").update({
        interrupted_at: new Date().toISOString(),
        totale_importati: completed,
        totale_errori: errors,
      }).eq("id", session_id);

      // Reset any remaining "processing" jobs back to "queued"
      await sb.from("scraping_jobs")
        .update({ status: "queued", updated_at: new Date().toISOString() })
        .eq("session_id", session_id)
        .eq("status", "processing");
    }

    return new Response(
      JSON.stringify({ ok: true, completed, errors, contactsEnriched, interrupted, requestId }),
      { headers: withHeaders({ "Content-Type": "application/json" }) },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    // Always return 200 with error in body
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      { status: 200, headers: withHeaders({ "Content-Type": "application/json" }) },
    );
  }
});
