import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getAppSetting(userId: string, chiave: string): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("valore")
    .eq("chiave", chiave)
    .eq("user_id", userId)
    .maybeSingle();
  return data?.valore || null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Validate caller: require Authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Allow service_role or authenticated users
  if (token !== serviceRoleKey) {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Token non valido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  const results = { processed: 0, completed: 0, failed: 0, skipped: 0, errors: [] as string[] };

  try {
    const { batch_size = 20 } = await req.json().catch(() => ({}));

    // Extract user_id from JWT for multi-tenant isolation
    let filterUserId: string | null = null;
    if (token !== serviceRoleKey) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) filterUserId = user.id;
    }

    let execQuery = supabase
      .from("automation_executions")
      .select("*, automation_rules(*)")
      .eq("stato", "pending")
      .order("created_at", { ascending: true })
      .limit(batch_size);

    // If called by authenticated user, only process their executions
    if (filterUserId) {
      execQuery = execQuery.eq("user_id", filterUserId);
    }

    const { data: executions, error } = await execQuery;

    if (error) throw error;
    if (!executions?.length) {
      return new Response(JSON.stringify({ ...results, message: "Nessuna automazione in coda" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const exec of executions) {
      results.processed++;
      const rule = (exec as any).automation_rules;

      if (!rule) {
        await supabase.from("automation_executions")
          .update({ stato: "failed", error_message: "Regola non trovata" })
          .eq("id", exec.id);
        results.failed++;
        continue;
      }

      await supabase.from("automation_executions")
        .update({ stato: "running" })
        .eq("id", exec.id);

      // Use the execution's user_id for settings lookup
      const userId = exec.user_id;

      try {
        let risultato: Record<string, unknown> = {};

        switch (rule.azione_tipo) {
          case "chiama_contatto": {
            const params = rule.azione_params as {
              agent_id?: string;
              delay_minuti?: number;
              script_contesto?: string;
              obiettivo?: string;
            };

            const scheduledAt = params.delay_minuti
              ? new Date(Date.now() + params.delay_minuti * 60 * 1000).toISOString()
              : null;

            const callRes = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/make-call`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                contact_id: exec.contact_id,
                campaign_id: exec.campaign_id,
                agent_id: params.agent_id || await getAppSetting(userId, "elevenlabs_agent_id_default"),
                scheduled_at: scheduledAt,
                script_contesto: params.script_contesto,
                obiettivo: params.obiettivo,
                automation_rule_id: rule.id,
              }),
            });

            const callData = await callRes.json();
            risultato = { chiamata_avviata: callRes.ok, ...callData };
            break;
          }

          case "cambia_pipeline_stage": {
            const params = rule.azione_params as { nuovo_stage: string };
            if (!exec.campaign_id) {
              console.warn(`cambia_pipeline_stage: campaign_id null per exec ${exec.id}, skip`);
              risultato = { skipped: true, motivo: "campaign_id mancante, impossibile trovare recipient" };
              break;
            }
            await supabase
              .from("campaign_recipients")
              .update({
                pipeline_stage: params.nuovo_stage,
                pipeline_updated: new Date().toISOString(),
                pipeline_note: `Automaticamente da regola: ${rule.nome}`,
              })
              .eq("contact_id", exec.contact_id)
              .eq("campaign_id", exec.campaign_id);

            risultato = { stage_aggiornato: params.nuovo_stage };
            break;
          }

          case "assegna_tag": {
            const params = rule.azione_params as { tags: string[] };

            const { data: contact } = await supabase
              .from("contacts")
              .select("tags")
              .eq("id", exec.contact_id)
              .single();

            const tagsAttuali: string[] = contact?.tags || [];
            const nuoviTags = [...new Set([...tagsAttuali, ...params.tags])];

            await supabase
              .from("contacts")
              .update({ tags: nuoviTags })
              .eq("id", exec.contact_id);

            risultato = { tags_aggiunti: params.tags };
            break;
          }

          case "notifica_webhook": {
            const params = rule.azione_params as { url: string; metodo?: string };

            const { data: contact } = await supabase
              .from("contacts")
              .select("id, nome, cognome, azienda, email, telefono, citta")
              .eq("id", exec.contact_id)
              .single();

            const webhookRes = await fetch(params.url, {
              method: params.metodo || "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rule_nome: rule.nome,
                trigger: exec.trigger_contesto,
                contact,
                campaign_id: exec.campaign_id,
                timestamp: new Date().toISOString(),
              }),
            });

            risultato = { webhook_status: webhookRes.status, ok: webhookRes.ok };
            break;
          }

          case "notifica_slack": {
            const slackUrl = await getAppSetting(userId, "slack_webhook_url");
            if (!slackUrl) {
              risultato = { skipped: true, motivo: "slack_webhook_url non configurato" };
              break;
            }

            const { data: contact } = await supabase
              .from("contacts")
              .select("nome, azienda, email")
              .eq("id", exec.contact_id)
              .single();

            const triggerContesto = exec.trigger_contesto as Record<string, unknown>;
            await fetch(slackUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: `🤖 *BuzzFinder Automation: ${rule.nome}*\n` +
                      `📞 Contatto: ${contact?.nome || ""} - ${contact?.azienda || ""}\n` +
                      `📧 Email: ${contact?.email || ""}\n` +
                      `🎯 Trigger: ${rule.trigger_tipo}\n` +
                      (triggerContesto?.esito ? `✅ Esito: ${triggerContesto.esito}\n` : "") +
                      `⏰ ${new Date().toLocaleString("it-IT")}`,
              }),
            });

            risultato = { slack_notificato: true };
            break;
          }

          case "invia_email": {
            // TODO: implementare invio email tramite edge function send-reply o Resend
            risultato = { skipped: true, motivo: "Azione invia_email non ancora implementata" };
            break;
          }

          case "aggiungi_a_sequenza": {
            // TODO: implementare aggiunta a sequenza campaign
            risultato = { skipped: true, motivo: "Azione aggiungi_a_sequenza non ancora implementata" };
            break;
          }

          default:
            risultato = { skipped: true, motivo: `Azione ${rule.azione_tipo} non implementata` };
        }

        const isSkipped = !!(risultato as any)?.skipped;
        const finalStato = isSkipped ? "skipped" : "completed";

        await supabase.from("automation_executions").update({
          stato: finalStato,
          azione_risultato: risultato,
          completato_at: new Date().toISOString(),
        }).eq("id", exec.id);

        if (!isSkipped) {
          await supabase.from("automation_rules").update({
            volte_eseguita: (rule.volte_eseguita || 0) + 1,
            ultima_esecuzione: new Date().toISOString(),
          }).eq("id", rule.id);
        }

        if (isSkipped) results.skipped++;
        else results.completed++;

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(msg);

        await supabase.from("automation_executions").update({
          stato: "failed",
          error_message: msg,
        }).eq("id", exec.id);

        results.failed++;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
