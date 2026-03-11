interface FunnelStep {
  label: string;
  value: number;
  percent: number;
  colorClass: string;
}

interface FunnelChartProps {
  stats: {
    inviati: number;
    aperti: number;
    cliccati: number;
    risposte: number;
    interessati: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
    conversionRate: number;
  };
}

export function FunnelChart({ stats }: FunnelChartProps) {
  const steps: FunnelStep[] = [
    { label: "Inviati", value: stats.inviati, percent: 100, colorClass: "bg-info" },
    { label: "Aperti", value: stats.aperti, percent: stats.openRate, colorClass: "bg-warning" },
    { label: "Cliccati", value: stats.cliccati, percent: stats.clickRate, colorClass: "bg-[hsl(262,80%,70%)]" },
    { label: "Risposte", value: stats.risposte, percent: stats.replyRate, colorClass: "bg-success" },
    { label: "Interessati", value: stats.interessati, percent: stats.conversionRate, colorClass: "bg-destructive" },
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="terminal-header mb-4">Funnel di conversione</h3>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="font-mono text-xs w-20 text-right text-muted-foreground">{step.label}</span>
            <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
              <div
                className={`h-full ${step.colorClass} transition-all duration-500 flex items-center justify-end pr-2`}
                style={{ width: `${Math.max(step.percent, 2)}%` }}
              >
                {step.percent > 10 && (
                  <span className="text-white text-xs font-mono font-bold drop-shadow">
                    {step.value.toLocaleString()} ({step.percent.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>
            {step.percent <= 10 && (
              <span className="font-mono text-xs text-muted-foreground w-28">
                {step.value.toLocaleString()} ({step.percent.toFixed(1)}%)
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
