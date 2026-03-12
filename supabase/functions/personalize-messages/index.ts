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
  userId: string,
  prompt: string,
  systemPrompt: string
): Promise<string> {
  // Read active model
  const { data: modelRow } = await supabase
    .from("app_settings")
    .select("valore")
    .eq("chiave", "ai_model_attivo")
    .eq("user_id", userId)
    .maybeSingle();

  const model = modelRow?.valore || "lovable-gemini-flash";

  if (model.startsWith("moonshot-")) {
    // ─── KIMI (Moonshot AI) ─────────────────────────────────
    const { data: keyRow } = await supabase
      .from("app_settings")
      .select("valore")
      .eq("chiave", "kimi_api_key")
      .eq("user_id", userId)
      .maybeSingle();
    if (!keyRow?.valore) throw new Error("kimi_api_key non configurata");

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
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Kimi error: ${JSON.stringify(data)}`);
    return data.choices?.[0]?.message?.content || "";
  }

  if (model.startsWith("claude-")) {
    // ─── ANTHROPIC ──────────────────────────────────────────
    const { data: keyRow } = await supabase
      .from("app_settings")
      .select("valore")
      .eq("chiave", "anthropic_api_key")
      .eq("user_id", userId)
      .maybeSingle();
    if (!keyRow?.valore) throw new Error("anthropic_api_key non configurata");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": keyRow.valore,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`Anthropic error: ${JSON.stringify(data)}`);
    return data.content?.[0]?.text || "";
  }

  // ─── LOVABLE AI (default) ───────────────────────────────
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configurata");

  const lovableModel =
    model === "lovable-gemini-pro" ? "google/gemini-2.5-pro" :
    model === "lovable-gpt5-mini" ? "openai/gpt-5-mini" :
    "google/gemini-2.5-flash";

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

  if (res.status === 429) throw new Error("Rate limit AI raggiunto, riprova tra poco");
  if (res.status === 402) throw new Error("Crediti AI esauriti");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Lovable AI error: ${t}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify user
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { campaign_id, batch_size = 20 } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id richiesto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get campaign
    const { data: campaign, error: campError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", campaign_id)
      .eq("user_id", user.id)
      .single();

    if (campError || !campaign) {
      return new Response(JSON.stringify({ error: "Campagna non trovata" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status
    await supabase
      .from("campaigns")
      .update({ ai_personalization_status: "processing" })
      .eq("id", campaign_id);

    // Get recipients without personalization
    const { data: recipients } = await supabase
      .from("campaign_recipients")
      .select("id, contact_id, contacts!contact_id(nome, cognome, azienda, sito_web, email, note)")
      .eq("campaign_id", campaign_id)
      .is("messaggio_personalizzato", null)
      .limit(batch_size);

    if (!recipients?.length) {
      await supabase
        .from("campaigns")
        .update({ ai_personalization_status: "completed" })
        .eq("id", campaign_id);
      return new Response(JSON.stringify({ processed: 0, message: "Nessun destinatario da personalizzare" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Sei un esperto copywriter B2B. Personalizza l'email in base ai dati del contatto.
${campaign.ai_context ? `Contesto: ${campaign.ai_context}` : ""}
${campaign.ai_objective ? `Obiettivo: ${campaign.ai_objective}` : ""}
Rispondi con SOLO il testo personalizzato, senza preamboli.`;

    let processed = 0;
    let errors = 0;

    for (const recipient of recipients) {
      try {
        const contact = (recipient as any).contacts;
        if (!contact) continue;

        const prompt = `Personalizza questo messaggio per:
Nome: ${contact.nome || ""} ${contact.cognome || ""}
Azienda: ${contact.azienda || ""}
Sito web: ${contact.sito_web || "N/A"}
Note: ${contact.note || "N/A"}

Template soggetto: ${campaign.subject || ""}
Template corpo: ${campaign.body_text || campaign.body_html || ""}`;

        const result = await callAI(supabase, user.id, prompt, systemPrompt);

        // Split result: first line = subject, rest = body
        const lines = result.split("\n").filter(Boolean);
        const soggetto = lines[0]?.replace(/^(Oggetto|Subject):?\s*/i, "") || campaign.subject;
        const messaggio = lines.slice(1).join("\n") || result;

        await supabase
          .from("campaign_recipients")
          .update({
            soggetto_personalizzato: soggetto,
            messaggio_personalizzato: messaggio,
          })
          .eq("id", recipient.id);

        processed++;

        await supabase
          .from("campaigns")
          .update({
            ai_personalization_processed: (campaign.ai_personalization_processed || 0) + processed,
          })
          .eq("id", campaign_id);
      } catch (e) {
        console.error(`Error personalizing ${recipient.id}:`, e);
        errors++;
      }
    }

    // Final status
    const totalRemaining = await supabase
      .from("campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .is("messaggio_personalizzato", null);

    const finalStatus = (totalRemaining.count || 0) === 0 ? "completed" : "partial";
    await supabase
      .from("campaigns")
      .update({ ai_personalization_status: finalStatus })
      .eq("id", campaign_id);

    return new Response(
      JSON.stringify({ processed, errors, status: finalStatus }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("personalize-messages error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
