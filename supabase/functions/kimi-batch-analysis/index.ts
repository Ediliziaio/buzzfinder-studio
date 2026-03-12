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

    const { days = 90 } = await req.json();

    // Get Kimi API key
    const { data: keyRow } = await supabase
      .from("app_settings")
      .select("valore")
      .eq("chiave", "kimi_api_key")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!keyRow?.valore) {
      return new Response(JSON.stringify({ error: "kimi_api_key non configurata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load messages
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data: messages, error: msgError } = await supabase
      .from("inbox_messages")
      .select("da_nome, da_email, etichetta, corpo, data_ricezione, campaign_id")
      .eq("user_id", user.id)
      .gte("data_ricezione", cutoff)
      .order("data_ricezione", { ascending: false })
      .limit(500);

    if (msgError) throw msgError;

    if (!messages?.length) {
      return new Response(JSON.stringify({ analysis: "Nessuna risposta trovata nel periodo selezionato.", message_count: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format for Kimi
    const formatted = messages.map((m) =>
      `[${m.etichetta}] Da: ${m.da_nome || m.da_email || "?"} (${new Date(m.data_ricezione).toLocaleDateString("it")})\n${(m.corpo || "").slice(0, 400)}`
    ).join("\n\n---\n\n");

    // Call Kimi
    const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${keyRow.valore}`,
      },
      body: JSON.stringify({
        model: "moonshot-v1-128k",
        messages: [
          {
            role: "system",
            content: "Sei un esperto di email marketing e outreach B2B. Analizza le risposte email ricevute da campagne di outreach e fornisci insights azionabili in italiano.",
          },
          {
            role: "user",
            content: `Analizza queste ${messages.length} risposte email e dimmi:
1. Quali sono le obiezioni più comuni?
2. Qual è il sentiment generale (interessato/negativo/neutro)?
3. 3 suggerimenti concreti per migliorare i messaggi futuri.
4. Pattern nei messaggi che hanno generato interesse.

RISPOSTE:\n${formatted}`,
          },
        ],
        max_tokens: 2000,
        temperature: 0.5,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Kimi API error ${res.status}: ${errText}`);
    }

    const aiData = await res.json();
    const analysis = aiData.choices?.[0]?.message?.content || "Nessun risultato";

    return new Response(
      JSON.stringify({ analysis, message_count: messages.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("kimi-batch-analysis error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
