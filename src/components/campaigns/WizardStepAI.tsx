import { Sparkles, Cpu, Info, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { WizardData } from "./CampaignWizard";

interface Props {
  data: WizardData;
  update: (partial: Partial<WizardData>) => void;
}

const MODELS = [
  { value: "haiku", label: "Claude Haiku", desc: "Veloce, economico", costPer1k: 0.30 },
  { value: "sonnet", label: "Claude Sonnet", desc: "Alta qualità", costPer1k: 1.50 },
];

const CONTACT_FIELDS = ["nome", "azienda", "citta", "email", "telefono", "sito_web", "google_categories"];

export function WizardStepAI({ data, update }: Props) {
  const model = MODELS.find((m) => m.value === data.aiModel) || MODELS[0];
  const aiCostEstimate = data.recipientCount > 0
    ? ((data.recipientCount / 1000) * model.costPer1k).toFixed(2)
    : "0.00";

  return (
    <div className="space-y-5">
      {/* Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <div className="font-mono text-sm font-bold text-foreground">Personalizzazione AI</div>
            <p className="font-mono text-[10px] text-muted-foreground">
              Genera messaggi unici per ogni destinatario con Claude AI
            </p>
          </div>
        </div>
        <Switch
          checked={data.aiEnabled}
          onCheckedChange={(v) => update({ aiEnabled: v })}
        />
      </div>

      {data.aiEnabled && (
        <>
          {/* Model selection */}
          <div className="space-y-2">
            <Label className="terminal-header">Modello AI</Label>
            <div className="grid grid-cols-2 gap-3">
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => update({ aiModel: m.value })}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all",
                    data.aiModel === m.value
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Cpu className={cn("h-4 w-4", data.aiModel === m.value ? "text-primary" : "text-muted-foreground")} />
                    <span className="font-mono text-sm font-semibold">{m.label}</span>
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground mt-1">{m.desc}</p>
                  <p className="font-mono text-[10px] text-primary mt-1">~€{m.costPer1k.toFixed(2)}/1000 msg</p>
                </button>
              ))}
            </div>
          </div>

          {/* Context */}
          <div className="space-y-2">
            <Label className="terminal-header">Contesto (chi sei)</Label>
            <Textarea
              value={data.aiContext}
              onChange={(e) => update({ aiContext: e.target.value.slice(0, 300) })}
              placeholder="Es: Siamo un'agenzia di marketing B2B specializzata in lead generation per PMI italiane..."
              className="font-mono text-xs min-h-[80px]"
              maxLength={300}
            />
            <p className="font-mono text-[10px] text-muted-foreground text-right">{data.aiContext.length}/300</p>
          </div>

          {/* Objective */}
          <div className="space-y-2">
            <Label className="terminal-header">Obiettivo del messaggio</Label>
            <Textarea
              value={data.aiObjective}
              onChange={(e) => update({ aiObjective: e.target.value.slice(0, 200) })}
              placeholder="Es: Fissare una call conoscitiva per presentare i nostri servizi di lead generation..."
              className="font-mono text-xs min-h-[60px]"
              maxLength={200}
            />
            <p className="font-mono text-[10px] text-muted-foreground text-right">{data.aiObjective.length}/200</p>
          </div>

          {/* Contact data tags */}
          <div className="rounded-lg border border-border bg-accent p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-[10px] text-muted-foreground uppercase">Dati contatto utilizzati dall'AI</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CONTACT_FIELDS.map((f) => (
                <span key={f} className="font-mono text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Cost estimate */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="terminal-header text-primary">STIMA COSTO AI</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">
                {data.recipientCount.toLocaleString()} destinatari × {model.label}
              </span>
              <span className="font-mono text-lg font-bold text-primary">~€{aiCostEstimate}</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              La personalizzazione viene eseguita dopo la creazione della campagna, dalla pagina di dettaglio.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
