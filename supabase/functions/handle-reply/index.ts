import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Multi-model AI helper ──────────────────────────────────
async function callAI(
  supabase: any,
  userId: string | null,
  prompt: string,
  systemPrompt: string
): Promise<string> {
  // Read active model (try user-specific, then any)
  let modelRow;
  if (userId) {
    const r = await supabase
      .from("app_settings")
      .select("valore")
      .eq("chiave", "ai_model_attivo")
      .eq("user_id", userId)
      .maybeSingle();
    modelRow = r.data;
  }
  const model = modelRow?.valore || "lovable-gemini-flash";

  if (model.startsWith("moonshot-")) {
    const { data: keyRow } = await supabase
      .from("app_settings")
      .select("valore")
      .eq("chiave", "kimi_api_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (keyRow?.valore) {
      const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keyRow.valore}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
          max_tokens: 100,
          temperature: 0.3,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content?.trim() || "";
      }
    }
    // Fall through to Lovable AI
  }

  if (model.startsWith("claude-")) {
    const { data: keyRow } = await supabase
      .from("app_settings")
      .select("valore")
      .eq("chiave", "anthropic_api_key")
      .eq("user_id", userId)
      .maybeSingle();

    if (keyRow?.valore) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": keyRow.valore,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 100,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.content?.[0]?.text?.trim() || "";
      }
    }
    // Fall through to Lovable AI
  }

  // ─── LOVABLE AI (default / fallback) ─────────────────────
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return "";

  const lovableModel =
    model === "lovable-gemini-pro" ? "google/gemini-2.5-pro" :
    model === "lovable-gpt5-mini" ? "openai/gpt-5-mini" :
    "google/gemini-2.5-flash-lite";

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: lovableModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) return "";
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload = await req.json();

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

    // Classify with AI (multi-model)
    let etichetta = "non_categorizzato";
    let etichetta_ai = false;

    const SYSTEM_PROMPT = `Classifica questa risposta email/messaggio in UNA delle seguenti etichette:
interessato, non_interessato, richiesta_info, fuori_ufficio, appuntamento_fissato, referral, obiezione, disiscrizione, non_categorizzato.
Rispondi con SOLO l'etichetta, nient'altro.`;

    try {
      const raw = await callAI(
        supabase,
        user_id,
        `Oggetto: ${oggetto || "(nessuno)"}\n\nCorpo:\n${corpo}`,
        SYSTEM_PROMPT
      );

      const valid = [
        "interessato", "non_interessato", "richiesta_info", "fuori_ufficio",
        "appuntamento_fissato", "referral", "obiezione", "disiscrizione", "non_categorizzato",
      ];
      const cleaned = raw.toLowerCase().trim();
      if (valid.includes(cleaned)) {
        etichetta = cleaned;
        etichetta_ai = true;
      }
    } catch (e) {
      console.error("AI classification failed:", e);
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
