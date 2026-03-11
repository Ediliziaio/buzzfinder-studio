import { useState } from "react";
import { format } from "date-fns";
import { Archive, Trophy, MailOpen, Mail, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { EtichettaBadge, getEtichettaConfig } from "./EtichettaBadge";
import { ContactInfoPanel } from "./ContactInfoPanel";
import { ReplyComposer } from "./ReplyComposer";
import type { InboxMessage } from "@/hooks/useInbox";

const etichette = [
  "interessato", "richiesta_info", "appuntamento_fissato", "referral",
  "fuori_ufficio", "obiezione", "non_interessato", "disiscrizione",
];

interface Props {
  message: InboxMessage;
  onUpdateEtichetta: (etichetta: string) => void;
  onArchive: () => void;
  onMarkAsUnread: () => void;
  onSaveNote: (note: string) => void;
}

export function MessageDetail({ message, onUpdateEtichetta, onArchive, onMarkAsUnread, onSaveNote }: Props) {
  const [showReply, setShowReply] = useState(false);
  const canaleIcon = message.canale === "email" ? "📧" : message.canale === "whatsapp" ? "💬" : "📱";

  const handleAddToPipeline = async () => {
    try {
      let contactId: string | null = null;
      if (message.da_email) {
        const { data } = await supabase.from("contacts").select("id").eq("email", message.da_email).limit(1).maybeSingle();
        contactId = data?.id || null;
      }
      if (!contactId && message.da_telefono) {
        const { data } = await supabase.from("contacts").select("id").eq("telefono", message.da_telefono).limit(1).maybeSingle();
        contactId = data?.id || null;
      }
      if (!contactId) { toast.error("Contatto non trovato nel database"); return; }

      const { data: existing } = await supabase.from("pipeline_leads").select("id").eq("contact_id", contactId).limit(1).maybeSingle();
      if (existing) { toast.info("Questo contatto è già nella pipeline"); return; }

      const user_id = await getCurrentUserId();
      const { error } = await supabase.from("pipeline_leads").insert({
        user_id,
        contact_id: contactId,
        campaign_id: message.campaign_id || null,
        inbox_message_id: message.id,
        pipeline_stage: "interessato",
      } as any);
      if (error) throw error;
      toast.success("Lead aggiunto alla pipeline! 🔥");
    } catch (err: any) {
      toast.error(`Errore: ${err.message}`);
    }
  };

  const showPipelineButton = ["interessato", "appuntamento_fissato", "richiesta_info"].includes(message.etichetta);

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-mono font-bold truncate">
              {canaleIcon} {message.da_nome || message.da_email || message.da_telefono}
            </h2>
            <p className="font-mono text-xs text-muted-foreground">
              {message.da_email || message.da_telefono} • {format(new Date(message.data_ricezione), "dd/MM/yyyy HH:mm")}
            </p>
            {message.oggetto && <p className="font-mono text-sm mt-1">📌 {message.oggetto}</p>}
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {message.canale !== "sms" && (
              <Button size="sm" variant="outline" onClick={() => setShowReply((v) => !v)} className="text-xs font-mono">
                <Reply className="h-3 w-3 mr-1" /> Rispondi
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onMarkAsUnread} title="Segna come non letto">
              <MailOpen className="h-3 w-3" />
            </Button>
            {showPipelineButton && (
              <Button size="sm" variant="outline" onClick={handleAddToPipeline} className="text-xs font-mono">
                <Trophy className="h-3 w-3 mr-1" /> Pipeline
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={onArchive}>
              <Archive className="h-3 w-3 mr-1" /> Archivia
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {message.corpo_html ? (
            <div className="prose prose-sm max-w-none font-mono text-sm" dangerouslySetInnerHTML={{ __html: message.corpo_html }} />
          ) : (
            <pre className="font-mono text-sm whitespace-pre-wrap text-foreground">{message.corpo}</pre>
          )}
        </div>

        {/* Reply composer */}
        {showReply && (
          <ReplyComposer
            message={message}
            onSent={() => setShowReply(false)}
            onCancel={() => setShowReply(false)}
          />
        )}

        {/* Footer: labels */}
        <div className="p-4 border-t">
          <Label className="font-mono text-xs mb-2 block">ETICHETTA</Label>
          <div className="flex flex-wrap gap-1">
            {etichette.map((e) => {
              const cfg = getEtichettaConfig(e);
              return (
                <button
                  key={e}
                  onClick={() => onUpdateEtichetta(e)}
                  className={cn(
                    "px-2 py-1 rounded text-xs font-mono transition-colors",
                    message.etichetta === e
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  )}
                >
                  {cfg.icon} {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right sidebar - Contact Info */}
      <div className="w-64 border-l overflow-y-auto p-3 hidden lg:block">
        <ContactInfoPanel
          message={message}
          note={message.note || ""}
          onSaveNote={onSaveNote}
        />
      </div>
    </div>
  );
}
