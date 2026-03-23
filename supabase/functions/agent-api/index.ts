/**
 * BuzzFinder Agent API
 * Single entry-point for OpenClaw (or any external agent) to control BuzzFinder.
 *
 * Auth: Bearer token stored in app_settings (chiave = "agent_api_token")
 *
 * Commands:
 *   get_stats          → campaign + contact summary
 *   get_inbox          → latest inbox messages
 *   list_campaigns     → all campaigns with status
 *   list_contacts      → contacts with optional filters
 *   scrape_contacts    → trigger OSM scrape session
 *   launch_campaign    → assign senders + start sending
 *   pause_campaign     → pause a running campaign
 *   get_session_status → scraping session status
 *   run_outreach       → full auto pipeline: scrape → create campaign → launch
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = req.headers.get("Authorization") || req.headers.get("x-openclaw-token") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();

  if (!token) return json({ error: "Token mancante" }, 401);

  // Find the user who owns this token
  const { data: setting } = await supabase
    .from("app_settings")
    .select("user_id, valore")
    .eq("chiave", "agent_api_token")
    .eq("valore", token)
    .maybeSingle();

  if (!setting) return json({ error: "Token non valido" }, 401);
  const userId = setting.user_id;

  // ── Parse command ─────────────────────────────────────────────────────────
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* GET requests or no body */ }

  const command = (body.command as string) || new URL(req.url).searchParams.get("command") || "";
  if (!command) return json({ error: "Parametro 'command' obbligatorio" }, 400);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // GET_STATS
  if (command === "get_stats") {
    const [contacts, campaigns, inbox, sessions] = await Promise.all([
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      supabase.from("campaigns").select("id, nome, stato, inviati, errori, aperti").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      supabase.from("inbox_messages").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", new Date(Date.now() - 86400000).toISOString()),
      supabase.from("scraping_sessions").select("id, status, totale_importati").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
    ]);
    return json({
      totale_contatti: contacts.count ?? 0,
      messaggi_ultime_24h: inbox.count ?? 0,
      ultime_campagne: campaigns.data ?? [],
      ultime_sessioni_scraping: sessions.data ?? [],
    });
  }

  // GET_INBOX
  if (command === "get_inbox") {
    const limit = Number(body.limit ?? 10);
    const { data } = await supabase
      .from("inbox_messages")
      .select("id, canale, da_nome, da_email, da_telefono, oggetto, corpo, etichetta, data_ricezione, letto")
      .eq("user_id", userId)
      .order("data_ricezione", { ascending: false })
      .limit(limit);
    return json({ messaggi: data ?? [] });
  }

  // LIST_CAMPAIGNS
  if (command === "list_campaigns") {
    const { data } = await supabase
      .from("campaigns")
      .select("id, nome, stato, tipo, inviati, errori, aperti, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return json({ campagne: data ?? [] });
  }

  // LIST_CONTACTS
  if (command === "list_contacts") {
    const limit = Number(body.limit ?? 20);
    const stato = body.stato as string | undefined;
    const citta = body.citta as string | undefined;
    let q = supabase.from("contacts").select("id, azienda, email, telefono, citta, stato, fonte").eq("user_id", userId);
    if (stato) q = q.eq("stato", stato);
    if (citta) q = q.ilike("citta", `%${citta}%`);
    const { data, count } = await q.order("created_at", { ascending: false }).limit(limit);
    return json({ contatti: data ?? [], totale: count });
  }

  // SCRAPE_CONTACTS
  if (command === "scrape_contacts") {
    const { categoria, citta, raggio_km = 10, max_results = 100 } = body as {
      categoria?: string; citta?: string; raggio_km?: number; max_results?: number;
    };
    if (!categoria || !citta) return json({ error: "categoria e citta sono obbligatori" }, 400);

    const { data: sessionData, error: sessErr } = await supabase.from("scraping_sessions").insert({
      user_id: userId,
      query: categoria,
      citta,
      raggio_km,
      max_results,
      provider: "openstreetmap",
      status: "pending",
      totale_trovati: 0,
      totale_importati: 0,
    }).select().single();

    if (sessErr) return json({ error: sessErr.message }, 500);

    // Trigger scrape async
    supabase.functions.invoke("scrape-maps-page", {
      body: {
        provider: "openstreetmap",
        session_id: sessionData.id,
        query: categoria,
        citta,
        raggio_km,
        max_results,
      },
    }).catch(console.error);

    return json({ success: true, session_id: sessionData.id, message: `Scraping avviato: ${categoria} a ${citta}` });
  }

  // GET_SESSION_STATUS
  if (command === "get_session_status") {
    const { session_id } = body as { session_id?: string };
    if (!session_id) return json({ error: "session_id obbligatorio" }, 400);
    const { data } = await supabase
      .from("scraping_sessions")
      .select("id, status, totale_trovati, totale_importati, progress_percent, error_message")
      .eq("id", session_id)
      .eq("user_id", userId)
      .single();
    return json(data ?? { error: "Sessione non trovata" });
  }

  // LAUNCH_CAMPAIGN
  if (command === "launch_campaign") {
    const { campaign_id } = body as { campaign_id?: string };
    if (!campaign_id) return json({ error: "campaign_id obbligatorio" }, 400);

    // Verify ownership
    const { data: camp } = await supabase.from("campaigns").select("id, stato, tipo").eq("id", campaign_id).eq("user_id", userId).single();
    if (!camp) return json({ error: "Campagna non trovata" }, 404);

    // Assign senders
    const assignResp = await supabase.functions.invoke("assign-senders", {
      body: { campaign_id },
    });
    if (assignResp.data?.warnings?.length && !assignResp.data?.assigned) {
      return json({ error: assignResp.data.warnings[0] }, 400);
    }

    // Mark as running
    await supabase.from("campaigns").update({
      stato: "in_corso",
      started_at: new Date().toISOString(),
    } as any).eq("id", campaign_id);

    // Send first batch
    const sendResp = await supabase.functions.invoke("send-campaign-emails", {
      body: { campaign_id, batch_size: 100 },
    });

    return json({
      success: true,
      assegnati: assignResp.data?.assigned ?? 0,
      inviati: sendResp.data?.sent ?? 0,
      errori: sendResp.data?.errors ?? 0,
      rimanenti: sendResp.data?.remaining ?? 0,
    });
  }

  // PAUSE_CAMPAIGN
  if (command === "pause_campaign") {
    const { campaign_id } = body as { campaign_id?: string };
    if (!campaign_id) return json({ error: "campaign_id obbligatorio" }, 400);
    const { error } = await supabase.from("campaigns")
      .update({ stato: "in_pausa", paused_at: new Date().toISOString() } as any)
      .eq("id", campaign_id).eq("user_id", userId);
    if (error) return json({ error: error.message }, 500);
    return json({ success: true, message: "Campagna messa in pausa" });
  }

  // RUN_OUTREACH — full pipeline: scrape → wait → create campaign → launch
  if (command === "run_outreach") {
    const {
      categoria, citta, raggio_km = 15, max_contatti = 50,
      oggetto, corpo_email, sender_id,
    } = body as {
      categoria?: string; citta?: string; raggio_km?: number; max_contatti?: number;
      oggetto?: string; corpo_email?: string; sender_id?: string;
    };

    if (!categoria || !citta) return json({ error: "categoria e citta sono obbligatori" }, 400);
    if (!oggetto || !corpo_email) return json({ error: "oggetto e corpo_email sono obbligatori" }, 400);

    // 1. Avvia scraping
    const { data: sess } = await supabase.from("scraping_sessions").insert({
      user_id: userId, query: categoria, citta, raggio_km,
      max_results: max_contatti, provider: "openstreetmap",
      status: "pending", totale_trovati: 0, totale_importati: 0,
    }).select().single();

    await supabase.functions.invoke("scrape-maps-page", {
      body: { provider: "openstreetmap", session_id: sess.id, query: categoria, citta, raggio_km, max_results: max_contatti },
    });

    // 2. Crea campagna email
    const { data: camp } = await supabase.from("campaigns").insert({
      user_id: userId,
      nome: `[Agent] ${categoria} - ${citta}`,
      tipo: "email",
      stato: "bozza",
      subject: oggetto,
      body_text: corpo_email,
      body_html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.6">${corpo_email.replace(/\n/g, "<br>")}</div>`,
      tracking_aperture: true,
    } as any).select().single();

    return json({
      success: true,
      session_id: sess?.id,
      campaign_id: camp?.id,
      message: `Pipeline avviata: scraping di "${categoria}" a ${citta}. Usa 'get_session_status' per monitorare. Poi usa 'launch_campaign' con campaign_id "${camp?.id}" per inviare.`,
      prossimi_passi: [
        `1. Monitora scraping: { "command": "get_session_status", "session_id": "${sess?.id}" }`,
        `2. Aggiungi destinatari alla campagna e poi lancia: { "command": "launch_campaign", "campaign_id": "${camp?.id}" }`,
      ],
    });
  }

  return json({ error: `Comando "${command}" non riconosciuto. Comandi disponibili: get_stats, get_inbox, list_campaigns, list_contacts, scrape_contacts, get_session_status, launch_campaign, pause_campaign, run_outreach` }, 400);
});
