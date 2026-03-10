import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeItalianPhone } from "@/lib/phoneNormalizer";
import type { ContactStato } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const statiOptions: ContactStato[] = ["nuovo", "da_contattare", "contattato", "risposto", "non_interessato", "cliente"];

export function CreateContactDialog({ open, onClose, onCreated }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    azienda: "",
    nome: "",
    cognome: "",
    email: "",
    telefono: "",
    sito_web: "",
    indirizzo: "",
    citta: "",
    provincia: "",
    cap: "",
    stato: "nuovo" as ContactStato,
    note: "",
  });

  const update = (partial: Partial<typeof form>) => setForm((f) => ({ ...f, ...partial }));

  const handleSave = async () => {
    if (!form.azienda.trim()) {
      toast.error("Azienda è obbligatorio");
      return;
    }
    setSaving(true);
    try {
      const telefono_normalizzato = normalizeItalianPhone(form.telefono);
      const { error } = await supabase.from("contacts").insert({
        azienda: form.azienda.trim(),
        nome: form.nome.trim() || null,
        cognome: form.cognome.trim() || null,
        email: form.email.trim() || null,
        telefono: form.telefono.trim() || null,
        telefono_normalizzato,
        sito_web: form.sito_web.trim() || null,
        indirizzo: form.indirizzo.trim() || null,
        citta: form.citta.trim() || null,
        provincia: form.provincia.trim() || null,
        cap: form.cap.trim() || null,
        stato: form.stato,
        fonte: "manuale",
        note: form.note.trim() || null,
      });
      if (error) throw error;
      toast.success("Contatto creato");
      onCreated();
      onClose();
      setForm({ azienda: "", nome: "", cognome: "", email: "", telefono: "", sito_web: "", indirizzo: "", citta: "", provincia: "", cap: "", stato: "nuovo", note: "" });
    } catch (err: any) {
      toast.error(err.message || "Errore creazione contatto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg">NUOVO CONTATTO</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="terminal-header mb-1 block">Azienda *</Label>
            <Input value={form.azienda} onChange={(e) => update({ azienda: e.target.value })} placeholder="Nome azienda" className="font-mono text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="terminal-header mb-1 block">Nome</Label>
              <Input value={form.nome} onChange={(e) => update({ nome: e.target.value })} placeholder="Nome" className="font-mono text-sm" />
            </div>
            <div>
              <Label className="terminal-header mb-1 block">Cognome</Label>
              <Input value={form.cognome} onChange={(e) => update({ cognome: e.target.value })} placeholder="Cognome" className="font-mono text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="terminal-header mb-1 block">Email</Label>
              <Input type="email" value={form.email} onChange={(e) => update({ email: e.target.value })} placeholder="email@esempio.it" className="font-mono text-sm" />
            </div>
            <div>
              <Label className="terminal-header mb-1 block">Telefono</Label>
              <Input value={form.telefono} onChange={(e) => update({ telefono: e.target.value })} placeholder="+39 02 1234567" className="font-mono text-sm" />
            </div>
          </div>
          <div>
            <Label className="terminal-header mb-1 block">Sito web</Label>
            <Input value={form.sito_web} onChange={(e) => update({ sito_web: e.target.value })} placeholder="https://www.esempio.it" className="font-mono text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Label className="terminal-header mb-1 block">Città</Label>
              <Input value={form.citta} onChange={(e) => update({ citta: e.target.value })} placeholder="Milano" className="font-mono text-sm" />
            </div>
            <div>
              <Label className="terminal-header mb-1 block">Provincia</Label>
              <Input value={form.provincia} onChange={(e) => update({ provincia: e.target.value })} placeholder="MI" className="font-mono text-sm" maxLength={2} />
            </div>
          </div>
          <div>
            <Label className="terminal-header mb-1 block">Stato</Label>
            <Select value={form.stato} onValueChange={(v) => update({ stato: v as ContactStato })}>
              <SelectTrigger className="font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statiOptions.map((s) => (
                  <SelectItem key={s} value={s} className="font-mono text-xs">{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="terminal-header mb-1 block">Note</Label>
            <Textarea value={form.note} onChange={(e) => update({ note: e.target.value })} placeholder="Note opzionali..." className="font-mono text-xs min-h-[60px]" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="font-mono text-xs">Annulla</Button>
            <Button onClick={handleSave} disabled={saving} className="font-mono text-xs">
              {saving ? "Salvataggio..." : "Crea contatto"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
