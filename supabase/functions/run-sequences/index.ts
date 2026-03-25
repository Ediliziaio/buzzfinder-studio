// ============================================================
// run-sequences — Motore sequenze email BuzzFinder
// Processa le iscrizioni scadute (next_send_at <= NOW)
// Invia via Resend, registra in sequence_sends, avanza step
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── Auth ────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await sb.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const sequenceId: string | null = body.sequence_id || null;
    const BATCH = 50;

    // ─── Leggi Resend API key ─────────────────────────────────────────────────
    const { data: settingRow } = await sb
      .from("app_settings")
      .select("valore")
      .eq("user_id", userId)
      .eq("chiave", "resend_api_key")
      .maybeSingle();
    const resendKey: string = settingRow?.valore || Deno.env.get("RESEND_API_KEY") || "";
    if (!resendKey) {
      return new Response(JSON.stringify({ error: "Resend API key non configurata" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Fetcha enrollment in scadenza ───────────────────────────────────────
    const now = new Date().toISOString();

    let enrollQuery = sb
      .from("sequence_enrollments")
      .select(`
        id, sequence_id, contact_id, sender_id, current_step, status, next_send_at,
        contacts:contact_id (nome, azienda, email, citta, sito_web),
        email_sequences:sequence_id (nome)
      `)
      .eq("user_id", userId)
      .eq("status", "attiva")
      .lte("next_send_at", now)
      .limit(BATCH);

    if (sequenceId) {
      enrollQuery = enrollQuery.eq("sequence_id", sequenceId);
    }

    const { data: enrollments, error: enrollErr } = await enrollQuery;
    if (enrollErr) throw enrollErr;
    if (!enrollments || enrollments.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, sent: 0, done: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sent = 0;
    let skipped = 0;

    for (const enrollment of enrollments) {
      const contact = enrollment.contacts as any;
      if (!contact?.email) { skipped++; continue; }

      const nextStep = enrollment.current_step + 1;

      // ─── Fetcha step corrente ─────────────────────────────────────────────
      const { data: step } = await sb
        .from("sequence_steps")
        .select("id, step_number, delay_days, subject, body")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_number", nextStep)
        .maybeSingle();

      if (!step) {
        // Nessuno step successivo → sequenza completata
        await sb
          .from("sequence_enrollments")
          .update({ status: "completata" })
          .eq("id", enrollment.id);
        continue;
      }

      // ─── Fetcha mittente ──────────────────────────────────────────────────
      const { data: sender } = await sb
        .from("sender_pool")
        .select("email_from, email_nome, smtp_host, smtp_port, smtp_user, smtp_pass")
        .eq("id", enrollment.sender_id)
        .maybeSingle();

      if (!sender?.email_from) { skipped++; continue; }

      // ─── Sostituisci variabili ────────────────────────────────────────────
      const substitute = (text: string) =>
        text
          .replace(/\{\{nome\}\}/gi, contact.nome ?? "")
          .replace(/\{\{azienda\}\}/gi, contact.azienda ?? "")
          .replace(/\{\{citta\}\}/gi, contact.citta ?? "")
          .replace(/\{\{sito_web\}\}/gi, contact.sito_web ?? "");

      const subject = substitute(step.subject || "");
      const htmlBody = substitute(step.body || "").replace(/\n/g, "<br>");

      // ─── Invia via Resend ─────────────────────────────────────────────────
      const fromName = sender.email_nome ? `${sender.email_nome} <${sender.email_from}>` : sender.email_from;

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromName,
          to: [contact.email],
          subject,
          html: htmlBody,
        }),
      });

      if (!resendRes.ok) {
        const errBody = await resendRes.text();
        console.error(`Resend error for ${contact.email}:`, errBody);
        skipped++;
        continue;
      }

      // ─── Registra invio ───────────────────────────────────────────────────
      await sb.from("sequence_sends").insert({
        enrollment_id: enrollment.id,
        step_id: step.id,
        step_number: nextStep,
        contact_id: enrollment.contact_id,
        sent_at: now,
        subject,
        from_email: sender.email_from,
      });

      // ─── Calcola prossimo step ────────────────────────────────────────────
      const { data: nextStepRow } = await sb
        .from("sequence_steps")
        .select("step_number, delay_days")
        .eq("sequence_id", enrollment.sequence_id)
        .eq("step_number", nextStep + 1)
        .maybeSingle();

      if (!nextStepRow) {
        // Ultima email inviata → completata
        await sb
          .from("sequence_enrollments")
          .update({
            current_step: nextStep,
            status: "completata",
            last_sent_at: now,
          })
          .eq("id", enrollment.id);
      } else {
        const nextSendDate = new Date();
        nextSendDate.setDate(nextSendDate.getDate() + (nextStepRow.delay_days || 1));
        await sb
          .from("sequence_enrollments")
          .update({
            current_step: nextStep,
            last_sent_at: now,
            next_send_at: nextSendDate.toISOString(),
          })
          .eq("id", enrollment.id);
      }

      sent++;
    }

    return new Response(
      JSON.stringify({
        processed: enrollments.length,
        sent,
        skipped,
        done: enrollments.length < BATCH,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
