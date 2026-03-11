import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { InboxMessage } from "@/types";

interface Props {
  message: InboxMessage;
  onSent: () => void;
  onCancel: () => void;
}

export function ReplyComposer({ message, onSent, onCancel }: Props) {
  const isEmail = message.canale === "email";
  const [oggetto, setOggetto] = useState(
    isEmail ? `Re: ${message.oggetto || ""}` : ""
  );
  const [corpo, setCorpo] = useState("");
  const [sending, setSending] = useState(false);

  const destinatario = message.da_email || message.da_telefono || "—";

  const handleSend = async () => {
    if (!corpo.trim()) {
      toast.error("Scrivi un messaggio prima di inviare");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-reply", {
        body: {
          message_id: message.id,
          corpo: corpo.trim(),
          ...(isEmail && oggetto ? { oggetto } : {}),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Risposta inviata! ✉️");
      setCorpo("");
      onSent();
    } catch (err: any) {
      toast.error(`Errore invio: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-muted-foreground">
          Rispondi a: <span className="text-foreground">{destinatario}</span>
        </p>
        <Button size="sm" variant="ghost" className="text-xs h-6" onClick={onCancel}>
          Annulla
        </Button>
      </div>

      {isEmail && (
        <Input
          placeholder="Oggetto"
          value={oggetto}
          onChange={(e) => setOggetto(e.target.value)}
          className="font-mono text-sm h-8"
        />
      )}

      <Textarea
        placeholder={
          isEmail
            ? "Scrivi la tua risposta..."
            : message.canale === "whatsapp"
            ? "Scrivi il messaggio WhatsApp..."
            : "Scrivi il messaggio SMS..."
        }
        value={corpo}
        onChange={(e) => setCorpo(e.target.value)}
        className="font-mono text-sm min-h-[100px] resize-y"
        autoFocus
      />

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSend} disabled={sending || !corpo.trim()}>
          {sending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5 mr-1.5" />
          )}
          Invia
        </Button>
      </div>
    </div>
  );
}
