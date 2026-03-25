import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DISPOSABLE_DOMAINS = [
  "mailinator.com","guerrillamail.com","tempmail.com","throwaway.email",
  "yopmail.com","sharklasers.com","trashmail.com","dispostable.com",
  "maildrop.cc","10minutemail.com","temp-mail.org","fakeinbox.com",
];
const RISKY_PATTERNS = [
  /^(info|admin|support|contact|hello|office|sales|marketing|noreply|no-reply)@/i,
];

function basicClassify(email: string): "valid" | "risky" | "invalid" {
  if (!email || !EMAIL_REGEX.test(email)) return "invalid";
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || domain.length < 4) return "invalid";
  if (DISPOSABLE_DOMAINS.includes(domain)) return "invalid";
  if (RISKY_PATTERNS.some((p) => p.test(email))) return "risky";
  return "valid";
}

async function hasMxRecords(domain: string): Promise<boolean> {
  try {
    const records = await Deno.resolveDns(domain, "MX");
    return records.length > 0;
  } catch {
    return false;
  }
}

async function validateWithMillionVerifier(email: string, apiKey: string): Promise<"valid" | "risky" | "invalid"> {
  try {
    const res = await fetch(`https://api.millionverifier.com/api/v3/?api=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`);
    if (!res.ok) return "risky";
    const data = await res.json();
    // resultcode: 1=good, 2=catch_all, 3=unknown, 4=bad, 5=disposable
    if (data.resultcode === 1) return "valid";
    if (data.resultcode === 2 || data.resultcode === 3) return "risky";
    return "invalid";
  } catch {
    return "risky";
  }
}

async function validateWithZeroBounce(email: string, apiKey: string): Promise<"valid" | "risky" | "invalid"> {
  try {
    const res = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${encodeURIComponent(apiKey)}&email=${encodeURIComponent(email)}`);
    if (!res.ok) return "risky";
    const data = await res.json();
    if (data.status === "valid") return "valid";
    if (data.status === "catch-all" || data.status === "unknown") return "risky";
    return "invalid";
  } catch {
    return "risky";
  }
}

async function classifyEmail(
  email: string,
  provider: string | null,
  apiKey: string | null
): Promise<"valid" | "risky" | "invalid"> {
  const basic = basicClassify(email);
  if (basic === "invalid") return "invalid";

  const domain = email.split("@")[1]?.toLowerCase();

  // If external provider configured, use it
  if (apiKey && provider === "millionverifier") {
    return validateWithMillionVerifier(email, apiKey);
  }
  if (apiKey && provider === "zerobounce") {
    return validateWithZeroBounce(email, apiKey);
  }

  // Default: MX lookup
  if (domain) {
    const hasMx = await hasMxRecords(domain);
    if (!hasMx) return "invalid";
  }

  return basic;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const userId = user.id;

    // Read provider settings
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("chiave, valore")
      .in("chiave", ["millionverifier_api_key", "zerobounce_api_key"]);

    const settingsMap: Record<string, string> = {};
    settingsData?.forEach((s: any) => { settingsMap[s.chiave] = s.valore || ""; });
    
    // Determine provider based on which key exists
    let provider = "mx";
    let apiKey: string | null = null;
    if (settingsMap["millionverifier_api_key"]) {
      provider = "millionverifier";
      apiKey = settingsMap["millionverifier_api_key"];
    } else if (settingsMap["zerobounce_api_key"]) {
      provider = "zerobounce";
      apiKey = settingsMap["zerobounce_api_key"];
    }

    const body = await req.json();
    const batchSize = Math.min(body.batch_size || 100, 500);
    const offset = body.offset || 0;
    const reVerify = body.re_verify === true;

    let query = supabase
      .from("contacts")
      .select("id, email")
      .eq("user_id", userId)
      .not("email", "is", null)
      .range(offset, offset + batchSize - 1);

    // By default only process contacts that haven't been verified yet
    if (!reVerify) {
      query = query.is("email_quality", null);
    }

    const { data: contacts, error } = await query;
    if (error) throw error;

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, valid: 0, risky: 0, invalid: 0, done: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cache MX results per domain to avoid repeated DNS lookups
    const mxCache = new Map<string, boolean>();
    let valid = 0, risky = 0, invalid = 0;

    for (const contact of contacts) {
      const email = (contact.email || "").trim().toLowerCase();
      let quality: "valid" | "risky" | "invalid";

      if (provider === "mx" && !apiKey) {
        // Optimized MX-only path with caching
        quality = basicClassify(email);
        if (quality !== "invalid") {
          const domain = email.split("@")[1];
          if (domain) {
            if (!mxCache.has(domain)) {
              mxCache.set(domain, await hasMxRecords(domain));
            }
            if (!mxCache.get(domain)) quality = "invalid";
          }
        }
      } else {
        quality = await classifyEmail(email, provider, apiKey);
      }

      if (quality === "valid") valid++;
      else if (quality === "risky") risky++;
      else invalid++;

      await supabase
        .from("contacts")
        .update({
          email_quality: quality,
          email_valid: quality === "valid",
        })
        .eq("id", contact.id);
    }

    const done = contacts.length < batchSize;

    return new Response(
      JSON.stringify({
        processed: contacts.length,
        valid,
        risky,
        invalid,
        done,
        next_offset: done ? null : offset + batchSize,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
