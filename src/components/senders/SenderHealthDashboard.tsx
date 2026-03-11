import type { SenderPool } from "@/types";
import { KpiCard } from "@/components/shared/KpiCard";
import { Shield, Flame, PauseCircle, AlertTriangle } from "lucide-react";

interface Props {
  senders: SenderPool[];
}

export function SenderHealthDashboard({ senders }: Props) {
  const active = senders.filter((s) => s.attivo && s.stato === "active").length;
  const warming = senders.filter((s) => s.attivo && s.stato === "warming").length;
  const paused = senders.filter((s) => s.stato === "paused" || !s.attivo).length;

  const warnings = senders.filter(
    (s) =>
      s.bounce_rate > 0.05 ||
      s.spam_rate > 0.003 ||
      (s.tipo === "email" && s.attivo && (!s.spf_ok || !s.dkim_ok))
  );

  const totalCapacity = senders
    .filter((s) => s.attivo && s.stato !== "banned")
    .reduce((sum, s) => sum + Math.max(0, s.max_per_day - s.inviati_oggi), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KpiCard label="ATTIVI" value={active} icon={<Shield className="h-4 w-4" />} />
      <KpiCard label="WARM-UP" value={warming} icon={<Flame className="h-4 w-4" />} />
      <KpiCard label="IN PAUSA" value={paused} icon={<PauseCircle className="h-4 w-4" />} />
      <KpiCard
        label="ALERT"
        value={warnings.length}
        icon={<AlertTriangle className="h-4 w-4" />}
        className={warnings.length > 0 ? "border-destructive/50" : ""}
      />
      <KpiCard label="CAPACITÀ OGGI" value={totalCapacity.toLocaleString()} />
    </div>
  );
}
