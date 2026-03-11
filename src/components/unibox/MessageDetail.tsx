import { format } from "date-fns";
import { Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { InboxMessage } from "@/hooks/useInbox";

const etichette = [
  { value: "interessato", emoji: "🔥", label: "Interessato" },
  { value: "richiesta_info", emoji: "❓", label: "Info" },
  { value: "appuntamento_fissato", emoji: "📅", label: "Meeting" },
  { value: "fuori_ufficio", emoji: "🏖️", label: "OOO" },
  { value: "non_interessato", emoji: "❌", label: "Non interesse" },
  { value: "obiezione", emoji: "🛑", label: "Obiezione" },
  { value: "disiscrizione", emoji: "🚫", label: "Disiscrizione" },
];

interface Props {
  message: InboxMessage;
  onUpdateEtichetta: (etichetta: string) => void;
  onArchive: () => void;
}

export function MessageDetail({ message, onUpdateEtichetta, onArchive }: Props) {
  const canaleIcon = message.canale === "email" ? "📧" : message.canale === "whatsapp" ? "💬" : "📱";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-start justify-between">
        <div>
          <h2 className="font-mono font-bold">
            {canaleIcon} {message.da_nome || message.da_email || message.da_telefono}
          </h2>
          <p className="font-mono text-xs text-muted-foreground">
            {message.da_email || message.da_telefono} •{" "}
            {format(new Date(message.data_ricezione), "dd/MM/yyyy HH:mm")}
          </p>
          {message.oggetto && (
            <p className="font-mono text-sm mt-1">📌 {message.oggetto}</p>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={onArchive}>
          <Archive className="h-3 w-3 mr-1" /> Archivia
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        {message.corpo_html ? (
          <div
            className="prose prose-sm max-w-none font-mono text-sm"
            dangerouslySetInnerHTML={{ __html: message.corpo_html }}
          />
        ) : (
          <pre className="font-mono text-sm whitespace-pre-wrap text-foreground">{message.corpo}</pre>
        )}
      </div>

      {/* Footer: labels */}
      <div className="p-4 border-t">
        <Label className="font-mono text-xs mb-2 block">ETICHETTA</Label>
        <div className="flex flex-wrap gap-1">
          {etichette.map((e) => (
            <button
              key={e.value}
              onClick={() => onUpdateEtichetta(e.value)}
              className={cn(
                "px-2 py-1 rounded text-xs font-mono transition-colors",
                message.etichetta === e.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {e.emoji} {e.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
