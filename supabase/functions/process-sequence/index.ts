// ============================================================
// process-sequence — Motore sequenze multi-step BuzzFinder
// Allineato allo schema DB reale: campaign_steps, campaign_step_executions,
// campaign_recipients, contacts, sender_pool, suppression_list, app_settings
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── Helper: legge un valore da app_settings ─────────────────────────────────
async function getAppSetting(chiave: string): Promise<string | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("valore")
    .eq("chiave", chiave)
    .maybeSingle();
  return data?.valore || null;
}

// ─── Spintax: {opzione1|opzione2} → scelta deterministica ────────────────────
function processSpintax(text: string, seed: number): string {
  let rng = seed;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return Math.abs(rng) / 0x7fffffff;
  };
  return text.replace(/\{([^{}]+)\}/g, (_, options: string) => {
    const choices = options.split("|");
    return choices[Math.floor(rand() * choices.length)];
  });
}

// ─── Sostituisce variabili {{nome}}, {{azienda}}, ecc. ───────────────────────
function substituteVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
}

// ─── Controlla se siamo nell'orario di invio consentito ──────────────────────
function isInSendingWindow(
  timezone: string,
  oraInizio: string,
  oraFine: string,
  soloLavorativi: boolean
): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "Europe/Rome",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = formatter.formatToParts(now);
  const hour = parts.find((p) => p.type === "hour")?.value || "00";
  const minute = parts.find((p) => p.type === "minute")?.value || "00";
  const weekday = parts.find((p) => p.type === "weekday")?.value || "Mon";
  const currentTime = `${hour}:${minute}`;
  const isWeekend = ["Sat", "Sun"].includes(weekday);
  if (soloLavorativi && isWeekend) return false;
  if (oraInizio && oraFine) {
    return currentTime >= oraInizio && currentTime <= oraFine;
  }
  return true;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { campaign_id, batch_size = 50 } = body;

    // ─── 1. Carica esecuzioni schedulate ───────────────────────────────────
    let query = supabase
      .from("campaign_step_executions")
      .select(`
        id, campaign_id, step_id, recipient_id, sender_id, scheduled_at,
        campaign_steps!inner(step_number, tipo, condizione, soggetto, corpo_html, messaggio),
        campaigns!inner(
          nome, tipo, tipo_campagna, timezone, ora_inizio_invio, ora_fine_invio,
          solo_lavorativi, stop_su_risposta, tracking_aperture, stato
        )
      `)
      .eq("stato", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .limit(batch_size);

    if (campaign_id) query = query.eq("campaign_id", campaign_id);

    const { data: executions, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!executions || executions.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const exec of executions) {
      try {
        const campaign = (exec as any).campaigns;
        const step = (exec as any).campaign_steps;

        // ─── 2. Skip se campagna non in corso ────────────────────────────
        if (campaign.stato !== "in_corso") {
          await supabase
            .from("campaign_step_executions")
            .update({ stato: "skipped", error: "campaign_not_running" })
            .eq("id", exec.id);
          skipped++;
          continue;
        }

        // ─── 3. Check orario di invio ────────────────────────────────────
        const inWindow = isInSendingWindow(
          campaign.timezone || "Europe/Rome",
          campaign.ora_inizio_invio || "08:00",
          campaign.ora_fine_invio || "19:00",
          campaign.solo_lavorativi || false
        );
        if (!inWindow) continue; // Fuori finestra, riproverà al prossimo ciclo

        // ─── 4. Check condizione rispetto allo step precedente ───────────
        if (step.step_number > 1 && step.condizione !== "always") {
          const { data: prevSteps } = await supabase
            .from("campaign_step_executions")
            .select("id, stato, opened_at, replied_at")
            .eq("campaign_id", exec.campaign_id)
            .eq("recipient_id", exec.recipient_id)
            .neq("step_id", exec.step_id)
            .eq("stato", "sent")
            .order("created_at", { ascending: false })
            .limit(1);

          const prev = prevSteps?.[0];

          if (step.condizione === "if_no_reply" && prev?.replied_at) {
            await supabase.from("campaign_step_executions")
              .update({ stato: "skipped", error: "recipient_replied" })
              .eq("id", exec.id);
            skipped++;
            continue;
          }
          if (step.condizione === "if_no_open" && prev?.opened_at) {
            await supabase.from("campaign_step_executions")
              .update({ stato: "skipped", error: "recipient_opened" })
              .eq("id", exec.id);
            skipped++;
            continue;
          }
          if (step.condizione === "if_opened" && !prev?.opened_at) {
            await supabase.from("campaign_step_executions")
              .update({ stato: "skipped", error: "recipient_not_opened" })
              .eq("id", exec.id);
            skipped++;
            continue;
          }
        }

        // ─── 5. Check stop su risposta globale ──────────────────────────
        if (campaign.stop_su_risposta) {
          const { data: replied } = await supabase
            .from("campaign_step_executions")
            .select("id")
            .eq("campaign_id", exec.campaign_id)
            .eq("recipient_id", exec.recipient_id)
            .not("replied_at", "is", null)
            .limit(1);

          if (replied && replied.length > 0) {
            await supabase.from("campaign_step_executions")
              .update({ stato: "skipped", error: "stop_su_risposta" })
              .eq("id", exec.id);
            skipped++;
            continue;
          }
        }

        // ─── 6. Carica contatto tramite campaign_recipients ──────────────
        const { data: recipientRow } = await supabase
          .from("campaign_recipients")
          .select("contact_id, messaggio_personalizzato, soggetto_personalizzato, contacts(nome, cognome, azienda, email, telefono, sito_web)")
          .eq("id", exec.recipient_id)
          .maybeSingle();

        const contact = (recipientRow as any)?.contacts;
        if (!contact || !contact.email) {
          await supabase.from("campaign_step_executions")
            .update({ stato: "failed", error: "contact_not_found" })
            .eq("id", exec.id);
          failed++;
          continue;
        }

        // ─── 7. Check suppression list ───────────────────────────────────
        const { count: suppressedCount } = await supabase
          .from("suppression_list")
          .select("id", { count: "exact", head: true })
          .eq("email", contact.email);

        if ((suppressedCount || 0) > 0) {
          await supabase.from("campaign_step_executions")
            .update({ stato: "skipped", error: "suppressed" })
            .eq("id", exec.id);
          skipped++;
          continue;
        }

        // ─── 8. Prepara messaggio ────────────────────────────────────────
        const seed = exec.id.split("").reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
        const vars: Record<string, string> = {
          nome: contact.nome || "",
          cognome: contact.cognome || "",
          azienda: contact.azienda || "",
          sito_web: contact.sito_web || "",
          email: contact.email || "",
        };

        let oggetto = recipientRow?.soggetto_personalizzato || step.soggetto || "";
        let corpo = recipientRow?.messaggio_personalizzato || step.corpo_html || step.messaggio || "";

        // Applica spintax
        oggetto = processSpintax(oggetto, seed);
        corpo = processSpintax(corpo, seed + 1);

        // Sostituisci variabili
        oggetto = substituteVariables(oggetto, vars);
        corpo = substituteVariables(corpo, vars);

        // ─── 9. Aggiungi tracking pixel (solo email HTML) ────────────────
        if (step.tipo === "email" && step.corpo_html && campaign.tracking_aperture) {
          const baseUrl = Deno.env.get("SUPABASE_URL")!;
          const pixelUrl = `${baseUrl}/functions/v1/track-open?id=${exec.id}`;
          corpo += `<img src="${pixelUrl}" width="1" height="1" style="display:none" />`;
        }

        // ─── 10. Marca come "sent" ───────────────────────────────────────
        await supabase.from("campaign_step_executions").update({
          stato: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", exec.id);

        // ─── 11. Aggiorna stats step (fallback manuale) ─────────────────
        const { data: stepData } = await supabase
          .from("campaign_steps")
          .select("stat_inviati")
          .eq("id", exec.step_id)
          .maybeSingle();

        if (stepData) {
          await supabase.from("campaign_steps")
            .update({ stat_inviati: (stepData.stat_inviati || 0) + 1 })
            .eq("id", exec.step_id);
        }

        // ─── 12. Aggiorna sender stats ───────────────────────────────────
        if (exec.sender_id) {
          const { data: senderData } = await supabase
            .from("sender_pool")
            .select("inviati_oggi, totale_inviati")
            .eq("id", exec.sender_id)
            .maybeSingle();

          if (senderData) {
            await supabase.from("sender_pool").update({
              inviati_oggi: (senderData.inviati_oggi || 0) + 1,
              totale_inviati: (senderData.totale_inviati || 0) + 1,
            }).eq("id", exec.sender_id);
          }
        }

        // ─── 13. Schedula step successivo ────────────────────────────────
        const { data: nextStep } = await supabase
          .from("campaign_steps")
          .select("id, delay_giorni, delay_ore")
          .eq("campaign_id", exec.campaign_id)
          .eq("step_number", step.step_number + 1)
          .is("ab_padre_id", null)
          .maybeSingle();

        if (nextStep) {
          const nextScheduledAt = new Date();
          nextScheduledAt.setDate(nextScheduledAt.getDate() + (nextStep.delay_giorni || 0));
          nextScheduledAt.setHours(nextScheduledAt.getHours() + (nextStep.delay_ore || 0));

          await supabase.from("campaign_step_executions").insert({
            campaign_id: exec.campaign_id,
            step_id: nextStep.id,
            recipient_id: exec.recipient_id,
            sender_id: exec.sender_id,
            stato: "scheduled",
            scheduled_at: nextScheduledAt.toISOString(),
          });
        }

        processed++;
      } catch (err: any) {
        failed++;
        await supabase.from("campaign_step_executions").update({
          stato: "failed",
          error: err.message,
        }).eq("id", exec.id);
        console.error(`Execution ${exec.id} failed:`, err.message);
      }
    }

    return new Response(
      JSON.stringify({ processed, skipped, failed, total: executions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("process-sequence error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
