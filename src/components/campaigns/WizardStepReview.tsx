import { Mail, Phone, MessageSquare, Clock, Users, Euro, Zap, AlertTriangle, Info, CalendarIcon, Sparkles, Cpu } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { calculateCost, type CostBreakdown } from "@/lib/costCalculator";
import type { WizardData } from "./CampaignWizard";

interface Props {
  data: WizardData;
  costStimato: number;
  canale: { value: string; label: string; costPer: number; icon: React.ComponentType<any> };
}

export function WizardStepReview({ data, costStimato, canale }: Props) {
  const etaMinutes = Math.ceil((data.recipientCount / data.sending_rate_per_hour) * 60);
  const etaLabel = etaMinutes < 60 ? `${etaMinutes} min` : `${(etaMinutes / 60).toFixed(1)} ore`;

  const messageLength = data.tipo === "sms" ? data.body_text.length : 0;
  const costBreakdown = calculateCost(data.tipo, data.recipientCount, messageLength);

  const summaryRows = [
    { icon: canale.icon, label: "Canale", value: `${canale.label} via ${costBreakdown.provider}` },
    { icon: Users, label: "Destinatari", value: data.recipientCount.toLocaleString() },
    { icon: Zap, label: "Velocità", value: `${data.sending_rate_per_hour}/ora` },
    { icon: Clock, label: "Tempo stimato", value: etaLabel },
    ...(data.scheduled_at
      ? [{ icon: CalendarIcon, label: "Programmata per", value: format(data.scheduled_at, "dd MMM yyyy 'alle' HH:mm", { locale: it }) }]
      : []),
  ];

  return (
    <div className="space-y-5">
      {/* Campaign summary */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-mono text-sm font-bold mb-3">{data.nome}</h3>
        {data.tipo === "email" && data.subject && (
          <div className="mb-3">
            <span className="terminal-header">Oggetto:</span>
            <p className="font-mono text-sm mt-0.5">{data.subject}</p>
          </div>
        )}
        {data.tipo === "sms" && data.body_text && (
          <div className="mb-3">
            <span className="terminal-header">Messaggio:</span>
            <p className="font-mono text-xs mt-0.5 text-muted-foreground">{data.body_text}</p>
            <p className="font-mono text-[10px] mt-1 text-muted-foreground">{data.body_text.length}/160 caratteri {data.body_text.length > 160 ? "⚠️ 2 SMS" : "✅"}</p>
          </div>
        )}
        {data.tipo === "whatsapp" && (
          <div className="mb-3">
            <span className="terminal-header">Template:</span>
            <p className="font-mono text-sm mt-0.5">{data.template_whatsapp_id}</p>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 divide-y divide-border">
        {summaryRows.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <r.icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground">{r.label}</span>
            </div>
            <span className="font-mono text-sm font-bold text-foreground">{r.value}</span>
          </div>
        ))}
      </div>

      {/* Detailed cost breakdown */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-primary" />
          <span className="terminal-header text-primary">STIMA COSTI {data.tipo.toUpperCase()}</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">Provider</span>
            <span className="font-mono text-sm font-bold">{costBreakdown.provider}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">Destinatari</span>
            <span className="font-mono text-sm">{data.recipientCount.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-muted-foreground">Costo unitario</span>
            <span className="font-mono text-sm">€{costBreakdown.unitCost.toFixed(4)}</span>
          </div>
        </div>

        {/* Tier breakdown for email */}
        {costBreakdown.tiers && (
          <div className="border-t border-border pt-3 space-y-2">
            {costBreakdown.tiers.map((tier, i) => (
              <div key={i} className={cn(
                "flex items-center justify-between rounded-md px-3 py-2 text-xs font-mono",
                i === 0 && data.tipo === "sms" ? "bg-primary/10 border border-primary/30" : "bg-muted/50"
              )}>
                <div>
                  <span className="text-foreground">{tier.name}</span>
                  <span className="text-muted-foreground ml-2">— {tier.note}</span>
                </div>
                <span className={cn("font-bold", tier.cost === 0 ? "text-primary" : "text-foreground")}>
                  €{tier.cost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Total */}
        <div className="border-t border-border pt-3 flex items-center justify-between">
          <span className="font-mono text-sm font-bold text-foreground">TOTALE STIMATO</span>
          <span className="font-mono text-xl font-bold text-primary">€{costBreakdown.totalCost.toFixed(2)}</span>
        </div>

        {/* Recommendation */}
        {costBreakdown.recommendation && (
          <div className="flex items-start gap-2 rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
            <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
            <span className="font-mono text-[10px] text-primary leading-relaxed">{costBreakdown.recommendation}</span>
          </div>
        )}
      </div>

      {/* Warnings */}
      {costBreakdown.warnings.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1.5">
          {costBreakdown.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
              <span className="font-mono text-[10px] text-warning leading-relaxed">{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* AI Personalization summary */}
      {data.aiEnabled && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="terminal-header text-primary">PERSONALIZZAZIONE AI</span>
          </div>
          <div className="space-y-1 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Modello</span>
              <span className="text-foreground font-bold">{data.aiModel === "sonnet" ? "Claude Sonnet" : "Claude Haiku"}</span>
            </div>
            {data.aiContext && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Contesto</span>
                <span className="text-foreground truncate max-w-[250px]">{data.aiContext}</span>
              </div>
            )}
            {data.aiObjective && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Obiettivo</span>
                <span className="text-foreground truncate max-w-[250px]">{data.aiObjective}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1 mt-1">
              <span className="text-muted-foreground">Costo AI stimato</span>
              <span className="text-primary font-bold">
                ~€{((data.recipientCount / 1000) * (data.aiModel === "sonnet" ? 1.5 : 0.3)).toFixed(2)}
              </span>
            </div>
          </div>
          <p className="font-mono text-[10px] text-muted-foreground">
            ⚡ La generazione avverrà dalla pagina dettaglio campagna, prima del lancio.
          </p>
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
          {data.scheduled_at
            ? `📅 La campagna verrà salvata come **schedulata** e inviata automaticamente il ${format(data.scheduled_at, "dd MMM yyyy", { locale: it })}.`
            : "⚠️ La campagna verrà salvata come **bozza**. Potrai avviarla dalla pagina di dettaglio campagna."
          }
        </p>
      </div>
    </div>
  );
}
