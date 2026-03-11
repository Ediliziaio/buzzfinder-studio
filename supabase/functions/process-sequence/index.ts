import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // 1. Fetch all scheduled executions that are due
    const { data: executions, error: fetchErr } = await supabase
      .from("campaign_step_executions")
      .select(`
        id, campaign_id, step_id, recipient_id, sender_id, stato, scheduled_at,
        campaign_steps!inner(step_number, tipo, condizione, soggetto, corpo_html, messaggio),
        campaigns!inner(tipo_campagna, timezone, ora_inizio_invio, ora_fine_invio, solo_lavorativi, stop_su_risposta, tracking_aperture, stato)
      `)
      .eq("stato", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .limit(100);

    if (fetchErr) throw fetchErr;
    if (!executions || executions.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let skipped = 0;

    for (const exec of executions) {
      const campaign = (exec as any).campaigns;
      const step = (exec as any).campaign_steps;

      // Skip if campaign is not running
      if (campaign.stato !== "in_corso") {
        await supabase
          .from("campaign_step_executions")
          .update({ stato: "skipped", error: "campaign_not_running" })
          .eq("id", exec.id);
        skipped++;
        continue;
      }

      // Check sending window
      const now = new Date();
      const tz = campaign.timezone || "Europe/Rome";
      const localTime = new Date(
        now.toLocaleString("en-US", { timeZone: tz })
      );
      const currentHour = localTime.getHours();
      const currentMinute = localTime.getMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute;

      const [startH, startM] = (campaign.ora_inizio_invio || "08:00")
        .split(":")
        .map(Number);
      const [endH, endM] = (campaign.ora_fine_invio || "19:00")
        .split(":")
        .map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (currentTimeMinutes < startMinutes || currentTimeMinutes > endMinutes) {
        continue; // Outside sending window, will retry next cycle
      }

      // Check business days
      if (campaign.solo_lavorativi) {
        const dayOfWeek = localTime.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          continue; // Weekend, will retry next cycle
        }
      }

      // Check condition against previous step
      if (step.step_number > 1 && step.condizione !== "always") {
        // Find previous step execution for this recipient
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
          await supabase
            .from("campaign_step_executions")
            .update({ stato: "skipped", error: "recipient_replied" })
            .eq("id", exec.id);
          skipped++;
          continue;
        }
        if (step.condizione === "if_no_open" && prev?.opened_at) {
          await supabase
            .from("campaign_step_executions")
            .update({ stato: "skipped", error: "recipient_opened" })
            .eq("id", exec.id);
          skipped++;
          continue;
        }
        if (step.condizione === "if_opened" && !prev?.opened_at) {
          await supabase
            .from("campaign_step_executions")
            .update({ stato: "skipped", error: "recipient_not_opened" })
            .eq("id", exec.id);
          skipped++;
          continue;
        }
      }

      // Check stop_su_risposta: if any previous step got a reply, skip all future
      if (campaign.stop_su_risposta) {
        const { data: replied } = await supabase
          .from("campaign_step_executions")
          .select("id")
          .eq("campaign_id", exec.campaign_id)
          .eq("recipient_id", exec.recipient_id)
          .not("replied_at", "is", null)
          .limit(1);

        if (replied && replied.length > 0) {
          await supabase
            .from("campaign_step_executions")
            .update({ stato: "skipped", error: "stop_su_risposta" })
            .eq("id", exec.id);
          skipped++;
          continue;
        }
      }

      // Mark as sent (actual sending is handled by n8n or send-email function)
      await supabase
        .from("campaign_step_executions")
        .update({ stato: "sent", sent_at: new Date().toISOString() })
        .eq("id", exec.id);

      // Update step stats
      await supabase.rpc("increment_step_stat" as any, {
        _step_id: exec.step_id,
        _field: "stat_inviati",
      }).then(() => {});

      // Schedule next step
      const { data: nextStep } = await supabase
        .from("campaign_steps")
        .select("id, delay_giorni, delay_ore")
        .eq("campaign_id", exec.campaign_id)
        .eq("step_number", step.step_number + 1)
        .is("ab_padre_id", null)
        .single();

      if (nextStep) {
        const nextScheduledAt = new Date();
        nextScheduledAt.setDate(
          nextScheduledAt.getDate() + (nextStep.delay_giorni || 0)
        );
        nextScheduledAt.setHours(
          nextScheduledAt.getHours() + (nextStep.delay_ore || 0)
        );

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
    }

    return new Response(
      JSON.stringify({ processed, skipped, total: executions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
