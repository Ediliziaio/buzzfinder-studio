import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState } from "react";
import type { ScrapingSession } from "@/types";

interface Props {
  sessions: ScrapingSession[];
  onLoad: (sessionId: string) => void;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export function MapsPreviousSessions({ sessions, onLoad }: Props) {
  const [open, setOpen] = useState(false);

  if (sessions.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
        <span>Sessioni precedenti ({sessions.length})</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between rounded-md border border-border bg-card p-3"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-foreground">
                  "{s.query}" — {s.citta}
                </span>
                <StatusBadge status={s.status} />
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                <span>{new Date(s.created_at).toLocaleDateString("it-IT")}</span>
                <span>{s.totale_importati} risultati</span>
                {s.totale_errori > 0 && (
                  <span className="text-destructive">{s.totale_errori} errori</span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-mono"
              onClick={() => onLoad(s.id)}
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Carica
            </Button>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
