import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
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
    const userId = user.id;

    const { message_id, corpo, oggetto } = await req.json();

    if (!message_id || !corpo) {
      return new Response(JSON.stringify({ error: "message_id and corpo are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch original message
    const { data: original, error: msgErr } = await supabase
      .from("inbox_messages")
      .select("*")
      .eq("id", message_id)
      .single();

    if (msgErr || !original) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const canale = original.canale;
    const destinatarioEmail = original.da_email;
    const destinatarioTelefono = original.da_telefono;

    // Use service role to read sender_pool (user's own senders)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find an active sender for this channel owned by this user
    const { data: sender, error: senderErr } = await adminClient
      .from("sender_pool")
      .select("*")
      .eq("user_id", userId)
      .eq("tipo", canale)
      .eq("attivo", true)
      .neq("stato", "banned")
      .order("health_score", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sender) {
      return new Response(JSON.stringify({ error: `Nessun mittente ${canale} attivo trovato. Configura un mittente nella sezione Sender Pool.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sendResult: { success: boolean; error?: string } = { success: false };

    // === EMAIL via Resend ===
    if (canale === "email") {
      if (!sender.resend_api_key || !sender.email_from) {
        return new Response(JSON.stringify({ error: "Mittente email non configurato (manca API key o email_from)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!destinatarioEmail) {
        return new Response(JSON.stringify({ error: "Nessun indirizzo email destinatario" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sender.resend_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: sender.email_nome
            ? `${sender.email_nome} <${sender.email_from}>`
            : sender.email_from,
          to: [destinatarioEmail],
          subject: oggetto || `Re: ${original.oggetto || ""}`,
          html: `<div style="font-family:sans-serif;font-size:14px">${corpo.replace(/\n/g, "<br>")}</div>`,
          reply_to: sender.reply_to || sender.email_from,
        }),
      });

      const resendBody = await resendResp.text();
      if (resendResp.ok) {
        sendResult = { success: true };
      } else {
        sendResult = { success: false, error: `Resend error [${resendResp.status}]: ${resendBody}` };
      }
    }

    // === WHATSAPP via Meta Cloud API ===
    else if (canale === "whatsapp") {
      if (!sender.wa_access_token || !sender.wa_phone_number_id) {
        return new Response(JSON.stringify({ error: "Mittente WhatsApp non configurato (manca access token o phone number ID)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!destinatarioTelefono) {
        return new Response(JSON.stringify({ error: "Nessun numero di telefono destinatario" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const waResp = await fetch(
        `https://graph.facebook.com/v21.0/${sender.wa_phone_number_id}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sender.wa_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: destinatarioTelefono.replace(/[^0-9]/g, ""),
            type: "text",
            text: { body: corpo },
          }),
        }
      );

      const waBody = await waResp.text();
      if (waResp.ok) {
        sendResult = { success: true };
      } else {
        sendResult = { success: false, error: `WhatsApp API error [${waResp.status}]: ${waBody}` };
      }
    }

    // === SMS (placeholder — not implemented yet) ===
    else if (canale === "sms") {
      return new Response(JSON.stringify({ error: "Invio SMS non ancora supportato dalla risposta inline" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!sendResult.success) {
      return new Response(JSON.stringify({ error: sendResult.error || "Invio fallito" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save outgoing message to inbox_messages
    const { error: insertErr } = await adminClient.from("inbox_messages").insert({
      user_id: userId,
      campaign_id: original.campaign_id || null,
      recipient_id: original.recipient_id || null,
      thread_id: original.thread_id || original.id,
      canale,
      da_nome: sender.email_nome || sender.nome || null,
      da_email: canale === "email" ? sender.email_from : null,
      da_telefono: canale === "whatsapp" ? sender.wa_numero : null,
      oggetto: oggetto || original.oggetto || null,
      corpo,
      corpo_html: canale === "email" ? `<div style="font-family:sans-serif;font-size:14px">${corpo.replace(/\n/g, "<br>")}</div>` : null,
      data_ricezione: new Date().toISOString(),
      letto: true,
      etichetta: "risposta_inviata",
      etichetta_ai: false,
    });

    if (insertErr) {
      console.error("Error saving outgoing message:", insertErr);
    }

    // Update sender daily count
    await adminClient
      .from("sender_pool")
      .update({
        inviati_oggi: (sender.inviati_oggi || 0) + 1,
        totale_inviati: (sender.totale_inviati || 0) + 1,
      })
      .eq("id", sender.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-reply error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
