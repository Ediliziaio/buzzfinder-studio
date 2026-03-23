import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @deno-types="npm:@types/nodemailer"
import nodemailer from "npm:nodemailer@6";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { campaign_id, batch_size: rawBatchSize } = body as {
      campaign_id: string;
      batch_size?: number;
    };

    if (!campaign_id) {
      return new Response(
        JSON.stringify({ error: "campaign_id richiesto" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const batchSize = Math.min(rawBatchSize ?? 50, 200);

    // 1. Fetch campaign
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, tipo, user_id, subject, body_html, body_text, sender_email, sender_name, reply_to, sending_rate_per_hour, ai_personalization_enabled, tracking_aperture")
      .eq("id", campaign_id)
      .single();

    if (cErr || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campagna non trovata" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch pending recipients with contact data
    const { data: recipients, error: rErr } = await supabase
      .from("campaign_recipients")
      .select("id, contact_id, sender_id, contacts(azienda, email, nome, citta, sito_web)")
      .eq("campaign_id", campaign_id)
      .eq("stato", "pending")
      .not("sender_id", "is", null)
      .limit(batchSize);

    if (rErr) {
      return new Response(
        JSON.stringify({ error: `Errore caricamento destinatari: ${rErr.message}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!recipients || recipients.length === 0) {
      const { count: totalPending } = await supabase
        .from("campaign_recipients")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", campaign_id)
        .eq("stato", "pending");

      if (!totalPending || totalPending === 0) {
        await supabase
          .from("campaigns")
          .update({
            stato: "completata",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          } as any)
          .eq("id", campaign_id);
      }

      return new Response(
        JSON.stringify({ sent: 0, errors: 0, remaining: totalPending ?? 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Cache sender data
    const senderCache: Record<string, {
      resend_api_key?: string | null;
      smtp_config?: { host: string; port: number; user: string; password: string; secure: boolean } | null;
      email_from: string;
      email_nome?: string | null;
      reply_to?: string | null;
    } | null> = {};

    const getSender = async (senderId: string) => {
      if (senderId in senderCache) return senderCache[senderId];
      const { data } = await supabase
        .from("sender_pool")
        .select("resend_api_key, smtp_config, email_from, email_nome, reply_to")
        .eq("id", senderId)
        .maybeSingle();
      senderCache[senderId] = data;
      return data;
    };

    // SMTP transporter cache
    // deno-lint-ignore no-explicit-any
    const smtpTransporterCache: Record<string, any> = {};

    const getSmtpTransporter = (cfg: { host: string; port: number; user: string; password: string; secure: boolean }) => {
      const key = `${cfg.host}:${cfg.port}:${cfg.user}`;
      if (!smtpTransporterCache[key]) {
        smtpTransporterCache[key] = nodemailer.createTransport({
          host: cfg.host,
          port: cfg.port,
          secure: cfg.secure,
          auth: { user: cfg.user, pass: cfg.password },
        });
      }
      return smtpTransporterCache[key];
    };

    // 4. Process each recipient
    let sentCount = 0;
    let errorCount = 0;
    const senderCountsMap: Record<string, number> = {};

    for (const recipient of recipients) {
      const contact = (recipient as any).contacts as {
        azienda?: string | null;
        email?: string | null;
        nome?: string | null;
        citta?: string | null;
        sito_web?: string | null;
      } | null;

      if (!contact?.email) {
        await supabase
          .from("campaign_recipients")
          .update({ stato: "errore", errore: "Contatto senza email" } as any)
          .eq("id", recipient.id);
        errorCount++;
        continue;
      }

      const senderId = (recipient as any).sender_id as string;
      const sender = await getSender(senderId);

      if (!sender?.email_from) {
        await supabase
          .from("campaign_recipients")
          .update({ stato: "errore", errore: "Mittente non trovato" } as any)
          .eq("id", recipient.id);
        errorCount++;
        continue;
      }

      const hasResend = !!sender.resend_api_key;
      const hasSmtp = !!sender.smtp_config?.host;

      if (!hasResend && !hasSmtp) {
        await supabase
          .from("campaign_recipients")
          .update({ stato: "errore", errore: "Mittente senza API key o SMTP configurato" } as any)
          .eq("id", recipient.id);
        errorCount++;
        continue;
      }

      // Personalize subject + body
      const vars: Record<string, string> = {
        nome: contact.nome || "",
        azienda: contact.azienda || "",
        citta: contact.citta || "",
        sito_web: contact.sito_web || "",
      };

      const sub = (text: string): string =>
        text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");

      const personalizedSubject = sub(campaign.subject || "");
      let personalizedHtml = sub(campaign.body_html || "");
      const personalizedText = sub(campaign.body_text || "");

      // Tracking pixel + unsubscribe
      const trackUrl = `${supabaseUrl}/functions/v1/track-open?rid=${recipient.id}&cid=${campaign_id}`;
      const unsubUrl = `${supabaseUrl}/functions/v1/unsubscribe?email=${encodeURIComponent(contact.email)}&campaign_id=${campaign_id}`;
      if (campaign.tracking_aperture !== false) {
        personalizedHtml += `<img src="${trackUrl}" width="1" height="1" style="display:none;border:0" alt="" />`;
      }
      personalizedHtml += `<br><small style="color:#888"><a href="${unsubUrl}" style="color:#888">Cancellati dalla lista</a></small>`;

      const fromField = sender.email_nome
        ? `${sender.email_nome} <${sender.email_from}>`
        : sender.email_from;

      try {
        if (hasResend) {
          // ── Send via Resend ──────────────────────────────────────
          const resendBody: Record<string, unknown> = {
            from: fromField,
            to: [contact.email],
            subject: personalizedSubject,
            html: personalizedHtml,
            ...(personalizedText ? { text: personalizedText } : {}),
            ...(sender.reply_to ? { reply_to: sender.reply_to } : {}),
            headers: { "List-Unsubscribe": `<${unsubUrl}>, <mailto:unsub@${sender.email_from.split("@")[1]}>` },
          };

          const resendResp = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${sender.resend_api_key}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(resendBody),
          });

          if (resendResp.ok) {
            const resendData = await resendResp.json() as { id?: string };
            await supabase
              .from("campaign_recipients")
              .update({
                stato: "inviato",
                inviato_at: new Date().toISOString(),
                ...(resendData.id ? { canale_id: resendData.id } : {}),
              } as any)
              .eq("id", recipient.id);
            senderCountsMap[senderId] = (senderCountsMap[senderId] || 0) + 1;
            sentCount++;
          } else {
            const errBody = await resendResp.text();
            await supabase
              .from("campaign_recipients")
              .update({ stato: "errore", errore: `Resend [${resendResp.status}]: ${errBody}` } as any)
              .eq("id", recipient.id);
            errorCount++;
          }

        } else if (hasSmtp && sender.smtp_config) {
          // ── Send via SMTP (Google Workspace / custom) ────────────
          const transporter = getSmtpTransporter(sender.smtp_config);
          const info = await transporter.sendMail({
            from: fromField,
            to: contact.email,
            subject: personalizedSubject,
            html: personalizedHtml,
            ...(personalizedText ? { text: personalizedText } : {}),
            ...(sender.reply_to ? { replyTo: sender.reply_to } : {}),
            list: { unsubscribe: { url: unsubUrl } },
          });

          await supabase
            .from("campaign_recipients")
            .update({
              stato: "inviato",
              inviato_at: new Date().toISOString(),
              canale_id: info.messageId || null,
            } as any)
            .eq("id", recipient.id);
          senderCountsMap[senderId] = (senderCountsMap[senderId] || 0) + 1;
          sentCount++;
        }
      } catch (sendErr: unknown) {
        const msg = sendErr instanceof Error ? sendErr.message : "Errore sconosciuto";
        await supabase
          .from("campaign_recipients")
          .update({ stato: "errore", errore: msg } as any)
          .eq("id", recipient.id);
        errorCount++;
      }
    }

    // 5. Update sender counters
    for (const [senderId, count] of Object.entries(senderCountsMap)) {
      const { data: cur } = await supabase
        .from("sender_pool")
        .select("inviati_oggi, totale_inviati")
        .eq("id", senderId)
        .maybeSingle();
      if (cur) {
        await supabase
          .from("sender_pool")
          .update({
            inviati_oggi: (cur.inviati_oggi ?? 0) + count,
            totale_inviati: (cur.totale_inviati ?? 0) + count,
          } as any)
          .eq("id", senderId);
      }
    }

    // 6. Update campaign inviati
    if (sentCount > 0 || errorCount > 0) {
      const { data: cur } = await supabase
        .from("campaigns")
        .select("inviati, errori")
        .eq("id", campaign_id)
        .single();
      await supabase
        .from("campaigns")
        .update({
          inviati: (cur?.inviati ?? 0) + sentCount,
          errori: (cur?.errori ?? 0) + errorCount,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", campaign_id);
    }

    // 7. Check if campaign is complete
    const { count: remainingCount } = await supabase
      .from("campaign_recipients")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaign_id)
      .eq("stato", "pending");

    const remaining = remainingCount ?? 0;
    if (remaining === 0) {
      await supabase
        .from("campaigns")
        .update({
          stato: "completata",
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", campaign_id);
    }

    return new Response(
      JSON.stringify({ sent: sentCount, errors: errorCount, remaining }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Errore interno";
    return new Response(
      JSON.stringify({ error: msg, sent: 0, errors: 0, remaining: 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
