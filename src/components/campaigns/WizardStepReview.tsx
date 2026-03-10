import { Mail, Phone, MessageSquare, Clock, Users, Euro, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WizardData, } from "./CampaignWizard";

interface Props {
  data: WizardData;
  costStimato: number;
  canale: { value: string; label: string; costPer: number; icon: React.ComponentType<any> };
}

export function WizardStepReview({ data, costStimato, canale }: Props) {
  const etaMinutes = Math.ceil((data.recipientCount / data.sending_rate_per_hour) * 60);
  const etaLabel = etaMinutes < 60 ? `${etaMinutes} min` : `${(etaMinutes / 60).toFixed(1)} ore`;

  const rows = [
    { icon: canale.icon, label: "Canale", value: canale.label },
    { icon: Users, label: "Destinatari", value: data.recipientCount.toLocaleString() },
    { icon: Zap, label: "Velocità", value: `${data.sending_rate_per_hour}/ora` },
    { icon: Clock, label: "Tempo stimato", value: etaLabel },
    { icon: Euro, label: "Costo stimato", value: `€${costStimato.toFixed(2)}`, highlight: true },
  ];

  return (
    <div className="space-y-5">
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
          </div>
        )}
        {data.tipo === "whatsapp" && (
          <div className="mb-3">
            <span className="terminal-header">Template:</span>
            <p className="font-mono text-sm mt-0.5">{data.template_whatsapp_id}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-primary/30 bg-primary/5 divide-y divide-border">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <r.icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-mono text-xs text-muted-foreground">{r.label}</span>
            </div>
            <span className={cn("font-mono text-sm font-bold", r.highlight ? "text-primary" : "text-foreground")}>
              {r.value}
            </span>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
          ⚠️ La campagna verrà salvata come <strong>bozza</strong>. Potrai avviarla dalla lista campagne.
          Il costo è una stima basata su €{canale.costPer}/messaggio e potrebbe variare in base al provider configurato.
        </p>
      </div>
    </div>
  );
}
