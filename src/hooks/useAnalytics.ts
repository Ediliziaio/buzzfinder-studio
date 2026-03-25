import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";

export interface AnalyticsData {
  totalContacts: number;
  contactsWithEmail: number;
  contactsWithPhone: number;
  totalCampaigns: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalCostEur: number;
  contactsByDay: { date: string; count: number }[];
  contactsBySource: { source: string; count: number }[];
  contactsByStatus: { status: string; count: number }[];
  campaignsByType: { type: string; count: number }[];
  campaignPerformance: { nome: string; inviati: number; aperti: number; cliccati: number }[];
  costsByDay: { date: string; costo: number }[];
  scrapingSessions: number;
  scrapingImported: number;
}

async function fetchAnalytics(): Promise<AnalyticsData> {
  // Use server-side counts for contacts to avoid 1000-row limit
  const [
    totalContactsRes,
    contactsWithEmailRes,
    contactsWithPhoneRes,
    campaignsRes,
    usageRes,
    sessionsCountRes,
    contactsRecentRes,
    sessionsImportedRes,
  ] = await Promise.all([
    supabase.from("contacts").select("*", { count: "exact", head: true }),
    supabase.from("contacts").select("*", { count: "exact", head: true }).not("email", "is", null),
    supabase.from("contacts").select("*", { count: "exact", head: true }).not("telefono", "is", null),
    supabase.from("campaigns").select("id, nome, tipo, stato, inviati, aperti, cliccati, costo_reale_eur, created_at"),
    supabase.from("usage_log").select("tipo, costo_totale_eur, created_at"),
    supabase.from("scraping_sessions").select("*", { count: "exact", head: true }),
    // For contactsByDay we only need last 30 days — use filter to limit rows
    supabase.from("contacts").select("created_at, fonte, stato")
      .gte("created_at", subDays(new Date(), 30).toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
    // Sessions imported — now included in the same parallel batch
    supabase.from("scraping_sessions").select("totale_importati"),
  ]);

  const sessionsData = sessionsImportedRes.data;

  const totalContacts = totalContactsRes.count || 0;
  const contactsWithEmail = contactsWithEmailRes.count || 0;
  const contactsWithPhone = contactsWithPhoneRes.count || 0;

  const campaigns = campaignsRes.data || [];
  const usage = usageRes.data || [];
  const recentContacts = contactsRecentRes.data || [];

  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((s, c) => s + (c.inviati || 0), 0);
  const totalOpened = campaigns.reduce((s, c) => s + (c.aperti || 0), 0);
  const totalClicked = campaigns.reduce((s, c) => s + (c.cliccati || 0), 0);
  const totalCostEur = usage.reduce((s, u) => s + Number(u.costo_totale_eur || 0), 0);

  // Contacts by day (last 30 days)
  const last30 = Array.from({ length: 30 }, (_, i) => {
    const d = startOfDay(subDays(new Date(), 29 - i));
    return { date: format(d, "yyyy-MM-dd"), count: 0 };
  });
  recentContacts.forEach(c => {
    if (!c.created_at) return;
    const key = format(new Date(c.created_at), "yyyy-MM-dd");
    const entry = last30.find(d => d.date === key);
    if (entry) entry.count++;
  });

  // Contacts by source and status (from recent contacts — approximation for chart)
  const sourceMap: Record<string, number> = {};
  recentContacts.forEach(c => { const s = c.fonte || "altro"; sourceMap[s] = (sourceMap[s] || 0) + 1; });
  const contactsBySource = Object.entries(sourceMap).map(([source, count]) => ({ source, count }));

  const statusMap: Record<string, number> = {};
  recentContacts.forEach(c => { const s = c.stato || "nuovo"; statusMap[s] = (statusMap[s] || 0) + 1; });
  const contactsByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

  const typeMap: Record<string, number> = {};
  campaigns.forEach(c => { typeMap[c.tipo] = (typeMap[c.tipo] || 0) + 1; });
  const campaignsByType = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

  const campaignPerformance = campaigns
    .filter(c => (c.inviati || 0) > 0)
    .sort((a, b) => (b.inviati || 0) - (a.inviati || 0))
    .slice(0, 10)
    .map(c => ({ nome: c.nome, inviati: c.inviati || 0, aperti: c.aperti || 0, cliccati: c.cliccati || 0 }));

  const costDays = Array.from({ length: 30 }, (_, i) => {
    const d = startOfDay(subDays(new Date(), 29 - i));
    return { date: format(d, "yyyy-MM-dd"), costo: 0 };
  });
  usage.forEach(u => {
    if (!u.created_at) return;
    const key = format(new Date(u.created_at), "yyyy-MM-dd");
    const entry = costDays.find(d => d.date === key);
    if (entry) entry.costo += Number(u.costo_totale_eur || 0);
  });

  const scrapingSessions = sessionsCountRes.count || 0;
  const scrapingImported = (sessionsData || []).reduce((s, ss) => s + (ss.totale_importati || 0), 0);

  return {
    totalContacts, contactsWithEmail, contactsWithPhone,
    totalCampaigns, totalSent, totalOpened, totalClicked, totalCostEur,
    contactsByDay: last30, contactsBySource, contactsByStatus,
    campaignsByType, campaignPerformance, costsByDay: costDays,
    scrapingSessions, scrapingImported,
  };
}

export function useAnalytics() {
  const query = useQuery({
    queryKey: ["analytics"],
    queryFn: fetchAnalytics,
    staleTime: 60_000,
  });

  return {
    data: query.data || null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
