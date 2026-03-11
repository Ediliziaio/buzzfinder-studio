import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard, Mail, Inbox, TrendingUp, Plus, Upload, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/KpiCard";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useAnalytics } from "@/hooks/useAnalytics";

export default function DashboardPage() {
  const { campaigns } = useCampaigns();
  const { data: analytics } = useAnalytics();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    supabase.from("inbox_messages").select("id", { count: "exact", head: true }).eq("letto", false).eq("archiviato", false).then(({ count }) => {
      setUnreadCount(count || 0);
    });
  }, []);

  const activeCampaigns = campaigns.filter(c => c.stato === "in_corso" || c.stato === "in_pausa").length;
  const openRate = analytics && analytics.totalSent > 0 ? ((analytics.totalOpened / analytics.totalSent) * 100).toFixed(1) : "0";
  const recentCampaigns = campaigns.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-primary" />
        <h1 className="font-display text-xl font-bold text-foreground">DASHBOARD</h1>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Campagne Attive" value={activeCampaigns} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="Email Inviate (30gg)" value={analytics?.totalSent?.toLocaleString() || "0"} icon={<Mail className="h-4 w-4" />} />
        <KpiCard label="Messaggi Non Letti" value={unreadCount} icon={<Inbox className="h-4 w-4" />} />
        <KpiCard label="Open Rate Medio" value={`${openRate}%`} icon={<TrendingUp className="h-4 w-4" />} trendUp={Number(openRate) > 20} trend={Number(openRate) > 20 ? "Buono" : Number(openRate) > 0 ? "Da migliorare" : undefined} />
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="default" size="sm" className="font-mono text-xs gap-1.5">
          <Link to="/campaigns"><Plus className="h-3 w-3" /> Nuova Campagna</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="font-mono text-xs gap-1.5">
          <Link to="/contacts"><Upload className="h-3 w-3" /> Importa Contatti</Link>
        </Button>
        <Button asChild variant="outline" size="sm" className="font-mono text-xs gap-1.5">
          <Link to="/unibox"><Inbox className="h-3 w-3" /> Vai all'Unibox</Link>
        </Button>
      </div>

      {/* Recent Campaigns */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="terminal-header text-primary">CAMPAGNE RECENTI</span>
            <Button asChild variant="ghost" size="sm" className="font-mono text-xs gap-1">
              <Link to="/campaigns">Vedi tutte <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </div>
        </div>
        {recentCampaigns.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground font-mono text-xs">Nessuna campagna ancora creata</div>
        ) : (
          <div className="divide-y divide-border">
            {recentCampaigns.map((c) => {
              const or = (c.inviati || 0) > 0 ? ((c.aperti || 0) / (c.inviati || 1) * 100).toFixed(1) : "—";
              return (
                <Link key={c.id} to={`/campaigns/${c.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-foreground">{c.nome}</span>
                    <StatusBadge status={c.stato || "bozza"} />
                  </div>
                  <div className="flex items-center gap-6 text-xs font-mono text-muted-foreground">
                    <span>{c.tipo}</span>
                    <span>{c.inviati || 0} inviati</span>
                    <span>OR: {or}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
