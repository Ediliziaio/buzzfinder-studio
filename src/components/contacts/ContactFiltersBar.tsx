import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Save } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ContactFilters, ContactStato, ContactFonte } from "@/types";

interface Props {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
}

const statiOptions: ContactStato[] = ["nuovo", "da_contattare", "contattato", "risposto", "non_interessato", "cliente"];
const fonteOptions: ContactFonte[] = ["google_maps", "csv_import", "manuale", "web_scrape"];

export function ContactFiltersBar({ filters, onChange }: Props) {
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [listName, setListName] = useState("");
  const [savingList, setSavingList] = useState(false);

  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ""
  );

  const handleSaveAsList = async () => {
    if (!listName.trim()) return;
    setSavingList(true);
    try {
      const { error } = await supabase.from("lists").insert({
        nome: listName.trim(),
        tipo: "dinamica",
        filtri: filters as any,
        descrizione: `Lista dinamica da filtri`,
      });
      if (error) throw error;
      toast.success(`Lista "${listName}" creata`);
      setShowSaveDialog(false);
      setListName("");
    } catch (err: any) {
      toast.error(err.message || "Errore creazione lista");
    } finally {
      setSavingList(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca nome, azienda, email, tel..."
            value={filters.search || ""}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="pl-9 h-8 font-mono text-xs bg-accent border-border"
          />
        </div>

        {/* Stato */}
        <Select
          value={filters.stato?.[0] || "all"}
          onValueChange={(v) => onChange({ ...filters, stato: v === "all" ? undefined : [v as ContactStato] })}
        >
          <SelectTrigger className="w-[140px] h-8 text-xs font-mono bg-accent border-border">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {statiOptions.map((s) => (
              <SelectItem key={s} value={s} className="font-mono text-xs">{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Fonte */}
        <Select
          value={filters.fonte?.[0] || "all"}
          onValueChange={(v) => onChange({ ...filters, fonte: v === "all" ? undefined : [v as ContactFonte] })}
        >
          <SelectTrigger className="w-[130px] h-8 text-xs font-mono bg-accent border-border">
            <SelectValue placeholder="Fonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le fonti</SelectItem>
            {fonteOptions.map((f) => (
              <SelectItem key={f} value={f} className="font-mono text-xs">{f.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Has email */}
        <Select
          value={filters.hasEmail === undefined ? "all" : filters.hasEmail ? "yes" : "no"}
          onValueChange={(v) => onChange({ ...filters, hasEmail: v === "all" ? undefined : v === "yes" })}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs font-mono bg-accent border-border">
            <SelectValue placeholder="Ha email" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Email: tutti</SelectItem>
            <SelectItem value="yes">Con email</SelectItem>
            <SelectItem value="no">Senza email</SelectItem>
          </SelectContent>
        </Select>

        {/* Has telefono */}
        <Select
          value={filters.hasTelefono === undefined ? "all" : filters.hasTelefono ? "yes" : "no"}
          onValueChange={(v) => onChange({ ...filters, hasTelefono: v === "all" ? undefined : v === "yes" })}
        >
          <SelectTrigger className="w-[120px] h-8 text-xs font-mono bg-accent border-border">
            <SelectValue placeholder="Ha tel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tel: tutti</SelectItem>
            <SelectItem value="yes">Con telefono</SelectItem>
            <SelectItem value="no">Senza telefono</SelectItem>
          </SelectContent>
        </Select>

        {/* Save as list */}
        {hasActiveFilters && (
          <Button variant="outline" size="sm" className="h-8 text-xs font-mono" onClick={() => setShowSaveDialog(true)}>
            <Save className="h-3 w-3 mr-1" /> SALVA COME LISTA
          </Button>
        )}

        {/* Reset */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-8 text-xs font-mono text-muted-foreground" onClick={() => onChange({})}>
            <X className="h-3 w-3 mr-1" /> RESET
          </Button>
        )}
      </div>

      {/* Save as list dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-mono">Salva filtri come lista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-mono text-xs">Nome lista</Label>
              <Input
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="es. Contatti Milano con email"
                className="font-mono text-sm mt-1"
              />
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              Verrà creata una lista dinamica che si aggiorna automaticamente in base ai filtri attivi.
            </p>
            <Button onClick={handleSaveAsList} disabled={savingList || !listName.trim()} className="w-full font-mono text-xs">
              {savingList ? "Salvataggio..." : "Crea lista dinamica"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
