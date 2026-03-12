import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, xi-api-key, x-client-info, apikey, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function estraiEsitoDaConversazione(
  trascrizione: string,
  riassunto: string,
  apiKey: string
): Promise<{ esito: string; sentiment: string; note: string; data_richiamo: string | null }> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `Analizza questa chiamata di cold outreach B2B e rispondi SOLO con JSON valido.

Riassunto: ${riassunto?.slice(0, 500) || ""}
Trascrizione: ${trascrizione?.slice(0, 1000) || ""}

Rispondi SOLO con questo JSON (nessun testo extra):
{
  "esito": "interessato|non_interessato|richiama|appuntamento|da_analizzare|altro",
  "sentiment": "positivo|neutro|negativo",
  "note": "max 100 caratteri con punti chiave emersi",
  "vuole_richiamo": true/false,
  "data_richiamo_suggerita": "YYYY-MM-DD o null"
}`,
        }],
      }),
    });

    if (!res.ok) return defaultEsito();
    const data = await res.json();
    const raw = data.content?.[0]?.text || "{}";

    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = codeBlock ? codeBlock[1].trim() : raw.trim();
    const parsed = JSON.parse(jsonStr);

    return {
      esito: parsed.esito || "da_analizzare",
      sentiment: parsed.sentiment || "neutro",
      note: parsed.note || "",
      data_richiamo: parsed.vuole_richiamo && parsed.data_richiamo_suggerita
        ? new Date(parsed.data_richiamo_suggerita).toISOString()
        : null,
    };
  } catch {
    return defaultEsito();
  }
}

