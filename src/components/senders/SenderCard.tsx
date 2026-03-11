import type { SenderPool } from "@/types";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";

interface Props {
  sender: SenderPool;
  onEdit: (sender: SenderPool) => void;
  onToggleActive: (id: string, attivo: boolean) => void;
  onDelete: (id: string) => void;
}

export function SenderCard({ sender, onEdit, onToggleActive, onDelete }: Props) {
  const healthColor =
    sender.health_score >= 80
      ? "text-primary"
      : sender.health_score >= 50
        ? "text-yellow-500"
        : "text-destructive";

  const statoColor: Record<string, string> = {
    active: "bg-primary",
    warming: "bg-yellow-500",
    paused: "bg-muted-foreground",
    banned: "bg-destructive",
  };

  const warmupLabel = sender.warmup_attivo
    ? `Giorno ${sender.warmup_giorno} 🔥`
    : "Completato ✓";

  const identifier =
    sender.tipo === "email"
      ? sender.email_from
      : sender.tipo === "whatsapp"
        ? sender.wa_numero
        : sender.sms_from;

  const isBanned = sender.stato === "banned";

  return (
    <div
      className={`rounded-lg border bg-card p-4 space-y-3 ${isBanned ? "border-destructive/50 bg-destructive/5" : "border-border"}`}
    >
      {isBanned && (
        <div className="font-mono text-[10px] font-bold text-destructive uppercase tracking-wider">
          ⛔ SOSPESO
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statoColor[sender.stato] || "bg-muted-foreground"}`} />
          <span className="font-mono text-sm font-medium text-foreground truncate">{sender.nome}</span>
        </div>
        <Badge variant="outline" className="font-mono text-[10px]">
          {sender.tipo}
        </Badge>
      </div>

      {identifier && (
        <p className="font-mono text-xs text-muted-foreground truncate">{identifier}</p>
      )}

      {/* Health Score */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground">Health Score</span>
          <span className={`font-mono text-xs font-bold ${healthColor}`}>
            {sender.health_score}/100
          </span>
        </div>
        <Progress value={sender.health_score} className="h-1.5" />
      </div>

      {/* Daily usage */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] text-muted-foreground">
            Oggi: {sender.inviati_oggi}/{sender.max_per_day}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">{warmupLabel}</span>
        </div>
        <Progress
          value={sender.max_per_day > 0 ? (sender.inviati_oggi / sender.max_per_day) * 100 : 0}
          className="h-1.5"
        />
      </div>

      {/* DNS badges (email) */}
      {sender.tipo === "email" && (
        <div className="flex gap-1.5">
          <Badge variant={sender.spf_ok ? "default" : "destructive"} className="font-mono text-[9px] px-1.5 py-0">
            SPF {sender.spf_ok ? "✓" : "✗"}
          </Badge>
          <Badge variant={sender.dkim_ok ? "default" : "destructive"} className="font-mono text-[9px] px-1.5 py-0">
            DKIM {sender.dkim_ok ? "✓" : "✗"}
          </Badge>
          <Badge variant={sender.dmarc_ok ? "default" : "destructive"} className="font-mono text-[9px] px-1.5 py-0">
            DMARC {sender.dmarc_ok ? "✓" : "✗"}
          </Badge>
        </div>
      )}

      {/* WhatsApp quality */}
      {sender.tipo === "whatsapp" && (
        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
          <span>
            Qualità:{" "}
            <span
              className={
                sender.wa_quality === "green"
                  ? "text-primary"
                  : sender.wa_quality === "yellow"
                    ? "text-yellow-500"
                    : "text-destructive"
              }
            >
              {sender.wa_quality === "green" ? "Alta" : sender.wa_quality === "yellow" ? "Media" : "Bassa"}
            </span>
          </span>
          <span>Tier: {sender.wa_tier}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <Button variant="ghost" size="sm" className="flex-1 font-mono text-[10px] h-7" onClick={() => onEdit(sender)}>
          <Pencil className="h-3 w-3 mr-1" /> Modifica
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 font-mono text-[10px] h-7"
          onClick={() => onToggleActive(sender.id, !sender.attivo)}
        >
          {sender.attivo ? "Disattiva" : "Attiva"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(sender.id)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
