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
            const now = new Date().toISOString();

            // Check if lead already exists in pipeline_leads
            const { data: existingLead } = await supabase
              .from("pipeline_leads")
              .select("id")
              .eq("contact_id", exec.contact_id)
              .eq("user_id", userId)
              .maybeSingle();

            if (existingLead) {
              // Update existing pipeline lead
              await supabase
                .from("pipeline_leads")
                .update({
                  pipeline_stage: params.nuovo_stage,
                  pipeline_updated: now,
                  pipeline_note: `Automaticamente da regola: ${rule.nome}`,
                })
                .eq("id", existingLead.id);
            } else {
              // Create new pipeline lead
              await supabase
                .from("pipeline_leads")
                .insert({
                  user_id: userId,
                  contact_id: exec.contact_id,
                  campaign_id: exec.campaign_id || null,
                  pipeline_stage: params.nuovo_stage,
                  pipeline_updated: now,
                  pipeline_note: `Automaticamente da regola: ${rule.nome}`,
                });
            }

            risultato = { stage_aggiornato: params.nuovo_stage, created: !existingLead };
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
            const params = rule.azione_params as {
              oggetto?: string;
              corpo?: string;
              sender_id?: string;
            };

            if (!params.oggetto || !params.corpo) {
              risultato = { skipped: true, motivo: "Parametri invia_email incompleti (mancano oggetto o corpo)" };
              break;
            }

            const { data: contact } = await supabase
              .from("contacts")
              .select("nome, cognome, azienda, email")
              .eq("id", exec.contact_id)
              .single();

            if (!contact?.email) {
              risultato = { skipped: true, motivo: "Contatto senza email" };
              break;
            }

            let emailSender: { resend_api_key: string; email_from: string; email_nome?: string; reply_to?: string } | null = null;

            if (params.sender_id) {
              const { data: s } = await supabase
                .from("sender_pool")
                .select("resend_api_key, email_from, email_nome, reply_to")
                .eq("id", params.sender_id)
                .eq("user_id", userId)
                .maybeSingle();
              emailSender = s;
            } else {
              const { data: s } = await supabase
                .from("sender_pool")
                .select("resend_api_key, email_from, email_nome, reply_to")
                .eq("user_id", userId)
                .eq("tipo", "email")
                .eq("attivo", true)
                .neq("stato", "banned")
                .order("health_score", { ascending: false })
                .limit(1)
                .maybeSingle();
              emailSender = s;
            }

            if (!emailSender?.resend_api_key || !emailSender?.email_from) {
              risultato = { skipped: true, motivo: "Nessun mittente email attivo configurato" };
              break;
            }

            const substituteVars = (text: string) =>
              text.replace(/\{\{(\w+)\}\}/g, (_, key) => ({
                nome: contact.nome || "",
                cognome: contact.cognome || "",
                azienda: contact.azienda || "",
                email: contact.email || "",
              })[key] || "");

            const oggettoEmail = substituteVars(params.oggetto);
            const corpoEmail = substituteVars(params.corpo);

            const resendResp = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${emailSender.resend_api_key}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: emailSender.email_nome
                  ? `${emailSender.email_nome} <${emailSender.email_from}>`
                  : emailSender.email_from,
                to: [contact.email],
                subject: oggettoEmail,
                html: `<div style="font-family:sans-serif;font-size:14px">${corpoEmail.replace(/\n/g, "<br>")}</div>`,
                ...(emailSender.reply_to ? { reply_to: emailSender.reply_to } : {}),
              }),
            });

            if (resendResp.ok) {
              risultato = { email_inviata: true, destinatario: contact.email };
            } else {
              const errBody = await resendResp.text();
              throw new Error(`Resend error [${resendResp.status}]: ${errBody}`);
            }
            break;
          }

          case "aggiungi_a_sequenza": {
            const params = rule.azione_params as {
              campaign_id: string;
              delay_ore?: number;
            };

            if (!params.campaign_id) {
              risultato = { skipped: true, motivo: "Parametro campaign_id mancante" };
              break;
            }

            const { data: campaign } = await supabase
              .from("campaigns")
              .select("id, tipo, stato")
              .eq("id", params.campaign_id)
              .eq("user_id", userId)
              .maybeSingle();

            if (!campaign) {
              risultato = { skipped: true, motivo: "Campagna non trovata o non autorizzata" };
              break;
            }

            const { data: existingRecipient } = await supabase
              .from("campaign_recipients")
              .select("id")
              .eq("campaign_id", params.campaign_id)
              .eq("contact_id", exec.contact_id)
              .maybeSingle();

            if (existingRecipient) {
              risultato = { skipped: true, motivo: "Contatto già presente nella sequenza" };
              break;
            }

            const { data: firstStep } = await supabase
              .from("campaign_steps")
              .select("id, delay_giorni, delay_ore")
              .eq("campaign_id", params.campaign_id)
              .eq("step_number", 1)
              .is("ab_padre_id", null)
              .maybeSingle();

            if (!firstStep) {
              risultato = { skipped: true, motivo: "Nessuno step trovato nella sequenza" };
              break;
            }

            const { data: newRecipient, error: recipientErr } = await supabase
              .from("campaign_recipients")
              .insert({
                user_id: userId,
                campaign_id: params.campaign_id,
                contact_id: exec.contact_id,
                stato: "pending",
              })
              .select("id")
              .single();

            if (recipientErr || !newRecipient) {
              throw new Error(`Errore aggiunta recipient: ${recipientErr?.message}`);
            }

            const scheduledAt = new Date();
            scheduledAt.setHours(scheduledAt.getHours() + (params.delay_ore || firstStep.delay_ore || 0));
            scheduledAt.setDate(scheduledAt.getDate() + (firstStep.delay_giorni || 0));

            await supabase.from("campaign_step_executions").insert({
              campaign_id: params.campaign_id,
              step_id: firstStep.id,
              recipient_id: newRecipient.id,
              stato: "scheduled",
              scheduled_at: scheduledAt.toISOString(),
            });

            risultato = { aggiunto: true, campaign_id: params.campaign_id, recipient_id: newRecipient.id };
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
