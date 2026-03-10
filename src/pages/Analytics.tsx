import { BarChart3, Users, Mail, DollarSign, Globe, TrendingUp, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart,
} from "recharts";
import { KpiCard } from "@/components/shared/KpiCard";
import { useAnalytics } from "@/hooks/useAnalytics";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const COLORS = [
  "hsl(152, 100%, 45%)",
  "hsl(213, 100%, 60%)",
  "hsl(40, 100%, 50%)",
  "hsl(0, 72%, 51%)",
  "hsl(280, 80%, 60%)",
  "hsl(180, 70%, 50%)",
];

const sourceLabels: Record<string, string> = {
  google_maps: "Google Maps",
  csv_import: "Import CSV",
  manuale: "Manuale",
  web_scrape: "Web Scrape",
};

const statusLabels: Record<string, string> = {
  nuovo: "Nuovo",
  da_contattare: "Da contattare",
  contattato: "Contattato",
  risposto: "Risposto",
  non_interessato: "Non interessato",
  cliente: "Cliente",
};

const typeLabels: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-border bg-card p-4 ${className}`}>
      <h3 className="terminal-header mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading, refetch } = useAnalytics();

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">ANALYTICS</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const openRate = data.totalSent > 0 ? ((data.totalOpened / data.totalSent) * 100).toFixed(1) : "0";
  const clickRate = data.totalSent > 0 ? ((data.totalClicked / data.totalSent) * 100).toFixed(1) : "0";

  const contactsByDayFormatted = data.contactsByDay.map(d => ({
    ...d,
    label: format(new Date(d.date), "dd MMM", { locale: it }),
  }));

  const costsByDayFormatted = data.costsByDay.map(d => ({
    ...d,
    label: format(new Date(d.date), "dd MMM", { locale: it }),
  }));

  const contactsBySourceFormatted = data.contactsBySource.map(d => ({
    ...d,
    name: sourceLabels[d.source] || d.source,
  }));

  const contactsByStatusFormatted = data.contactsByStatus.map(d => ({
    ...d,
    name: statusLabels[d.status] || d.status,
  }));

  const campaignsByTypeFormatted = data.campaignsByType.map(d => ({
    ...d,
    name: typeLabels[d.type] || d.type,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">ANALYTICS</h1>
        </div>
        <Button variant="outline" size="sm" onClick={refetch} className="gap-2 font-mono text-xs">
          <RefreshCw className="h-3 w-3" /> Aggiorna
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="CONTATTI TOTALI" value={data.totalContacts.toLocaleString()} icon={<Users className="h-4 w-4" />} />
        <KpiCard label="CON EMAIL" value={data.contactsWithEmail.toLocaleString()} trend={data.totalContacts > 0 ? `${((data.contactsWithEmail / data.totalContacts) * 100).toFixed(0)}%` : "0%"} trendUp />
        <KpiCard label="CAMPAGNE" value={data.totalCampaigns} icon={<Mail className="h-4 w-4" />} />
        <KpiCard label="EMAIL INVIATE" value={data.totalSent.toLocaleString()} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="TASSO APERTURA" value={`${openRate}%`} trendUp={Number(openRate) > 15} trend={Number(openRate) > 15 ? "sopra media" : "sotto media"} />
        <KpiCard label="TASSO CLICK" value={`${clickRate}%`} trendUp={Number(clickRate) > 2} trend={Number(clickRate) > 2 ? "buono" : "da migliorare"} />
        <KpiCard label="SCRAPING SESSIONI" value={data.scrapingSessions} icon={<Globe className="h-4 w-4" />} />
        <KpiCard label="COSTO TOTALE" value={`€${data.totalCostEur.toFixed(2)}`} icon={<DollarSign className="h-4 w-4" />} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="CONTATTI ACQUISITI (ULTIMI 30 GIORNI)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={contactsByDayFormatted}>
                <defs>
                  <linearGradient id="gradContacts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(152, 100%, 45%)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(152, 100%, 45%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 10%, 15%)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(240, 10%, 55%)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(240, 10%, 55%)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(240, 14%, 7%)", border: "1px solid hsl(240, 10%, 15%)", borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="hsl(152, 100%, 45%)" fill="url(#gradContacts)" strokeWidth={2} name="Contatti" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="COSTI GIORNALIERI (ULTIMI 30 GIORNI)">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costsByDayFormatted}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 10%, 15%)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(240, 10%, 55%)" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "hsl(240, 10%, 55%)" }} tickFormatter={v => `€${v}`} />
                <Tooltip contentStyle={{ background: "hsl(240, 14%, 7%)", border: "1px solid hsl(240, 10%, 15%)", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`€${v.toFixed(4)}`, "Costo"]} />
                <Bar dataKey="costo" fill="hsl(40, 100%, 50%)" radius={[3, 3, 0, 0]} name="Costo" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 md:grid-cols-3">
        <ChartCard title="CONTATTI PER FONTE">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={contactsBySourceFormatted} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={0} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {contactsBySourceFormatted.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(240, 14%, 7%)", border: "1px solid hsl(240, 10%, 15%)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="CONTATTI PER STATO">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contactsByStatusFormatted} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 10%, 15%)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(240, 10%, 55%)" }} allowDecimals={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: "hsl(240, 10%, 55%)" }} width={100} />
                <Tooltip contentStyle={{ background: "hsl(240, 14%, 7%)", border: "1px solid hsl(240, 10%, 15%)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(213, 100%, 60%)" radius={[0, 3, 3, 0]} name="Contatti" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="CAMPAGNE PER CANALE">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={campaignsByTypeFormatted} dataKey="count" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={80} strokeWidth={0} label={({ name, count }) => `${name}: ${count}`} labelLine={false}>
                  {campaignsByTypeFormatted.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(240, 14%, 7%)", border: "1px solid hsl(240, 10%, 15%)", borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Campaign Performance */}
      {data.campaignPerformance.length > 0 && (
        <ChartCard title="PERFORMANCE CAMPAGNE (TOP 10)">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.campaignPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(240, 10%, 15%)" />
                <XAxis dataKey="nome" tick={{ fontSize: 10, fill: "hsl(240, 10%, 55%)" }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(240, 10%, 55%)" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(240, 14%, 7%)", border: "1px solid hsl(240, 10%, 15%)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="inviati" fill="hsl(213, 100%, 60%)" radius={[3, 3, 0, 0]} name="Inviati" />
                <Bar dataKey="aperti" fill="hsl(152, 100%, 45%)" radius={[3, 3, 0, 0]} name="Aperti" />
                <Bar dataKey="cliccati" fill="hsl(40, 100%, 50%)" radius={[3, 3, 0, 0]} name="Cliccati" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}
    </div>
  );
}
