import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, body, sender_id } = await req.json();

    if (!to || !subject || !body || !sender_id) {
      return ok({ error: "to, subject, body, sender_id sono obbligatori" });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch sender
    const { data: sender } = await adminClient
      .from("sender_pool")
      .select("resend_api_key, email_from, email_nome, reply_to, inviati_oggi, totale_inviati")
      .eq("id", sender_id)
      .eq("user_id", user.id)
      .eq("attivo", true)
      .maybeSingle();

    if (!sender) {
      return ok({ error: "Mittente non trovato o non attivo" });
    }
    if (!sender.resend_api_key || !sender.email_from) {
      return ok({ error: "Mittente senza API key Resend configurata" });
    }

    const fromField = sender.email_nome
      ? `${sender.email_nome} <${sender.email_from}>`
      : sender.email_from;

    const htmlBody = `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${body.replace(/\n/g, "<br>")}</div>`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sender.resend_api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromField,
        to: [to],
        subject,
        html: htmlBody,
        text: body,
        ...(sender.reply_to ? { reply_to: sender.reply_to } : {}),
      }),
    });

    const resendData = await resendResp.json();

    if (!resendResp.ok) {
      return ok({ error: `Resend error [${resendResp.status}]: ${JSON.stringify(resendData)}` });
    }

    // Update sender counters
    await adminClient
      .from("sender_pool")
      .update({
        inviati_oggi: (sender.inviati_oggi || 0) + 1,
        totale_inviati: (sender.totale_inviati || 0) + 1,
      } as any)
      .eq("id", sender_id);

    // Save to inbox as outgoing
    await adminClient.from("inbox_messages").insert({
      user_id: user.id,
      canale: "email",
      da_email: sender.email_from,
      da_nome: sender.email_nome || null,
      oggetto: subject,
      corpo: body,
      corpo_html: htmlBody,
      data_ricezione: new Date().toISOString(),
      letto: true,
      etichetta: "outbound",
      etichetta_ai: false,
    } as any);

    return ok({ success: true, id: resendData.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Errore sconosciuto";
    console.error("send-direct-email error:", msg);
    return ok({ error: msg });
  }
});
