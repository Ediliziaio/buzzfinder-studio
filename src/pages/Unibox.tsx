import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInbox } from "@/hooks/useInbox";
import { MessageListItem } from "@/components/unibox/MessageListItem";
import { MessageDetail } from "@/components/unibox/MessageDetail";
import type { InboxMessage } from "@/hooks/useInbox";

const etichettaFilters = ["tutti", "interessato", "richiesta_info", "fuori_ufficio", "non_interessato"];
const canaleFilters = ["tutti", "email", "whatsapp", "sms"];
const canaleEmoji: Record<string, string> = { tutti: "🌐", email: "📧", whatsapp: "💬", sms: "📱" };

export default function Unibox() {
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [filtroEtichetta, setFiltroEtichetta] = useState("tutti");
  const [filtroCanale, setFiltroCanale] = useState("tutti");

  const { messages, nonLetti, markAsRead, updateEtichetta, archiveMessage } = useInbox({
    etichetta: filtroEtichetta,
    canale: filtroCanale,
  });

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0 -m-6">
      {/* Left column */}
      <div className="w-96 border-r flex flex-col bg-background">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-mono text-lg font-bold">📬 Unibox</h1>
            {nonLetti > 0 && (
              <Badge variant="destructive" className="font-mono">
                {nonLetti} non letti
              </Badge>
            )}
          </div>

          {/* Label filters */}
          <div className="flex gap-1 flex-wrap">
            {etichettaFilters.map((label) => (
              <button
                key={label}
                onClick={() => setFiltroEtichetta(label)}
                className={`px-2 py-0.5 rounded-full text-xs font-mono transition-colors ${
                  filtroEtichetta === label
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                }`}
              >
                {label === "tutti" ? "Tutti" : label.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          {/* Channel filters */}
          <div className="flex gap-1 mt-2">
            {canaleFilters.map((c) => (
              <button
                key={c}
                onClick={() => setFiltroCanale(c)}
                className={`px-2 py-0.5 rounded text-xs font-mono ${
                  filtroCanale === c ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}
              >
                {canaleEmoji[c]} {c}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {messages.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground font-mono text-sm">
              Nessun messaggio
            </div>
          ) : (
            messages.map((msg) => (
              <MessageListItem
                key={msg.id}
                message={msg}
                isSelected={selectedMessage?.id === msg.id}
                onClick={() => {
                  setSelectedMessage(msg);
                  if (!msg.letto) markAsRead(msg.id);
                }}
              />
            ))
          )}
        </ScrollArea>
      </div>

      {/* Right column */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedMessage ? (
          <MessageDetail
            message={selectedMessage}
            onUpdateEtichetta={(etichetta) => {
              updateEtichetta(selectedMessage.id, etichetta);
              setSelectedMessage((prev) => (prev ? { ...prev, etichetta, etichetta_ai: false } : null));
            }}
            onArchive={() => {
              archiveMessage(selectedMessage.id);
              setSelectedMessage(null);
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-mono text-sm">Seleziona un messaggio</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
