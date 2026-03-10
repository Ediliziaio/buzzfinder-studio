import { useState, useEffect } from "react";
import { X, Save, Edit3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import type { Contact, ContactStato, ContactActivity } from "@/types";
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

const activityIcons: Record<string, string> = {
  email_inviata: "📧",
  sms_inviato: "💬",
  whatsapp_inviato: "📱",
  nota: "📝",
  stato_cambiato: "🔄",
  importato: "➕",
};

export function ContactDetailDrawer({ contact, onClose, onUpdate }: Props) {
  const [note, setNote] = useState(contact.note || "");
  const [stato, setStato] = useState<ContactStato>(contact.stato);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    nome: contact.nome || "",
    cognome: contact.cognome || "",
    azienda: contact.azienda,
    email: contact.email || "",
    telefono: contact.telefono || "",
    sito_web: contact.sito_web || "",
    indirizzo: contact.indirizzo || "",
    citta: contact.citta || "",
    provincia: contact.provincia || "",
    cap: contact.cap || "",
  });
  const [activities, setActivities] = useState<(ContactActivity & { campaign_nome?: string })[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [contact.id]);

  const fetchActivities = async () => {
    setLoadingActivities(true);
    const { data } = await supabase
      .from("contact_activities")
      .select("*")
      .eq("contact_id", contact.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (data && data.length > 0) {
      const campaignIds = data.filter(a => a.campaign_id).map(a => a.campaign_id!);
      let campaignMap: Record<string, string> = {};
      if (campaignIds.length > 0) {
        const { data: campaigns } = await supabase
          .from("campaigns")
          .select("id, nome")
          .in("id", campaignIds);
        if (campaigns) campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c.nome]));
      }
      setActivities(data.map(a => ({
        ...a,
        metadata: (a.metadata as Record<string, unknown>) || {},
        campaign_nome: a.campaign_id ? campaignMap[a.campaign_id] : undefined,
      })) as any);
    } else {
      setActivities([]);
    }
    setLoadingActivities(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updatePayload: Record<string, unknown> = { note, stato, updated_at: new Date().toISOString() };
    if (editing) {
      Object.assign(updatePayload, editData);
    }
    const { error } = await supabase
      .from("contacts")
      .update(updatePayload as any)
      .eq("id", contact.id);
    setSaving(false);
    if (error) {
      toast.error("Errore salvataggio");
    } else {
      toast.success("Contatto aggiornato");
      setEditing(false);
      onUpdate();
    }
  };

  const EditField = ({ label, field }: { label: string; field: keyof typeof editData }) => (
    <div className="space-y-1">
      <label className="font-mono text-[10px] text-muted-foreground uppercase">{label}</label>
      <Input
        value={editData[field]}
        onChange={(e) => setEditData({ ...editData, [field]: e.target.value })}
        className="h-7 font-mono text-xs bg-accent border-border"
      />
    </div>
  );

  return (
    <div className="fixed right-0 top-0 z-50 flex h-screen w-[520px] flex-col border-l border-border bg-card shadow-2xl animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="font-display text-lg font-bold text-foreground truncate">{contact.azienda}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setEditing(!editing)} className="text-xs font-mono">
            <Edit3 className="h-3 w-3 mr-1" /> {editing ? "Annulla" : "Modifica"}
          </Button>
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

        {/* Main data — edit or view mode */}
        {editing ? (
          <div className="rounded-lg border border-border bg-accent p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Nome" field="nome" />
              <EditField label="Cognome" field="cognome" />
            </div>
            <EditField label="Azienda" field="azienda" />
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Email" field="email" />
              <EditField label="Telefono" field="telefono" />
            </div>
            <EditField label="Sito Web" field="sito_web" />
            <EditField label="Indirizzo" field="indirizzo" />
            <div className="grid grid-cols-3 gap-3">
              <EditField label="Città" field="citta" />
              <EditField label="Provincia" field="provincia" />
              <EditField label="CAP" field="cap" />
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-accent p-4 space-y-3">
            {contact.nome && <InfoRow icon="👤" label={`${contact.nome} ${contact.cognome || ""}`} />}
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
        )}

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

        {/* Timeline */}
        <div className="space-y-2">
          <div className="terminal-header">TIMELINE ATTIVITÀ</div>
          {loadingActivities ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : activities.length === 0 ? (
            <div className="rounded-lg border border-border bg-accent p-4 text-center">
              <p className="font-mono text-xs text-muted-foreground">
                Importato da {contact.fonte.replace("_", " ")} il {new Date(contact.created_at).toLocaleDateString("it-IT")}
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {activities.map((a) => (
                <div key={a.id} className="flex gap-3 py-2 border-l-2 border-border pl-4 ml-2 relative">
                  <div className="absolute -left-[5px] top-3 w-2 h-2 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span>{activityIcons[a.tipo] || "●"}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: it })}
                      </span>
                    </div>
                    <p className="font-mono text-xs text-foreground mt-0.5">
                      {a.descrizione || a.tipo.replace("_", " ")}
                    </p>
                    {a.campaign_nome && (
                      <p className="font-mono text-[10px] text-primary mt-0.5">Campagna: "{a.campaign_nome}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
