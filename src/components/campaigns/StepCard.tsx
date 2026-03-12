import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { EmailEditor } from "./EmailEditor";
import type { SequenceStep } from "@/types";

interface Props {
  step: SequenceStep;
  stepIndex: number;
  onEdit: (updated: SequenceStep) => void;
  onDelete: () => void;
}

export function StepCard({ step, stepIndex, onEdit, onDelete }: Props) {
  const [isExpanded, setIsExpanded] = useState(stepIndex === 1);

  const canaleIcon = step.tipo === "email" ? "📧" : step.tipo === "whatsapp" ? "💬" : step.tipo === "chiamata" ? "📞" : "📱";
  const invioLabel =
    step.delay_giorni === 0 && step.delay_ore === 0
      ? "Immediato"
      : `+${step.delay_giorni}g ${step.delay_ore > 0 ? `${step.delay_ore}h` : ""}`;

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
            {stepIndex}
          </div>
          <div>
            <p className="font-mono text-sm font-semibold">
              {canaleIcon} {step.soggetto?.substring(0, 40) || `Step ${stepIndex}`}
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              {invioLabel} • {step.tipo}
              {step.ab_nome && <Badge className="ml-2 text-xs">A/B</Badge>}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border space-y-4">
          {/* Channel */}
          <div>
            <Label className="font-mono text-xs">CANALE</Label>
            <div className="flex gap-2 mt-1">
              {(["email", "whatsapp", "sms"] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={step.tipo === t ? "default" : "outline"}
                  className="text-xs"
                  onClick={() => onEdit({ ...step, tipo: t })}
                >
                  {t === "email" ? "📧 Email" : t === "whatsapp" ? "💬 WhatsApp" : "📱 SMS"}
                </Button>
              ))}
            </div>
          </div>

          {/* Email content */}
          {step.tipo === "email" && (
            <>
              <div>
                <Label className="font-mono text-xs">OGGETTO</Label>
                <Input
                  value={step.soggetto || ""}
                  onChange={(e) => onEdit({ ...step, soggetto: e.target.value })}
                  placeholder="{Ciao|Salve} {{nome}}, ti scrivo da..."
                  className="font-mono text-sm mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  💡 Usa {"{A|B|C}"} per spintax, {"{{nome}}"} per variabili
                </p>
              </div>
              <div>
                <Label className="font-mono text-xs">CORPO EMAIL</Label>
                <EmailEditor
                  value={step.corpo_html || ""}
                  onChange={(html) => onEdit({ ...step, corpo_html: html })}
                />
              </div>
            </>
          )}

          {/* WhatsApp/SMS content */}
          {(step.tipo === "whatsapp" || step.tipo === "sms") && (
            <div>
              <Label className="font-mono text-xs">MESSAGGIO</Label>
              <Textarea
                value={step.messaggio || ""}
                onChange={(e) => onEdit({ ...step, messaggio: e.target.value })}
                rows={4}
                placeholder="Ciao {{nome}}, ti scrivo da {{azienda}}..."
                className="font-mono text-sm mt-1"
              />
              {step.tipo === "sms" && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(step.messaggio || "").length}/160 caratteri
                </p>
              )}
            </div>
          )}

          {/* A/B Testing */}
          <div className="border border-border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="font-mono text-xs">A/B TEST</Label>
              <Switch
                checked={!!step.ab_nome}
                onCheckedChange={(checked) =>
                  onEdit({ ...step, ab_nome: checked ? "A" : undefined })
                }
              />
            </div>
            {step.ab_nome && (
              <p className="text-xs text-muted-foreground mt-2">
                Questa è la variante A. Dopo il salvataggio potrai aggiungere la variante B.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
