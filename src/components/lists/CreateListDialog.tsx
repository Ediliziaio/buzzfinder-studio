import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ListTipo, ContactStato, ContactFonte } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const STATI: ContactStato[] = ["nuovo", "da_contattare", "contattato", "risposto", "non_interessato", "cliente"];
const FONTI: ContactFonte[] = ["google_maps", "csv_import", "manuale", "web_scrape"];

export function CreateListDialog({ open, onClose, onCreated }: Props) {
  const [nome, setNome] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [tipo, setTipo] = useState<ListTipo>("statica");
  const [saving, setSaving] = useState(false);

  // Dynamic filters
  const [filterStato, setFilterStato] = useState<string>("");
  const [filterFonte, setFilterFonte] = useState<string>("");
  const [filterCitta, setFilterCitta] = useState("");
  const [filterHasEmail, setFilterHasEmail] = useState(false);
  const [filterHasTelefono, setFilterHasTelefono] = useState(false);

  const reset = () => {
    setNome("");
    setDescrizione("");
    setTipo("statica");
    setFilterStato("");
    setFilterFonte("");
    setFilterCitta("");
    setFilterHasEmail(false);
    setFilterHasTelefono(false);
  };

  const handleCreate = async () => {
    if (!nome.trim()) { toast.error("Inserisci un nome"); return; }
    setSaving(true);
    try {
      const filtri: Record<string, unknown> = {};
      if (tipo === "dinamica") {
        if (filterStato) filtri.stato = [filterStato];
        if (filterFonte) filtri.fonte = [filterFonte];
        if (filterCitta.trim()) filtri.citta = filterCitta.split(",").map(c => c.trim()).filter(Boolean);
        if (filterHasEmail) filtri.hasEmail = true;
        if (filterHasTelefono) filtri.hasTelefono = true;
      }

      // Count matching contacts for dynamic lists
      let totale = 0;
      if (tipo === "dinamica") {
        let q = supabase.from("contacts").select("id", { count: "exact", head: true });
        if (filtri.stato) q = q.in("stato", filtri.stato as string[]);
        if (filtri.fonte) q = q.in("fonte", filtri.fonte as string[]);
        if (filtri.citta) q = q.in("citta", filtri.citta as string[]);
        if (filtri.hasEmail) q = q.not("email", "is", null);
        if (filtri.hasTelefono) q = q.not("telefono", "is", null);
        const { count } = await q;
        totale = count || 0;
      }

      const { error } = await supabase.from("lists").insert([{
        nome: nome.trim(),
        descrizione: descrizione.trim() || null,
        tipo,
        filtri: filtri as unknown as Record<string, never>,
        totale_contatti: totale,
      }]);
      if (error) throw error;
      toast.success("Lista creata");
      reset();
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Errore creazione lista");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">NUOVA LISTA</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="font-mono text-xs text-muted-foreground">NOME</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Es. Ristoranti Milano" />
          </div>
          <div>
            <Label className="font-mono text-xs text-muted-foreground">DESCRIZIONE</Label>
            <Textarea value={descrizione} onChange={e => setDescrizione(e.target.value)} rows={2} placeholder="Descrizione opzionale..." />
          </div>

          <div>
            <Label className="font-mono text-xs text-muted-foreground mb-2 block">TIPO</Label>
            <Tabs value={tipo} onValueChange={v => setTipo(v as ListTipo)}>
              <TabsList className="w-full">
                <TabsTrigger value="statica" className="flex-1 font-mono text-xs">STATICA</TabsTrigger>
                <TabsTrigger value="dinamica" className="flex-1 font-mono text-xs">DINAMICA</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {tipo === "statica" ? "Aggiungi contatti manualmente" : "I contatti vengono filtrati automaticamente"}
            </p>
          </div>

          {tipo === "dinamica" && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-mono text-xs text-primary font-bold">FILTRI DINAMICI</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-mono text-[10px] text-muted-foreground">STATO</Label>
                  <Select value={filterStato} onValueChange={setFilterStato}>
                    <SelectTrigger><SelectValue placeholder="Tutti" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tutti</SelectItem>
                      {STATI.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-mono text-[10px] text-muted-foreground">FONTE</Label>
                  <Select value={filterFonte} onValueChange={setFilterFonte}>
                    <SelectTrigger><SelectValue placeholder="Tutte" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tutte</SelectItem>
                      {FONTI.map(f => <SelectItem key={f} value={f}>{f.replace(/_/g, " ")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="font-mono text-[10px] text-muted-foreground">CITTÀ (separate da virgola)</Label>
                <Input value={filterCitta} onChange={e => setFilterCitta(e.target.value)} placeholder="Milano, Roma, Napoli" />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                  <input type="checkbox" checked={filterHasEmail} onChange={e => setFilterHasEmail(e.target.checked)} className="accent-primary" />
                  Con email
                </label>
                <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                  <input type="checkbox" checked={filterHasTelefono} onChange={e => setFilterHasTelefono(e.target.checked)} className="accent-primary" />
                  Con telefono
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creazione..." : "CREA LISTA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
