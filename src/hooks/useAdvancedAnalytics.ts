import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";
import { it } from "date-fns/locale";

export interface AdvancedAnalyticsData {
  inviati: number;
  consegnati: number;
  aperti: number;
  cliccati: number;
  risposte: number;
  interessati: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  conversionRate: number;
  deliveryRate: number;
  totalContacts: number;
  totalCampaigns: number;
  totalCostEur: number;
  timeline: { data: string; inviati: number; aperti: number; risposte: number }[];
  campaigns: {
    id: string;
    nome: string;
    stato: string;
    inviati: number;
    aperti: number;
    cliccati: number;
    errori: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  }[];
  heatmap: number[][]; // 7×24
  scrapingSessions: number;
  scrapingImported: number;
}

async function fetchAdvancedAnalytics(giorni: number): Promise<AdvancedAnalyticsData> {
  const since = subDays(new Date(), giorni).toISOString();

  const [campaignsRes, contactsRes, inboxRes, recipientsRes, usageRes, sessionsRes] = await Promise.all([
    supabase.from("campaigns").select("id, nome, stato, tipo, inviati, consegnati, aperti, cliccati, errori, costo_reale_eur, created_at").gte("created_at", since),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("inbox_messages").select("etichetta, created_at").gte("created_at", since),
    supabase.from("campaign_recipients").select("inviato_at, opened_at, clicked_at, stato").gte("inviato_at", since),
    supabase.from("usage_log").select("costo_totale_eur").gte("created_at", since),
    supabase.from("scraping_sessions").select("id, totale_importati"),
  ]);

  const campaigns = campaignsRes.data || [];
  const inbox = inboxRes.data || [];
  const recipients = recipientsRes.data || [];
  const usage = usageRes.data || [];
  const sessions = sessionsRes.data || [];

  const inviati = campaigns.reduce((s, c) => s + (c.inviati || 0), 0);
  const consegnati = campaigns.reduce((s, c) => s + (c.consegnati || 0), 0);
  const aperti = campaigns.reduce((s, c) => s + (c.aperti || 0), 0);
  const cliccati = campaigns.reduce((s, c) => s + (c.cliccati || 0), 0);
  const risposte = inbox.length;
  const interessati = inbox.filter((m) => m.etichetta === "interessato").length;

  const openRate = inviati > 0 ? (aperti / inviati) * 100 : 0;
  const clickRate = inviati > 0 ? (cliccati / inviati) * 100 : 0;
  const replyRate = inviati > 0 ? (risposte / inviati) * 100 : 0;
  const conversionRate = inviati > 0 ? (interessati / inviati) * 100 : 0;
  const deliveryRate = inviati > 0 ? (consegnati / inviati) * 100 : 0;

  // Timeline
  const days = Array.from({ length: giorni }, (_, i) => {
    const d = startOfDay(subDays(new Date(), giorni - 1 - i));
    return { data: format(d, "dd MMM", { locale: it }), key: format(d, "yyyy-MM-dd"), inviati: 0, aperti: 0, risposte: 0 };
  });

  recipients.forEach((r) => {
    if (r.inviato_at) {
      const key = format(new Date(r.inviato_at), "yyyy-MM-dd");
      const entry = days.find((d) => d.key === key);
      if (entry) {
        entry.inviati++;
        if (r.opened_at) entry.aperti++;
      }
    }
  });

  inbox.forEach((m) => {
    if (m.created_at) {
      const key = format(new Date(m.created_at), "yyyy-MM-dd");
      const entry = days.find((d) => d.key === key);
      if (entry) entry.risposte++;
    }
  });

  // Heatmap 7×24
  const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  recipients.forEach((r) => {
    if (r.inviato_at) {
      const d = new Date(r.inviato_at);
      const day = (d.getDay() + 6) % 7; // Mon=0
      const hour = d.getHours();
      heatmap[day][hour]++;
    }
  });

  // Campaign performance
  const campaignRows = campaigns
    .filter((c) => (c.inviati || 0) > 0)
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      stato: c.stato || "bozza",
      inviati: c.inviati || 0,
      aperti: c.aperti || 0,
      cliccati: c.cliccati || 0,
      errori: c.errori || 0,
      openRate: c.inviati ? ((c.aperti || 0) / c.inviati) * 100 : 0,
      clickRate: c.inviati ? ((c.cliccati || 0) / c.inviati) * 100 : 0,
      bounceRate: c.inviati ? ((c.errori || 0) / c.inviati) * 100 : 0,
    }));

  const totalCostEur = usage.reduce((s, u) => s + Number(u.costo_totale_eur || 0), 0);

  return {
    inviati, consegnati, aperti, cliccati, risposte, interessati,
    openRate, clickRate, replyRate, conversionRate, deliveryRate,
    totalContacts: contactsRes.count || 0,
    totalCampaigns: campaigns.length,
    totalCostEur,
    timeline: days.map(({ data, inviati, aperti, risposte }) => ({ data, inviati, aperti, risposte })),
    campaigns: campaignRows,
    heatmap,
    scrapingSessions: sessions.length,
    scrapingImported: sessions.reduce((s, ss) => s + (ss.totale_importati || 0), 0),
  };
}

export function useAdvancedAnalytics(giorni: number = 30) {
  return useQuery({
    queryKey: ["advanced-analytics", giorni],
    queryFn: () => fetchAdvancedAnalytics(giorni),
    staleTime: 60_000,
  });
}
