const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Props {
  data: number[][]; // 7 days × 24 hours
}

export function SendingHeatmap({ data }: Props) {
  const max = Math.max(1, ...data.flat());

  const getOpacity = (val: number) => {
    if (val === 0) return 0.05;
    return 0.15 + (val / max) * 0.85;
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="terminal-header mb-4">Heatmap invii (giorno × ora)</h3>
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels */}
          <div className="flex items-center gap-px ml-10 mb-1">
            {HOURS.map((h) => (
              <div key={h} className="flex-1 text-center font-mono text-[9px] text-muted-foreground">
                {h % 3 === 0 ? `${h}` : ""}
              </div>
            ))}
          </div>
          {/* Rows */}
          {DAYS.map((day, di) => (
            <div key={day} className="flex items-center gap-px mb-px">
              <span className="w-10 text-right font-mono text-[10px] text-muted-foreground pr-2">{day}</span>
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="flex-1 h-5 rounded-sm"
                  style={{
                    backgroundColor: `hsl(152, 100%, 45%)`,
                    opacity: getOpacity(data[di]?.[h] ?? 0),
                  }}
                  title={`${day} ${h}:00 — ${data[di]?.[h] ?? 0} invii`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
