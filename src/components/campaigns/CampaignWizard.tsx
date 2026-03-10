import { useState, useEffect } from "react";
import { Mail, MessageSquare, Phone, ChevronRight, ChevronLeft, Rocket, Users, FileText, Eye, CalendarIcon, Clock } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmailPreviewDialog } from "./EmailPreviewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EmailEditor } from "./EmailEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { WizardStepRecipients } from "./WizardStepRecipients";
import { WizardStepReview } from "./WizardStepReview";
import type { CampaignTipo } from "@/types";

const STEPS = [
  { id: "tipo", label: "Canale", icon: Mail },
  { id: "destinatari", label: "Destinatari", icon: Users },
  { id: "contenuto", label: "Contenuto", icon: FileText },
  { id: "riepilogo", label: "Riepilogo", icon: Eye },
] as const;

const CANALI = [
  { value: "email" as CampaignTipo, label: "Email", icon: Mail, desc: "Invia email personalizzate", costPer: 0.001 },
  { value: "sms" as CampaignTipo, label: "SMS", icon: Phone, desc: "Messaggi brevi via SMS", costPer: 0.05 },
  { value: "whatsapp" as CampaignTipo, label: "WhatsApp", icon: MessageSquare, desc: "Template WhatsApp Business", costPer: 0.04 },
];

export interface WizardData {
  tipo: CampaignTipo;
  nome: string;
  subject: string;
  body_html: string;
  body_text: string;
  sender_email: string;
  sender_name: string;
  reply_to: string;
  template_whatsapp_id: string;
  recipientSource: "all" | "list" | "filter";
  selectedListId: string;
  filterStato: string[];
  filterHasEmail: boolean;
  filterHasTelefono: boolean;
  sending_rate_per_hour: number;
  recipientCount: number;
  scheduled_at: Date | null;
  scheduleTime: string;
}

const defaultData: WizardData = {
  tipo: "email",
  nome: "",
  subject: "",
  body_html: "",
  body_text: "",
  sender_email: "",
  sender_name: "",
  reply_to: "",
  template_whatsapp_id: "",
  recipientSource: "all",
  selectedListId: "",
  filterStato: [],
  filterHasEmail: false,
  filterHasTelefono: false,
  sending_rate_per_hour: 500,
  recipientCount: 0,
  scheduled_at: null,
  scheduleTime: "09:00",
};

