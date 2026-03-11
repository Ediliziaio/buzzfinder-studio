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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();

    // Expected payload fields
    const {
      user_id,
      campaign_id,
      recipient_id,
      execution_id,
      canale = "email",
      da_nome,
      da_email,
      da_telefono,
      oggetto,
      corpo,
      corpo_html,
      data_ricezione,
      thread_id,
    } = payload;

    if (!user_id || !corpo) {
      return new Response(JSON.stringify({ error: "user_id and corpo are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Classify with AI
    let etichetta = "non_categorizzato";
    let etichetta_ai = false;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `Classifica questa risposta email/messaggio in UNA delle seguenti etichette:
interessato, non_interessato, richiesta_info, fuori_ufficio, appuntamento_fissato, referral, obiezione, disiscrizione, non_categorizzato.
Rispondi con SOLO l'etichetta, nient'altro.`,
              },
              {
                role: "user",
                content: `Oggetto: ${oggetto || "(nessuno)"}\n\nCorpo:\n${corpo}`,
              },
            ],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const raw = aiData.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
          const valid = [
            "interessato", "non_interessato", "richiesta_info", "fuori_ufficio",
            "appuntamento_fissato", "referral", "obiezione", "disiscrizione", "non_categorizzato",
          ];
          if (valid.includes(raw)) {
            etichetta = raw;
            etichetta_ai = true;
          }
        }
      } catch (e) {
        console.error("AI classification failed:", e);
      }
    }

    const { data, error } = await supabase.from("inbox_messages").insert({
      user_id,
      campaign_id: campaign_id || null,
      recipient_id: recipient_id || null,
      execution_id: execution_id || null,
      canale,
      da_nome: da_nome || null,
      da_email: da_email || null,
      da_telefono: da_telefono || null,
      oggetto: oggetto || null,
      corpo,
      corpo_html: corpo_html || null,
      data_ricezione: data_ricezione || new Date().toISOString(),
      thread_id: thread_id || null,
      etichetta,
      etichetta_ai,
    }).select().single();

    if (error) throw error;

    return new Response(JSON.stringify({ success: true, message: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("handle-reply error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
