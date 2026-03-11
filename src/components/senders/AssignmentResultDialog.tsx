import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Send } from "lucide-react";

interface SenderUsed {
  nome: string;
  assegnati: number;
  warmup_giorno?: number;
}

export interface AssignmentResult {
  assigned: number;
  total_recipients: number;
  total_capacity_today: number;
  senders_used: SenderUsed[];
  warnings: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AssignmentResult | null;
  onConfirm: () => void;
  confirming?: boolean;
}

export function AssignmentResultDialog({ open, onOpenChange, result, onConfirm, confirming }: Props) {
  if (!result) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">📬 Distribuzione Mittenti</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Pronti all'invio: {result.assigned} destinatari assegnati
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {result.senders_used.map((s, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border border-border bg-accent px-3 py-2">
              <div>
                <p className="font-mono text-xs font-medium text-foreground">{s.nome}</p>
                {s.warmup_giorno !== undefined && s.warmup_giorno > 0 && (
                  <p className="font-mono text-[10px] text-muted-foreground">Warm-up giorno {s.warmup_giorno} 🔥</p>
                )}
              </div>
              <Badge variant="secondary" className="font-mono text-[10px]">
                {s.assegnati} dest.
              </Badge>
            </div>
          ))}

          {result.warnings?.map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
              <span className="font-mono text-[10px] text-muted-foreground">{w}</span>
            </div>
          ))}

          <div className="font-mono text-[10px] text-muted-foreground text-center">
            Capacità totale usata oggi: {result.assigned}/{result.total_capacity_today}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-mono text-xs">
            Annulla
          </Button>
          <Button onClick={onConfirm} disabled={confirming} className="font-mono text-xs">
            <Send className="h-3 w-3 mr-1" />
            {confirming ? "Avvio..." : "Conferma e Avvia"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
