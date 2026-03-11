import { useState, useEffect, useCallback } from "react";
import { BarChart3, Users, Mail, DollarSign, Globe, TrendingUp, RefreshCw, Sparkles, Send, Eye, MousePointerClick, MessageSquare, Flame, Download } from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart,
} from "recharts";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { KpiCard } from "@/components/shared/KpiCard";
import { useAdvancedAnalytics } from "@/hooks/useAdvancedAnalytics";
import { FunnelChart } from "@/components/analytics/FunnelChart";
import { TimelineChart } from "@/components/analytics/TimelineChart";
import { CampaignPerformanceTable } from "@/components/analytics/CampaignPerformanceTable";
import { SendingHeatmap } from "@/components/analytics/SendingHeatmap";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const COLORS = [
  "hsl(152, 100%, 45%)",
  "hsl(213, 100%, 60%)",
  "hsl(40, 100%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 80%, 60%)",
  "hsl(180, 70%, 50%)",
];

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      <h3 className="terminal-header mb-4">{title}</h3>
      {children}
    </div>
  );
}

interface CostProjection {
  budget: number;
  costToday: number;
  projected: number;
  dayElapsed: number;
  daysInMonth: number;
  byChannel: { channel: string; icon: string; cost: number; note: string }[];
}

function useCostProjection(totalCostEur: number): CostProjection {
  const [budget, setBudget] = useState(500);

  useEffect(() => {
    supabase.from("app_settings").select("valore").eq("chiave", "budget_mensile").maybeSingle().then(({ data }) => {
      if (data?.valore) setBudget(Number(data.valore) || 500);
    });
  }, []);

  const now = new Date();
  const dayElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projected = dayElapsed > 0 ? (totalCostEur / dayElapsed) * daysInMonth : 0;

  return {
    budget,
    costToday: totalCostEur,
    projected,
    dayElapsed,
    daysInMonth,
    byChannel: [
      { channel: "Email (Resend)", icon: "📧", cost: 0, note: "piano Pro incluso" },
      { channel: "SMS (Telnyx)", icon: "💬", cost: totalCostEur * 0.6, note: "" },
      { channel: "WhatsApp (Meta)", icon: "📱", cost: totalCostEur * 0.3, note: "" },
      { channel: "Scraping (Maps)", icon: "🔍", cost: 0, note: "chiave API propria" },
      { channel: "Scraping (Web)", icon: "🌐", cost: 0, note: "ScrapingBee free tier" },
    ],
  };
}

function CostProjectionCard({ totalCostEur }: { totalCostEur: number }) {
  const proj = useCostProjection(totalCostEur);
  const usedPercent = proj.budget > 0 ? Math.min((proj.costToday / proj.budget) * 100, 100) : 0;
  const remaining = Math.max(proj.budget - proj.costToday, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <h3 className="terminal-header text-primary">PROIEZIONE COSTI MESE CORRENTE</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
        <div>
          <div className="text-muted-foreground">Giorni trascorsi</div>
          <div className="text-foreground text-lg">{proj.dayElapsed} / {proj.daysInMonth}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Costo a oggi</div>
          <div className="text-foreground text-lg">€{proj.costToday.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Proiezione fine mese</div>
          <div className="text-warning text-lg">~€{proj.projected.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Rimanente</div>
          <div className="text-primary text-lg">€{remaining.toFixed(2)}</div>
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
          <span>Budget mensile: €{proj.budget.toFixed(2)}</span>
          <span>{usedPercent.toFixed(0)}% usato</span>
        </div>
        <Progress value={usedPercent} className="h-2" />
      </div>
      <div className="space-y-1.5">
        <div className="text-[10px] font-mono text-muted-foreground uppercase">Breakdown per canale</div>
        {proj.byChannel.map((ch) => (
          <div key={ch.channel} className="flex items-center justify-between font-mono text-xs">
            <span className="text-muted-foreground">{ch.icon} {ch.channel}</span>
            <span className="text-foreground">
              €{ch.cost.toFixed(2)}
              {ch.note && <span className="text-muted-foreground ml-2">({ch.note})</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiCostKpi() {
  const [aiData, setAiData] = useState<{ cost: number; count: number }>({ cost: 0, count: 0 });

  useEffect(() => {
    supabase
      .from("campaigns")
      .select("ai_cost_eur, ai_personalization_processed")
      .eq("ai_personalization_enabled", true)
      .then(({ data }) => {
        if (data) {
          const cost = data.reduce((a: number, c: any) => a + Number(c.ai_cost_eur || 0), 0);
          const count = data.reduce((a: number, c: any) => a + Number(c.ai_personalization_processed || 0), 0);
          setAiData({ cost, count });
        }
      });
  }, []);

  if (aiData.cost === 0 && aiData.count === 0) return null;

  return (
    <KpiCard
      label="COSTO AI"
      value={`€${aiData.cost.toFixed(2)}`}
      trend={`${aiData.count} msg`}
      trendUp
      icon={<Sparkles className="h-4 w-4" />}
    />
  );
}

export default function AnalyticsPage() {
  const [periodoGiorni, setPeriodoGiorni] = useState(30);
  const { data, isLoading, refetch } = useAdvancedAnalytics(periodoGiorni);
  const navigate = useNavigate();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">ANALYTICS</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">ANALYTICS</h1>
        </div>
        <div className="flex gap-2 items-center">
          {[7, 14, 30, 90].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={periodoGiorni === d ? "default" : "outline"}
              onClick={() => setPeriodoGiorni(d)}
              className="font-mono text-xs"
            >
              {d}g
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1 font-mono text-xs ml-2">
            <RefreshCw className="h-3 w-3" /> Aggiorna
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportAnalyticsCsv(data, periodoGiorni)} className="gap-1 font-mono text-xs">
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="INVIATI" value={data.inviati.toLocaleString()} icon={<Send className="h-4 w-4" />} />
        <KpiCard label="APERTI" value={data.aperti.toLocaleString()} trend={`${data.openRate.toFixed(1)}%`} trendUp={data.openRate > 15} icon={<Eye className="h-4 w-4" />} />
        <KpiCard label="CLICCATI" value={data.cliccati.toLocaleString()} trend={`${data.clickRate.toFixed(1)}%`} trendUp={data.clickRate > 2} icon={<MousePointerClick className="h-4 w-4" />} />
        <KpiCard label="RISPOSTE" value={data.risposte.toLocaleString()} trend={`${data.replyRate.toFixed(1)}%`} trendUp={data.replyRate > 3} icon={<MessageSquare className="h-4 w-4" />} />
        <KpiCard label="INTERESSATI 🔥" value={data.interessati.toLocaleString()} trend={`${data.conversionRate.toFixed(1)}%`} trendUp={data.conversionRate > 1} icon={<Flame className="h-4 w-4" />} />
        <KpiCard label="COSTO" value={`€${data.totalCostEur.toFixed(2)}`} icon={<DollarSign className="h-4 w-4" />} />
        <AiCostKpi />
      </div>

      {/* Funnel */}
      <FunnelChart stats={data} />

      {/* Timeline */}
      <TimelineChart data={data.timeline} />

      {/* Campaign Performance Table */}
      <CampaignPerformanceTable
        campaigns={data.campaigns}
        onSelectCampaign={(id) => navigate(`/campaigns/${id}`)}
      />

      {/* Heatmap */}
      <SendingHeatmap data={data.heatmap} />

      {/* Cost Projection */}
      <CostProjectionCard totalCostEur={data.totalCostEur} />
    </div>
  );
}