interface CampaignWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CampaignWizard({ open, onOpenChange, onCreated }: CampaignWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...defaultData });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setData({ ...defaultData });
    }
  }, [open]);

  const update = (partial: Partial<WizardData>) => setData((d) => ({ ...d, ...partial }));

  const canale = CANALI.find((c) => c.value === data.tipo)!;
  const costStimato = data.recipientCount * canale.costPer;

  const canNext = () => {
    if (step === 0) return !!data.tipo && data.nome.trim().length > 0;
    if (step === 1) return data.recipientCount > 0;
    if (step === 2) {
      if (data.tipo === "email") return data.subject.trim().length > 0 && data.body_html.trim().length > 0;
      if (data.tipo === "sms") return data.body_text.trim().length > 0;
      if (data.tipo === "whatsapp") return data.template_whatsapp_id.trim().length > 0;
    }
    return true;
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      // Compute scheduled_at by combining date + time
      let scheduledAt: string | null = null;
      if (data.scheduled_at) {
        const d = new Date(data.scheduled_at);
        const [h, m] = data.scheduleTime.split(":").map(Number);
        d.setHours(h, m, 0, 0);
        scheduledAt = d.toISOString();
      }

      const { error } = await supabase.from("campaigns").insert({
        nome: data.nome.trim(),
        tipo: data.tipo,
        stato: scheduledAt ? "schedulata" : "bozza",
        subject: data.subject || null,
        body_html: data.body_html || null,
        body_text: data.body_text || null,
        template_whatsapp_id: data.template_whatsapp_id || null,
        sender_email: data.sender_email || null,
        sender_name: data.sender_name || null,
        reply_to: data.reply_to || null,
        totale_destinatari: data.recipientCount,
        sending_rate_per_hour: data.sending_rate_per_hour,
        costo_stimato_eur: costStimato,
        scheduled_at: scheduledAt,
      });
      if (error) throw error;
      toast({
        title: scheduledAt ? "Campagna schedulata" : "Campagna creata",
        description: scheduledAt
          ? `"${data.nome}" programmata per ${format(new Date(scheduledAt), "dd MMM yyyy 'alle' HH:mm", { locale: it })}`
          : `"${data.nome}" salvata come bozza`,
      });
      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono text-lg">NUOVA CAMPAGNA</DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => i < step && setStep(i)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-xs font-mono transition-all w-full",
                  i === step ? "bg-primary text-primary-foreground" :
                  i < step ? "bg-accent text-foreground cursor-pointer" :
                  "bg-muted text-muted-foreground"
                )}
              >
                <s.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            </div>
          ))}
        </div>

        {/* Step 0: Tipo */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <Label className="terminal-header mb-2 block">Nome campagna</Label>
              <Input
                placeholder="es. Newsletter Q1 2026"
                value={data.nome}
                onChange={(e) => update({ nome: e.target.value })}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="terminal-header mb-3 block">Canale di invio</Label>
              <div className="grid grid-cols-3 gap-3">
                {CANALI.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => update({ tipo: c.value })}
                    className={cn(
                      "rounded-lg border p-4 text-left transition-all",
                      data.tipo === c.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <c.icon className={cn("h-6 w-6 mb-2", data.tipo === c.value ? "text-primary" : "text-muted-foreground")} />
                    <div className="font-mono text-sm font-semibold">{c.label}</div>
                    <div className="text-xs text-muted-foreground mt-1">{c.desc}</div>
                    <div className="font-mono text-[10px] text-primary mt-2">€{c.costPer}/msg</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Destinatari */}
        {step === 1 && (
          <WizardStepRecipients data={data} update={update} />
        )}

        {/* Step 2: Contenuto */}
        {step === 2 && (
          <div className="space-y-4">
            {data.tipo === "email" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="terminal-header mb-1.5 block">Mittente nome</Label>
                    <Input value={data.sender_name} onChange={(e) => update({ sender_name: e.target.value })} placeholder="LeadHunter Pro" className="font-mono text-sm" />
                  </div>
                  <div>
                    <Label className="terminal-header mb-1.5 block">Mittente email</Label>
                    <Input value={data.sender_email} onChange={(e) => update({ sender_email: e.target.value })} placeholder="noreply@tuodominio.it" className="font-mono text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="terminal-header mb-1.5 block">Reply-to</Label>
                  <Input value={data.reply_to} onChange={(e) => update({ reply_to: e.target.value })} placeholder="info@tuodominio.it" className="font-mono text-sm" />
                </div>
                <div>
                  <Label className="terminal-header mb-1.5 block">Oggetto *</Label>
                  <Input value={data.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="Scopri i nostri servizi" className="font-mono text-sm" />
                  <p className="text-[10px] text-muted-foreground mt-1 font-mono">Variabili: {"{{nome}}"}, {"{{azienda}}"}, {"{{citta}}"}</p>
                </div>
                <div>
                  <Label className="terminal-header mb-1.5 block">Corpo email *</Label>
                  <EmailEditor
                    value={data.body_html}
                    onChange={(html) => update({ body_html: html })}
                  />
                  <div className="flex gap-2 mt-2">
                    <Button type="button" variant="outline" size="sm" className="font-mono text-xs" onClick={() => setShowPreview(true)}>
                      <Eye className="h-3 w-3 mr-1" /> Preview Email
                    </Button>
                  </div>
                </div>
              </>
            )}
            {data.tipo === "sms" && (
              <div>
                <Label className="terminal-header mb-1.5 block">Testo SMS *</Label>
                <Textarea
                  value={data.body_text}
                  onChange={(e) => update({ body_text: e.target.value })}
                  placeholder="Ciao {{nome}}, scopri le nostre offerte..."
                  className="font-mono text-sm min-h-[120px]"
                />
                {(() => {
                  const len = data.body_text.length;
                  const smsCount = len === 0 ? 0 : Math.ceil(len / 160);
                  const isOver = len > 160;
                  return (
                    <div className="flex items-center justify-between mt-1">
                      <p className={cn("text-[10px] font-mono", isOver ? "text-warning" : "text-muted-foreground")}>
                        {len}/160 caratteri {isOver && `— ${smsCount} SMS`}
                      </p>
                      {isOver && (
                        <span className="text-[10px] font-mono text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                          ⚠️ {smsCount} SMS a {len} char — costo ×{smsCount}
                        </span>
                      )}
                    </div>
                  );
                })()}
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                  Variabili: {"{{nome}}"}, {"{{azienda}}"}, {"{{citta}}"}
                </p>
              </div>
            )}
            {data.tipo === "whatsapp" && (
              <div>
                <Label className="terminal-header mb-1.5 block">Template ID WhatsApp *</Label>
                <Input
                  value={data.template_whatsapp_id}
                  onChange={(e) => update({ template_whatsapp_id: e.target.value })}
                  placeholder="es. welcome_message_01"
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                  Inserisci l'ID del template approvato da Meta Business
                </p>
              </div>
            )}
            <div>
              <Label className="terminal-header mb-1.5 block">Velocità invio: {data.sending_rate_per_hour}/ora</Label>
              <Slider
                value={[data.sending_rate_per_hour]}
                onValueChange={([v]) => update({ sending_rate_per_hour: v })}
                min={50}
                max={2000}
                step={50}
                className="mt-2"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground font-mono mt-1">
                <span>50/h (sicuro)</span>
                <span>2000/h (aggressivo)</span>
              </div>
            </div>

            {/* Scheduling */}
            <div className="rounded-lg border border-border bg-accent p-3 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-primary" />
                <Label className="terminal-header">SCHEDULAZIONE (opzionale)</Label>
              </div>
              <p className="font-mono text-[10px] text-muted-foreground">
                Lascia vuoto per salvare come bozza, oppure scegli data e ora per programmare l'invio.
              </p>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-mono text-xs h-8",
                          !data.scheduled_at && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-3 w-3" />
                        {data.scheduled_at ? format(data.scheduled_at, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={data.scheduled_at || undefined}
                        onSelect={(date) => update({ scheduled_at: date || null })}
                        disabled={(date) => date < new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-[100px]">
                  <Input
                    type="time"
                    value={data.scheduleTime}
                    onChange={(e) => update({ scheduleTime: e.target.value })}
                    className="h-8 font-mono text-xs"
                    disabled={!data.scheduled_at}
                  />
                </div>
                {data.scheduled_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs font-mono text-muted-foreground"
                    onClick={() => update({ scheduled_at: null })}
                  >
                    Rimuovi
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Riepilogo */}
        {step === 3 && (
          <WizardStepReview data={data} costStimato={costStimato} canale={canale} />
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            className="font-mono text-xs"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Indietro
          </Button>

          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext()}
              className="font-mono text-xs"
            >
              Avanti <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={saving} className="font-mono text-xs">
              <Rocket className="mr-1 h-4 w-4" />
              {saving ? "Salvataggio..." : "Crea campagna"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
    <EmailPreviewDialog
      open={showPreview}
      onOpenChange={setShowPreview}
      subject={data.subject}
      bodyHtml={data.body_html}
      senderName={data.sender_name}
      senderEmail={data.sender_email}
    />
    </>
  );
}
