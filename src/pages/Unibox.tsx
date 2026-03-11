import { useState, useEffect } from "react";
import { MessageSquare, Search, Bell, Archive as ArchiveIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useInbox } from "@/hooks/useInbox";
import { MessageListItem } from "@/components/unibox/MessageListItem";
import { MessageDetail } from "@/components/unibox/MessageDetail";
import { EtichettaBadge, getEtichettaConfig } from "@/components/unibox/EtichettaBadge";
import { supabase } from "@/integrations/supabase/client";
import type { InboxMessage } from "@/hooks/useInbox";

const etichettaFilters = [
  "tutti", "interessato", "appuntamento_fissato", "richiesta_info", "referral",
  "obiezione", "fuori_ufficio", "non_interessato", "disiscrizione", "non_categorizzato",
];
const canaleFilters = ["tutti", "email", "whatsapp", "sms"];
const canaleEmoji: Record<string, string> = { tutti: "🌐", email: "📧", whatsapp: "💬", sms: "📱" };

export default function Unibox() {
  const [selectedMessage, setSelectedMessage] = useState<InboxMessage | null>(null);
  const [filtroEtichetta, setFiltroEtichetta] = useState("tutti");
  const [filtroCanale, setFiltroCanale] = useState("tutti");
  const [filtroCampagna, setFiltroCampagna] = useState("tutti");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);
  const [campaigns, setCampaigns] = useState<{ id: string; nome: string }[]>([]);

  const { messages, nonLetti, markAsRead, markAsUnread, updateEtichetta, archiveMessage, saveNote } = useInbox({
    etichetta: filtroEtichetta,
    canale: filtroCanale,
    campagna: filtroCampagna,
    archiviato: showArchived,
    searchQuery: searchQuery || undefined,
  });

  // Load campaigns for filter
  useEffect(() => {
    supabase.from("campaigns").select("id, nome").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { if (data) setCampaigns(data); });
  }, []);

  // Notification prompt
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      setShowNotifPrompt(true);
    }
  }, []);

  return (
    <div className="flex h-[calc(100vh-64px)] gap-0 -m-6">
      {/* Left column - Filters */}
      <div className="w-56 border-r flex flex-col bg-background hidden md:flex">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-mono text-sm font-bold">📬 Unibox</h1>
            {nonLetti > 0 && (
              <Badge variant="destructive" className="font-mono text-[10px] h-5">
                {nonLetti}
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {/* Etichette */}
          <div className="p-2 space-y-0.5">
            <Label className="font-mono text-[10px] text-muted-foreground px-2 mb-1 block">CATEGORIE</Label>
            {etichettaFilters.map((label) => {
              const cfg = label === "tutti" ? { icon: "📨", label: "Tutti" } : getEtichettaConfig(label);
              const count = label === "tutti" ? messages.length : messages.filter((m) => m.etichetta === label).length;
              return (
                <button
                  key={label}
                  onClick={() => setFiltroEtichetta(label)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs font-mono transition-colors ${
                    filtroEtichetta === label
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <span>{cfg.icon} {cfg.label}</span>
                  {count > 0 && <span className="text-[10px] text-muted-foreground">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Canale */}
          <div className="p-2 border-t space-y-0.5">
            <Label className="font-mono text-[10px] text-muted-foreground px-2 mb-1 block">CANALE</Label>
            <div className="flex gap-1 flex-wrap px-1">
              {canaleFilters.map((c) => (
                <button
                  key={c}
                  onClick={() => setFiltroCanale(c)}
                  className={`px-2 py-1 rounded text-[10px] font-mono ${
                    filtroCanale === c ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {canaleEmoji[c]} {c}
                </button>
              ))}
            </div>
          </div>

          {/* Campagna */}
          <div className="p-2 border-t">
            <Label className="font-mono text-[10px] text-muted-foreground px-2 mb-1 block">CAMPAGNA</Label>
            <Select value={filtroCampagna} onValueChange={setFiltroCampagna}>
              <SelectTrigger className="h-8 text-xs font-mono">
                <SelectValue placeholder="Tutte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tutti" className="text-xs font-mono">Tutte le campagne</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs font-mono">{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Archivio toggle */}
          <div className="p-3 border-t flex items-center gap-2">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} id="archive-toggle" />
            <Label htmlFor="archive-toggle" className="text-xs font-mono cursor-pointer">
              <ArchiveIcon className="h-3 w-3 inline mr-1" /> Archiviati
            </Label>
          </div>
        </ScrollArea>
      </div>

      {/* Center column - Message list */}
      <div className="w-96 border-r flex flex-col bg-background">
        {/* Notification prompt */}
        {showNotifPrompt && (
          <div className="p-2 border-b bg-muted/50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <Bell className="h-3 w-3" /> Abilita notifiche
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowNotifPrompt(false)}>
                No
              </Button>
              <Button size="sm" className="h-6 text-[10px]" onClick={async () => {
                await Notification.requestPermission();
                setShowNotifPrompt(false);
              }}>
                Abilita
              </Button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Cerca messaggi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs font-mono"
            />
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

      {/* Right column - Detail */}
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
            onMarkAsUnread={() => {
              markAsUnread(selectedMessage.id);
              setSelectedMessage((prev) => (prev ? { ...prev, letto: false } : null));
            }}
            onSaveNote={(note) => {
              saveNote(selectedMessage.id, note);
              setSelectedMessage((prev) => (prev ? { ...prev, note } : null));
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-mono text-sm">Seleziona un messaggio</p>
              <p className="font-mono text-xs mt-1 text-muted-foreground/60">
                Scegli una risposta dalla lista per visualizzarla qui
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
