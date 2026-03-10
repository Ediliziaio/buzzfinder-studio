import { useState } from "react";
import { X, Phone, Mail, Globe, MapPin, Star, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Contact, ContactStato } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  contact: Contact;
  onClose: () => void;
  onUpdate: () => void;
}

const statiOptions: ContactStato[] = ["nuovo", "da_contattare", "contattato", "risposto", "non_interessato", "cliente"];

export function ContactDetailDrawer({ contact, onClose, onUpdate }: Props) {
  const [note, setNote] = useState(contact.note || "");
  const [stato, setStato] = useState<ContactStato>(contact.stato);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("contacts")
      .update({ note, stato, updated_at: new Date().toISOString() } as any)
      .eq("id", contact.id);
    setSaving(false);
    if (error) {
      toast.error("Errore salvataggio");
    } else {
      toast.success("Contatto aggiornato");
      onUpdate();
    }
  };

  return (
    <div className="fixed right-0 top-0 z-50 flex h-screen w-[520px] flex-col border-l border-border bg-card shadow-2xl animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="font-display text-lg font-bold text-foreground truncate">{contact.azienda}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" /> Salva
          </Button>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Status + Tags */}
        <div className="flex items-center gap-2">
          <Select value={stato} onValueChange={(v) => setStato(v as ContactStato)}>
            <SelectTrigger className="w-[160px] h-8 text-xs font-mono bg-accent border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statiOptions.map((s) => (
                <SelectItem key={s} value={s} className="font-mono text-xs">{s.replace("_", " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {contact.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">{tag}</span>
          ))}
        </div>

        {/* Main data */}
        <div className="rounded-lg border border-border bg-accent p-4 space-y-3">
          {contact.nome && (
            <InfoRow icon="👤" label={`${contact.nome} ${contact.cognome || ""}`} />
          )}
          <InfoRow icon="🏢" label={contact.azienda} />
          {contact.telefono && (
            <div className="flex items-center justify-between">
              <InfoRow icon="📞" label={contact.telefono_normalizzato || contact.telefono} />
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" className="h-6 text-xs">SMS</Button>
                <Button variant="ghost" size="sm" className="h-6 text-xs">WA</Button>
              </div>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center justify-between">
              <InfoRow icon="📧" label={contact.email} />
              <Button variant="ghost" size="sm" className="h-6 text-xs">Email</Button>
            </div>
          )}
          {contact.sito_web && (
            <div className="flex items-center justify-between">
              <InfoRow icon="🌐" label={contact.sito_web} />
              <a href={contact.sito_web.startsWith("http") ? contact.sito_web : `https://${contact.sito_web}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm" className="h-6 text-xs">Apri ↗</Button>
              </a>
            </div>
          )}
          {contact.indirizzo && (
            <InfoRow icon="📍" label={`${contact.indirizzo}, ${contact.citta || ""} ${contact.provincia ? `(${contact.provincia})` : ""} ${contact.cap || ""}`} />
          )}
          {contact.google_rating && (
            <InfoRow icon="⭐" label={`${contact.google_rating} (${contact.google_reviews_count || 0} recensioni) su Google Maps`} />
          )}
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <div className="terminal-header">NOTE</div>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Aggiungi note..."
            className="min-h-[100px] font-mono text-xs bg-accent border-border resize-none"
          />
        </div>

        {/* Timeline placeholder */}
        <div className="space-y-2">
          <div className="terminal-header">TIMELINE ATTIVITÀ</div>
          <div className="rounded-lg border border-border bg-accent p-4 text-center">
            <p className="font-mono text-xs text-muted-foreground">
              Importato da {contact.fonte.replace("_", " ")} il {new Date(contact.created_at).toLocaleDateString("it-IT")}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4 flex gap-2">
        <Button size="sm" className="flex-1 font-mono text-xs">📧 INVIA EMAIL</Button>
        <Button size="sm" variant="outline" className="flex-1 font-mono text-xs">💬 INVIA SMS</Button>
        <Button size="sm" variant="outline" className="flex-1 font-mono text-xs">📱 WHATSAPP</Button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span>{icon}</span>
      <span className="text-foreground">{label}</span>
    </div>
  );
}
