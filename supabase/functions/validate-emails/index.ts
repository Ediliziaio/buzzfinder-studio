import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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

function classifyEmail(email: string): "valid" | "risky" | "invalid" {
  if (!email || !EMAIL_REGEX.test(email)) return "invalid";
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || domain.length < 4) return "invalid";
  if (DISPOSABLE_DOMAINS.includes(domain)) return "invalid";
  if (RISKY_PATTERNS.some((p) => p.test(email))) return "risky";
  return "valid";
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

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const batchSize = Math.min(body.batch_size || 100, 500);
    const offset = body.offset || 0;

    // Fetch contacts with email that haven't been quality-checked
    let query = supabase
      .from("contacts")
      .select("id, email")
      .eq("user_id", userId)
      .not("email", "is", null)
      .is("email_quality", null)
      .range(offset, offset + batchSize - 1);

    const { data: contacts, error } = await query;
    if (error) throw error;

    if (!contacts || contacts.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, valid: 0, risky: 0, invalid: 0, done: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let valid = 0, risky = 0, invalid = 0;

    for (const contact of contacts) {
      const quality = classifyEmail(contact.email || "");
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