function defaultEsito() {
  return { esito: "da_analizzare", sentiment: "neutro", note: "", data_richiamo: null };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("call-webhook received:", JSON.stringify(body).slice(0, 500));

    const {
      type,
      call_sid,
      conversation_id,
      transcript,
      summary,
      duration_seconds,
      status,
      recording_url,
    } = body;

    const elevenCallId = call_sid || conversation_id;

    if (!elevenCallId) {
      console.log("call-webhook: nessun call ID nel payload, ignoro");
      return new Response("ok", { status: 200 });
    }

    // Trova la sessione nel DB
    const { data: callSession } = await supabase
      .from("call_sessions")
      .select("id, contact_id, campaign_id, recipient_id, automation_rule_id, user_id")
      .eq("elevenlabs_call_id", elevenCallId)
      .maybeSingle();

    if (!callSession) {
      console.log(`call-webhook: sessione non trovata per ${elevenCallId}`);
      return new Response("ok", { status: 200 });
    }

    // Normalizza stato
    const statoMap: Record<string, string> = {
      "completed": "completed",
      "no-answer": "no_answer",
      "no_answer": "no_answer",
      "busy": "busy",
      "failed": "failed",
      "voicemail": "voicemail",
    };
    const statoNormalizzato = statoMap[status] || (type === "call_ended" ? "completed" : "failed");

    // Trascrizione come testo
    let trascrizioneTestuale = "";
    if (typeof transcript === "string") {
      trascrizioneTestuale = transcript;
    } else if (Array.isArray(transcript)) {
      trascrizioneTestuale = transcript
        .map((t: { role: string; message: string }) => `${t.role === "agent" ? "Agente" : "Lead"}: ${t.message}`)
        .join("\n");
    }

    // Estrai esito con Claude
    let esito = "da_analizzare";
    let sentiment = "neutro";
    let noteAi = "";
    let dataRichiamo: string | null = null;

    if (statoNormalizzato === "completed" && (trascrizioneTestuale || summary)) {
      const { data: apiKeySetting } = await supabase
        .from("app_settings")
        .select("valore")
        .eq("chiave", "anthropic_api_key")
        .maybeSingle();

      if (apiKeySetting?.valore) {
        const analisi = await estraiEsitoDaConversazione(
          trascrizioneTestuale,
          summary || "",
          apiKeySetting.valore
        );
        esito = analisi.esito;
        sentiment = analisi.sentiment;
        noteAi = analisi.note;
        dataRichiamo = analisi.data_richiamo;
      }
    }

    // Calcola costo in EUR
    const durataMinuti = (duration_seconds || 0) / 60;
    const costoEur = durataMinuti * 0.10 * 0.92;

    // Aggiorna sessione chiamata
    await supabase
      .from("call_sessions")
      .update({
        stato: statoNormalizzato,
        ended_at: new Date().toISOString(),
        durata_secondi: duration_seconds || null,
        trascrizione: trascrizioneTestuale || null,
        riassunto_ai: summary || null,
        sentiment,
        esito,
        data_richiamo: dataRichiamo,
        note_ai: noteAi || null,
        costo_eur: costoEur,
        minuti_fatturati: Math.ceil(durataMinuti * 100) / 100,
        recording_url: recording_url || null,
      })
      .eq("id", callSession.id);

    // Aggiorna esito ultima chiamata sul contatto
    await supabase
      .from("contacts")
      .update({ esito_ultima_chiamata: esito })
      .eq("id", callSession.contact_id);

    // Pipeline updates
    if (esito === "interessato" && callSession.recipient_id) {
      await supabase
        .from("campaign_recipients")
        .update({
          pipeline_stage: "interessato",
          pipeline_updated: new Date().toISOString(),
        })
        .eq("id", callSession.recipient_id)
        .is("pipeline_stage", null);
    }

    if (esito === "appuntamento" && callSession.recipient_id) {
      await supabase
        .from("campaign_recipients")
        .update({
          pipeline_stage: "meeting_fissato",
          pipeline_updated: new Date().toISOString(),
        })
        .eq("id", callSession.recipient_id);
    }

    // Salva in inbox_messages
    if (trascrizioneTestuale && callSession.user_id) {
      const etichettaMap: Record<string, string> = {
        "interessato": "interessato",
        "appuntamento": "appuntamento_fissato",
        "non_interessato": "non_interessato",
        "richiama": "richiesta_info",
      };
      await supabase.from("inbox_messages").insert({
        user_id: callSession.user_id,
        campaign_id: callSession.campaign_id,
        recipient_id: callSession.recipient_id,
        canale: "email", // fallback since 'chiamata' may not be in CHECK constraint
        oggetto: `Trascrizione chiamata AI`,
        corpo: trascrizioneTestuale,
        data_ricezione: new Date().toISOString(),
        etichetta: etichettaMap[esito] || "non_categorizzato",
        etichetta_ai: true,
        note: noteAi || null,
      }).then(() => {}).catch((err) => {
        console.error("inbox_messages insert error:", err);
      });
    }

    // Trigger automazioni
    await triggerAutomazioni(callSession.campaign_id, callSession.contact_id, callSession.user_id, {
      tipo: "chiamata_completata",
      call_session_id: callSession.id,
      esito,
      sentiment,
    });

    if (esito !== "da_analizzare") {
      await triggerAutomazioni(callSession.campaign_id, callSession.contact_id, callSession.user_id, {
        tipo: "chiamata_esito",
        esito,
        call_session_id: callSession.id,
      });
    }

    return new Response(JSON.stringify({ ok: true, esito }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err) {
    console.error("call-webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

async function triggerAutomazioni(
  campaignId: string | null,
  contactId: string,
  userId: string,
  contesto: { tipo: string; [key: string]: unknown }
) {
  try {
    let query = supabase
      .from("automation_rules")
      .select("*")
      .eq("attiva", true)
      .eq("trigger_tipo", contesto.tipo);

    if (campaignId) {
      query = query.or(`campaign_id.eq.${campaignId},campaign_id.is.null`);
    } else {
      query = query.is("campaign_id", null);
    }

    const { data: rules } = await query;
    if (!rules?.length) return;

    for (const rule of rules) {
      // Controlla cooldown
      const { data: recentExec } = await supabase
        .from("automation_executions")
        .select("id, created_at")
        .eq("rule_id", rule.id)
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentExec) {
        const orePassate = (Date.now() - new Date(recentExec.created_at).getTime()) / 3600000;
        if (orePassate < (rule.cooldown_ore || 24)) continue;
      }

      const { count } = await supabase
        .from("automation_executions")
        .select("id", { count: "exact" })
        .eq("rule_id", rule.id)
        .eq("contact_id", contactId);

      if ((count || 0) >= (rule.max_esecuzioni_per_contatto || 1)) continue;

      await supabase.from("automation_executions").insert({
        user_id: userId,
        rule_id: rule.id,
        contact_id: contactId,
        campaign_id: campaignId,
        stato: "pending",
        trigger_contesto: contesto,
      });
    }
  } catch (err) {
    console.error("triggerAutomazioni error:", err);
  }
}
