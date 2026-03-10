import { useState, useEffect, useCallback } from "react";
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

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const [contactsRes, campaignsRes, usageRes, sessionsRes] = await Promise.all([
        supabase.from("contacts").select("id, email, telefono, fonte, stato, created_at"),
        supabase.from("campaigns").select("id, nome, tipo, stato, inviati, aperti, cliccati, costo_reale_eur, created_at"),
        supabase.from("usage_log").select("tipo, costo_totale_eur, created_at"),
        supabase.from("scraping_sessions").select("id, totale_importati, status"),
      ]);

      const contacts = contactsRes.data || [];
      const campaigns = campaignsRes.data || [];
      const usage = usageRes.data || [];
      const sessions = sessionsRes.data || [];

      // KPIs
      const totalContacts = contacts.length;
      const contactsWithEmail = contacts.filter(c => c.email).length;
      const contactsWithPhone = contacts.filter(c => c.telefono).length;
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
      contacts.forEach(c => {
        if (!c.created_at) return;
        const key = format(new Date(c.created_at), "yyyy-MM-dd");
        const entry = last30.find(d => d.date === key);
        if (entry) entry.count++;
      });

      // Contacts by source
      const sourceMap: Record<string, number> = {};
      contacts.forEach(c => {
        const s = c.fonte || "altro";
        sourceMap[s] = (sourceMap[s] || 0) + 1;
      });
      const contactsBySource = Object.entries(sourceMap).map(([source, count]) => ({ source, count }));

      // Contacts by status
      const statusMap: Record<string, number> = {};
      contacts.forEach(c => {
        const s = c.stato || "nuovo";
        statusMap[s] = (statusMap[s] || 0) + 1;
      });
      const contactsByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

      // Campaigns by type
      const typeMap: Record<string, number> = {};
      campaigns.forEach(c => {
        typeMap[c.tipo] = (typeMap[c.tipo] || 0) + 1;
      });
      const campaignsByType = Object.entries(typeMap).map(([type, count]) => ({ type, count }));

      // Top campaign performance
      const campaignPerformance = campaigns
        .filter(c => (c.inviati || 0) > 0)
        .sort((a, b) => (b.inviati || 0) - (a.inviati || 0))
        .slice(0, 10)
        .map(c => ({ nome: c.nome, inviati: c.inviati || 0, aperti: c.aperti || 0, cliccati: c.cliccati || 0 }));

      // Costs by day (last 30 days)
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

      // Scraping
      const scrapingSessions = sessions.length;
      const scrapingImported = sessions.reduce((s, ss) => s + (ss.totale_importati || 0), 0);

      setData({
        totalContacts, contactsWithEmail, contactsWithPhone,
        totalCampaigns, totalSent, totalOpened, totalClicked, totalCostEur,
        contactsByDay: last30, contactsBySource, contactsByStatus,
        campaignsByType, campaignPerformance, costsByDay: costDays,
        scrapingSessions, scrapingImported,
      });
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, isLoading, refetch: fetch };
}
