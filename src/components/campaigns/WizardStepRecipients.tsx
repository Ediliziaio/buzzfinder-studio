import { useState, useEffect } from "react";
import { Users, ListFilter, Database } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useLists } from "@/hooks/useLists";
import type { WizardData } from "./CampaignWizard";

const STATI = [
  { value: "nuovo", label: "Nuovo" },
  { value: "da_contattare", label: "Da contattare" },
  { value: "contattato", label: "Contattato" },
  { value: "risposto", label: "Risposto" },
  { value: "cliente", label: "Cliente" },
];

const SOURCES = [
  { value: "all" as const, label: "Tutti i contatti", icon: Database, desc: "Invia a tutti i contatti nel database" },
  { value: "list" as const, label: "Da una lista", icon: ListFilter, desc: "Seleziona una lista salvata" },
  { value: "filter" as const, label: "Con filtri", icon: Users, desc: "Filtra per stato, email, telefono" },
];

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
}

export function WizardStepRecipients({ data, update }: Props) {
  const { lists } = useLists();
  const [counting, setCounting] = useState(false);

  // Count recipients based on selection
  useEffect(() => {
    const countRecipients = async () => {
      setCounting(true);
      try {
        let query = supabase.from("contacts").select("id", { count: "exact", head: true });

        if (data.recipientSource === "filter") {
          if (data.filterStato.length > 0) {
            query = query.in("stato", data.filterStato);
          }
          if (data.tipo === "email" || data.filterHasEmail) {
            query = query.not("email", "is", null);
          }
          if (data.tipo === "sms" || data.tipo === "whatsapp" || data.filterHasTelefono) {
            query = query.not("telefono", "is", null);
          }
        } else if (data.recipientSource === "all") {
          // For email, only count those with email; for sms/whatsapp, those with phone
          if (data.tipo === "email") {
            query = query.not("email", "is", null);
          } else {
            query = query.not("telefono", "is", null);
          }
        } else if (data.recipientSource === "list" && data.selectedListId) {
          const { count } = await supabase
            .from("list_contacts")
            .select("contact_id", { count: "exact", head: true })
            .eq("list_id", data.selectedListId);
          update({ recipientCount: count || 0 });
          setCounting(false);
          return;
        }

        const { count } = await query;
        update({ recipientCount: count || 0 });
      } catch {
        update({ recipientCount: 0 });
      } finally {
        setCounting(false);
      }
    };

    countRecipients();
  }, [data.recipientSource, data.selectedListId, data.filterStato, data.filterHasEmail, data.filterHasTelefono, data.tipo]);

  const toggleStato = (stato: string) => {
    const current = data.filterStato;
    update({
      filterStato: current.includes(stato) ? current.filter((s) => s !== stato) : [...current, stato],
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <Label className="terminal-header mb-3 block">Sorgente destinatari</Label>
        <div className="grid grid-cols-3 gap-3">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              onClick={() => update({ recipientSource: s.value, selectedListId: "", filterStato: [] })}
              className={cn(
                "rounded-lg border p-3 text-left transition-all",
                data.recipientSource === s.value
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              )}
            >
              <s.icon className={cn("h-5 w-5 mb-1.5", data.recipientSource === s.value ? "text-primary" : "text-muted-foreground")} />
              <div className="font-mono text-xs font-semibold">{s.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {data.recipientSource === "list" && (
        <div>
          <Label className="terminal-header mb-1.5 block">Seleziona lista</Label>
          <Select value={data.selectedListId} onValueChange={(v) => update({ selectedListId: v })}>
            <SelectTrigger className="font-mono text-sm">
              <SelectValue placeholder="Scegli una lista..." />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id} className="font-mono text-sm">
                  {l.nome} ({l.totale_contatti} contatti)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {data.recipientSource === "filter" && (
        <div className="space-y-4">
          <div>
            <Label className="terminal-header mb-2 block">Filtra per stato</Label>
            <div className="flex flex-wrap gap-2">
              {STATI.map((s) => (
                <button
                  key={s.value}
                  onClick={() => toggleStato(s.value)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 font-mono text-xs transition-all",
                    data.filterStato.includes(s.value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={data.filterHasEmail}
                onCheckedChange={(v) => update({ filterHasEmail: !!v })}
              />
              <span className="font-mono text-xs">Solo con email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={data.filterHasTelefono}
                onCheckedChange={(v) => update({ filterHasTelefono: !!v })}
              />
              <span className="font-mono text-xs">Solo con telefono</span>
            </label>
          </div>
        </div>
      )}

      {/* Recipient count */}
      <div className="rounded-lg border border-border bg-muted/50 p-4">
        <div className="flex items-center justify-between">
          <span className="terminal-header">Destinatari selezionati</span>
          <span className={cn("font-mono text-2xl font-bold", data.recipientCount > 0 ? "text-primary" : "text-muted-foreground")}>
            {counting ? "..." : data.recipientCount.toLocaleString()}
          </span>
        </div>
        {data.recipientCount === 0 && !counting && (
          <p className="text-[10px] text-destructive font-mono mt-1">Nessun destinatario trovato con i filtri selezionati</p>
        )}
      </div>
    </div>
  );
}
