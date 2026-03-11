import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import type { InboxMessage } from "@/hooks/useInbox";

const etichettaConfig: Record<string, { emoji: string; color: string }> = {
  interessato: { emoji: "🔥", color: "text-green-500" },
  non_interessato: { emoji: "❌", color: "text-red-400" },
  richiesta_info: { emoji: "❓", color: "text-blue-400" },
  fuori_ufficio: { emoji: "🏖️", color: "text-yellow-500" },
  appuntamento_fissato: { emoji: "📅", color: "text-purple-500" },
  referral: { emoji: "👋", color: "text-orange-400" },
  obiezione: { emoji: "🛑", color: "text-red-500" },
  disiscrizione: { emoji: "🚫", color: "text-muted-foreground" },
  non_categorizzato: { emoji: "❔", color: "text-muted-foreground" },
};

interface Props {
  message: InboxMessage;
  isSelected: boolean;
  onClick: () => void;
}

export function MessageListItem({ message, isSelected, onClick }: Props) {
  const cfg = etichettaConfig[message.etichetta] || etichettaConfig.non_categorizzato;

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors",
        isSelected && "bg-primary/10 border-l-2 border-l-primary",
        !message.letto ? "bg-background" : "bg-muted/20"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {!message.letto && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
            <span className="font-mono text-sm font-semibold truncate">
              {message.da_nome || message.da_email || message.da_telefono || "Sconosciuto"}
            </span>
          </div>
          <p className="font-mono text-xs text-muted-foreground truncate">
            {message.oggetto || message.corpo?.substring(0, 60)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs">{cfg.emoji}</span>
            <span className={cn("text-xs font-mono", cfg.color)}>
              {message.etichetta.replace(/_/g, " ")}
            </span>
            {message.etichetta_ai && (
              <Badge variant="outline" className="text-xs h-4 px-1">AI</Badge>
            )}
          </div>
        </div>
        <div className="text-xs text-muted-foreground font-mono flex-shrink-0">
          {formatDistanceToNow(new Date(message.data_ricezione), { addSuffix: true, locale: it })}
        </div>
      </div>
    </div>
  );
}
