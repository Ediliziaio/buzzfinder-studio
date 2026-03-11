import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Get all distinct user_ids from sender_pool
  const { data: senders } = await supabase
    .from("sender_pool")
    .select("*")
    .eq("attivo", true);

  if (!senders?.length) {
    return new Response(JSON.stringify({ message: "No active senders" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Group senders by user_id
  const byUser: Record<string, typeof senders> = {};
  for (const s of senders) {
    if (!byUser[s.user_id]) byUser[s.user_id] = [];
    byUser[s.user_id].push(s);
  }

  const results: string[] = [];

  for (const [userId, userSenders] of Object.entries(byUser)) {
    // Get recent blacklist checks
    const { data: checks } = await supabase
      .from("blacklist_checks")
      .select("*")
      .eq("user_id", userId)
      .order("checked_at", { ascending: false })
      .limit(50);

    // Find a Resend API key from user's email senders
    const emailSender = userSenders.find(
      (s) => s.tipo === "email" && s.resend_api_key
    );

    if (!emailSender?.resend_api_key || !emailSender?.email_from) {
      results.push(`${userId}: skipped (no Resend key)`);
      continue;
    }

    // Build report HTML
    const now = new Date().toLocaleDateString("it-IT", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const senderRows = userSenders
      .map((s) => {
        const bounceColor =
          Number(s.bounce_rate) > 0.05
            ? "#ef4444"
            : Number(s.bounce_rate) > 0.02
            ? "#f59e0b"
            : "#22c55e";
        const spamColor =
          Number(s.spam_rate) > 0.003
            ? "#ef4444"
            : Number(s.spam_rate) > 0.001
            ? "#f59e0b"
            : "#22c55e";
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace">${s.nome}</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${s.health_score ?? "-"}/100</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;color:${bounceColor}">${((Number(s.bounce_rate) || 0) * 100).toFixed(2)}%</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center;color:${spamColor}">${((Number(s.spam_rate) || 0) * 100).toFixed(3)}%</td>
          <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${s.totale_inviati ?? 0}</td>
        </tr>`;
      })
      .join("");

    const blacklistSection =
      checks && checks.length > 0
        ? `<h3 style="font-family:monospace;margin-top:24px">🔍 Blacklist Check Recenti</h3>
           <table style="width:100%;border-collapse:collapse;font-size:13px">
             <tr style="background:#f3f4f6"><th style="padding:8px;text-align:left">Dominio</th><th style="padding:8px;text-align:center">Stato</th><th style="padding:8px;text-align:left">Liste</th></tr>
             ${checks
               .slice(0, 10)
               .map(
                 (c) =>
                   `<tr><td style="padding:8px;border-bottom:1px solid #e5e7eb;font-family:monospace">${c.dominio}</td>
                    <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${c.in_blacklist ? "🚨 IN BLACKLIST" : "✅ Pulito"}</td>
                    <td style="padding:8px;border-bottom:1px solid #e5e7eb;font-size:11px">${c.blacklists?.join(", ") || "-"}</td></tr>`
               )
               .join("")}
           </table>`
        : "";

    const alertSenders = userSenders.filter(
      (s) => Number(s.bounce_rate) > 0.05 || Number(s.spam_rate) > 0.003
    );
    const alertSection =
      alertSenders.length > 0
        ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-top:16px">
             <strong style="color:#dc2626">⚠️ ${alertSenders.length} mittente/i in stato critico</strong>
             <ul style="margin:8px 0 0;padding-left:20px">${alertSenders.map((s) => `<li>${s.nome}: bounce ${((Number(s.bounce_rate) || 0) * 100).toFixed(1)}%, spam ${((Number(s.spam_rate) || 0) * 100).toFixed(2)}%</li>`).join("")}</ul>
           </div>`
        : `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-top:16px">
             <strong style="color:#16a34a">✅ Tutti i mittenti in buona salute</strong>
           </div>`;

    const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:20px;color:#1f2937">
      <h2 style="font-family:monospace;border-bottom:2px solid #000;padding-bottom:8px">📊 Report Settimanale Deliverability</h2>
      <p style="color:#6b7280;font-size:13px">${now}</p>
      ${alertSection}
      <h3 style="font-family:monospace;margin-top:24px">📬 Stato Mittenti</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="background:#f3f4f6">
          <th style="padding:8px;text-align:left">Mittente</th>
          <th style="padding:8px;text-align:center">Health</th>
          <th style="padding:8px;text-align:center">Bounce</th>
          <th style="padding:8px;text-align:center">Spam</th>
          <th style="padding:8px;text-align:center">Inviati</th>
        </tr>
        ${senderRows}
      </table>
      ${blacklistSection}
      <p style="margin-top:24px;font-size:12px;color:#9ca3af;font-family:monospace">— BuzzFinder Studio</p>
    </body></html>`;

    // Send via Resend
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${emailSender.resend_api_key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `BuzzFinder <${emailSender.email_from}>`,
          to: [emailSender.reply_to || emailSender.email_from],
          subject: `📊 Report Deliverability Settimanale — ${new Date().toLocaleDateString("it-IT")}`,
          html,
        }),
      });

      if (res.ok) {
        results.push(`${userId}: sent`);
      } else {
        const err = await res.text();
        results.push(`${userId}: error — ${err}`);
      }
    } catch (e) {
      results.push(`${userId}: exception — ${(e as Error).message}`);
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
