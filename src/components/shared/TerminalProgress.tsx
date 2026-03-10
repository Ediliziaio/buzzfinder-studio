import { cn } from "@/lib/utils";

interface TerminalProgressProps {
  percent: number;
  current?: number;
  total?: number;
  label?: string;
  className?: string;
}

export function TerminalProgress({ percent, current, total, label, className }: TerminalProgressProps) {
  return (
    <div className={cn("rounded-lg border border-border bg-accent p-3", className)}>
      {label && <div className="terminal-header mb-1">{label}</div>}
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 shimmer"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between items-center font-mono text-xs text-muted-foreground">
        <span>{percent}%</span>
        {current !== undefined && total !== undefined && (
          <span>{current.toLocaleString()} / {total.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
