import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { EtichettaBadge } from "./EtichettaBadge";
import type { InboxMessage } from "@/hooks/useInbox";

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

const canaleEmoji: Record<string, string> = { email: "📧", whatsapp: "💬", sms: "📱" };

interface Props {
  message: InboxMessage;
  isSelected: boolean;
  onClick: () => void;
}

export function MessageListItem({ message, isSelected, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-3 border-b cursor-pointer hover:bg-muted/50 transition-colors flex items-start gap-3",
        isSelected && "bg-primary/10 border-l-2 border-l-primary",
        !message.letto && "bg-background font-medium"
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs font-mono bg-muted">
            {getInitials(message.da_nome || message.da_email)}
          </AvatarFallback>
        </Avatar>
        <span className="absolute -bottom-0.5 -right-0.5 text-[10px] leading-none">
          {canaleEmoji[message.canale] || "📧"}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {!message.letto && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
            <span className="font-mono text-sm truncate">
              {message.da_nome || message.da_email || message.da_telefono || "Sconosciuto"}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
            {formatDistanceToNow(new Date(message.data_ricezione), { addSuffix: true, locale: it })}
          </span>
        </div>
        <p className="font-mono text-xs text-muted-foreground truncate">
          {message.oggetto || message.corpo?.substring(0, 80)}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <EtichettaBadge etichetta={message.etichetta} small />
          {message.etichetta_ai && (
            <Badge variant="outline" className="text-[10px] h-4 px-1 font-mono">AI</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
