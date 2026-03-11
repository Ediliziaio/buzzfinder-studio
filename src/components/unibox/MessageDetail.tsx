import { format } from "date-fns";
import { Archive, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
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

  const handleAddToPipeline = async () => {
    try {
      // Find contact by email or phone
      let contactId: string | null = null;
      if (message.da_email) {
        const { data } = await supabase.from("contacts").select("id").eq("email", message.da_email).limit(1).maybeSingle();
        contactId = data?.id || null;
      }
      if (!contactId && message.da_telefono) {
        const { data } = await supabase.from("contacts").select("id").eq("telefono", message.da_telefono).limit(1).maybeSingle();
        contactId = data?.id || null;
      }
      if (!contactId) {
        toast.error("Contatto non trovato nel database");
        return;
      }

      // Check if already in pipeline
      const { data: existing } = await supabase
        .from("pipeline_leads")
        .select("id")
        .eq("contact_id", contactId)
        .limit(1)
        .maybeSingle();

      if (existing) {
        toast.info("Questo contatto è già nella pipeline");
        return;
      }

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
        <div className="flex gap-2">
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
