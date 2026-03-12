import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getWarmupLimit(giorno: number): number {
  if (giorno <= 3) return 20;
  if (giorno <= 7) return 50;
  if (giorno <= 14) return 100;
  if (giorno <= 21) return 200;
  if (giorno <= 30) return 500;
  if (giorno <= 60) return 1000;
  if (giorno <= 90) return 3000;
  return 10000;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let callerUserId: string | null = null;
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) {
        return new Response(JSON.stringify({ error: "Token non valido" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerUserId = user.id;
    }

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id richiesto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch campaign
    const { data: campaign, error: cErr } = await supabase
      .from("campaigns")
      .select("id, tipo, user_id")
      .eq("id", campaign_id)
      .single();

    if (cErr || !campaign) {
      return new Response(
        JSON.stringify({ error: "Campagna non trovata" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership (skip for service_role)
    if (!isServiceRole && callerUserId && campaign.user_id !== callerUserId) {
      return new Response(
        JSON.stringify({ error: "Non autorizzato: campagna di un altro utente" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch active senders matching type
    const { data: senders } = await supabase
      .from("sender_pool")
      .select("*")
      .eq("user_id", campaign.user_id)
      .eq("tipo", campaign.tipo)
      .eq("attivo", true)
      .neq("stato", "banned")
      .order("health_score", { ascending: false });

    if (!senders || senders.length === 0) {
      return new Response(
        JSON.stringify({
          assigned: 0,
          total_recipients: 0,
          total_capacity_today: 0,
          senders_used: [],
          warnings: ["Nessun mittente attivo trovato per questo canale. Aggiungi un mittente nel Pool Mittenti."],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Compute effective capacity per sender
    const sendersWithCapacity = senders.map((s) => {
      const warmupLimit = s.warmup_attivo
        ? getWarmupLimit(s.warmup_giorno ?? 0)
        : (s.max_per_day ?? 50);
      const effectiveMax = Math.min(warmupLimit, s.max_per_day ?? 50);
      const available = Math.max(0, effectiveMax - (s.inviati_oggi ?? 0));
      return { ...s, available };
    });

    const totalCapacity = sendersWithCapacity.reduce((sum, s) => sum + s.available, 0);

    // 4. Fetch pending recipients
    const { data: recipients } = await supabase
      .from("campaign_recipients")
      .select("id")
      .eq("campaign_id", campaign_id)
      .eq("stato", "pending")
      .is("sender_id", null);

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({
          assigned: 0,
          total_recipients: 0,
          total_capacity_today: totalCapacity,
          senders_used: [],
          warnings: ["Nessun destinatario pending trovato per questa campagna."],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const warnings: string[] = [];
    if (recipients.length > totalCapacity) {
      warnings.push(
        `Capacità insufficiente: ${recipients.length} destinatari ma solo ${totalCapacity} slot disponibili. Verranno assegnati ${totalCapacity} destinatari.`
      );
    }

    // 5. Distribute proportionally by available capacity
    const toAssign = Math.min(recipients.length, totalCapacity);
    const assignments: { senderId: string; recipientIds: string[]; nome: string; warmup_giorno: number }[] = [];

    let recipientIdx = 0;
    for (const sender of sendersWithCapacity) {
      if (sender.available <= 0 || recipientIdx >= toAssign) continue;
      const share = Math.round((sender.available / totalCapacity) * toAssign);
      const count = Math.min(share || 1, sender.available, toAssign - recipientIdx);
      if (count <= 0) continue;

      const ids = recipients.slice(recipientIdx, recipientIdx + count).map((r) => r.id);
      assignments.push({
        senderId: sender.id,
        recipientIds: ids,
        nome: sender.nome,
        warmup_giorno: sender.warmup_giorno ?? 0,
      });
      recipientIdx += ids.length;
    }

    // Assign any remaining due to rounding
    if (recipientIdx < toAssign) {
      for (const sender of sendersWithCapacity) {
        if (recipientIdx >= toAssign) break;
        const existing = assignments.find((a) => a.senderId === sender.id);
        const alreadyAssigned = existing ? existing.recipientIds.length : 0;
        const remaining = sender.available - alreadyAssigned;
        if (remaining <= 0) continue;
        const count = Math.min(remaining, toAssign - recipientIdx);
        const ids = recipients.slice(recipientIdx, recipientIdx + count).map((r) => r.id);
        if (existing) {
          existing.recipientIds.push(...ids);
        } else {
          assignments.push({
            senderId: sender.id,
            recipientIds: ids,
            nome: sender.nome,
            warmup_giorno: sender.warmup_giorno ?? 0,
          });
        }
        recipientIdx += ids.length;
      }
    }

    // 6. Bulk update campaign_recipients
    let totalAssigned = 0;
    for (const a of assignments) {
      // Update in batches of 500
      for (let i = 0; i < a.recipientIds.length; i += 500) {
        const batch = a.recipientIds.slice(i, i + 500);
        await supabase
          .from("campaign_recipients")
          .update({ sender_id: a.senderId })
          .in("id", batch);
      }
      totalAssigned += a.recipientIds.length;
    }

    const result = {
      assigned: totalAssigned,
      total_recipients: recipients.length,
      total_capacity_today: totalCapacity,
      senders_used: assignments.map((a) => ({
        nome: a.nome,
        assegnati: a.recipientIds.length,
        warmup_giorno: a.warmup_giorno,
      })),
      warnings,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
