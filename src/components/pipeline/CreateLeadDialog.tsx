import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCampaigns } from "@/hooks/useCampaigns";

const STAGES = [
  { id: "interessato", label: "Interessati 🔥" },
  { id: "richiesta_info", label: "Richiedono info 📋" },
  { id: "meeting_fissato", label: "Meeting 📅" },
  { id: "proposta_inviata", label: "Proposta inviata 📄" },
  { id: "vinto", label: "Vinti ✅" },
  { id: "perso", label: "Persi ❌" },
];

type ContactResult = { id: string; nome: string | null; cognome: string | null; azienda: string; email: string | null };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (input: { contact_id: string; campaign_id?: string; stage?: string; valore_stimato?: number }) => void;
}

export function CreateLeadDialog({ open, onOpenChange, onAdd }: Props) {
  const { campaigns } = useCampaigns();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<ContactResult[]>([]);
  const [selected, setSelected] = useState<ContactResult | null>(null);
  const [campaignId, setCampaignId] = useState("none");
  const [stage, setStage] = useState("interessato");
  const [valore, setValore] = useState("0");
  const [searching, setSearching] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("contacts")
      .select("id, nome, cognome, azienda, email")
      .or(`azienda.ilike.%${q}%,nome.ilike.%${q}%,cognome.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    setResults((data as ContactResult[]) || []);
    setSearching(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => doSearch(search), 300);
    return () => clearTimeout(t);
  }, [search, doSearch, open]);

  const reset = () => {
    setSearch(""); setResults([]); setSelected(null);
    setCampaignId("none"); setStage("interessato"); setValore("0");
  };

  const handleSubmit = () => {
    if (!selected) return;
    onAdd({
      contact_id: selected.id,
      campaign_id: campaignId !== "none" ? campaignId : undefined,
      stage,
      valore_stimato: parseFloat(valore) || 0,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Nuovo Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contact search */}
          <div className="space-y-1">
            <label className="font-mono text-[10px] text-muted-foreground uppercase">Contatto *</label>
            {selected ? (
              <div className="flex items-center justify-between rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
                <span>{selected.nome || ""} {selected.cognome || ""} — {selected.azienda}</span>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelected(null)}>Cambia</Button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Cerca contatto..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 text-sm font-mono"
                  autoFocus
                />
                {(results.length > 0 || searching) && (
                  <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
                    {searching && <div className="px-3 py-2 text-xs text-muted-foreground">Ricerca...</div>}
                    {results.map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => { setSelected(c); setResults([]); setSearch(""); }}
                      >
                        <span className="font-medium">{c.nome || ""} {c.cognome || ""}</span>
                        <span className="text-muted-foreground"> — {c.azienda}</span>
                        {c.email && <span className="text-muted-foreground text-xs ml-2">{c.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Campaign */}
          <div className="space-y-1">
            <label className="font-mono text-[10px] text-muted-foreground uppercase">Campagna</label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger className="h-9 text-sm font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna</SelectItem>
                {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Stage */}
          <div className="space-y-1">
            <label className="font-mono text-[10px] text-muted-foreground uppercase">Stage</label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-9 text-sm font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="space-y-1">
            <label className="font-mono text-[10px] text-muted-foreground uppercase">Valore stimato €</label>
            <Input type="number" value={valore} onChange={(e) => setValore(e.target.value)} className="h-9 text-sm font-mono" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button disabled={!selected} onClick={handleSubmit}>Aggiungi Lead</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
