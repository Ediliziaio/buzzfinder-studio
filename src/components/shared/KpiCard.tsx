import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export function KpiCard({ label, value, trend, trendUp, icon, className }: KpiCardProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between">
        <span className="terminal-header">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="mt-2 kpi-number">{value}</div>
      {trend && (
        <div className={cn("mt-1 flex items-center gap-1 text-xs font-mono", trendUp ? "text-primary" : "text-destructive")}>
          <span>{trendUp ? "▲" : "▼"}</span>
          <span>{trend}</span>
        </div>
      )}
    </div>
  );
}
