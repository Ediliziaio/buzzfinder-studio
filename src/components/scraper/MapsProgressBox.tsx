import { useState, useEffect } from "react";
import { TerminalProgress } from "@/components/shared/TerminalProgress";
import { CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import type { ScrapingSession } from "@/types";

interface Props {
  session: ScrapingSession;
}

export function MapsProgressBox({ session }: Props) {
  const [now, setNow] = useState(Date.now());

  // Real-time timer update every second
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = session.started_at
    ? Math.round((now - new Date(session.started_at).getTime()) / 1000)
    : 0;

  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;

  const rate = elapsed > 0 ? (session.totale_trovati / elapsed) * 60 : 0;
  const remaining = rate > 0
    ? Math.round(((session.max_results || session.totale_trovati) - session.totale_trovati) / rate)
    : 0;

  const duplicates = session.totale_trovati - session.totale_importati;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="terminal-header text-primary">JOB IN CORSO</div>

      <TerminalProgress
        percent={session.progress_percent || 0}
        current={session.totale_trovati}
        total={session.max_results || 0}
      />

      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>{elapsedMin}m {elapsedSec.toString().padStart(2, "0")}s</span>
        {remaining > 0 && (
          <>
            <span className="text-muted-foreground/40">|</span>
            <span>~{remaining}m rimanenti</span>
          </>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs font-mono">
          <CheckCircle className="h-3 w-3 text-primary" />
          <span className="text-foreground">{session.totale_importati.toLocaleString()}</span>
          <span className="text-muted-foreground">importati</span>
        </div>
        {duplicates > 0 && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <AlertTriangle className="h-3 w-3 text-warning" />
            <span className="text-foreground">{duplicates}</span>
            <span className="text-muted-foreground">duplicati skippati</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs font-mono">
          <XCircle className="h-3 w-3 text-destructive" />
          <span className="text-foreground">{session.totale_errori}</span>
          <span className="text-muted-foreground">errori</span>
        </div>
      </div>
    </div>
  );
}
