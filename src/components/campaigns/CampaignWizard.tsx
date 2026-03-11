import { useState, useEffect } from "react";
import { Mail, MessageSquare, Phone, ChevronRight, ChevronLeft, Rocket, Users, FileText, Eye, CalendarIcon, Clock, Plus, Trash2, AlertTriangle, Sparkles, Send, GitBranch, Settings2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { WizardStepRecipients } from "./WizardStepRecipients";
import { WizardStepReview } from "./WizardStepReview";
import { WizardStepAI } from "./WizardStepAI";
import { SequenceBuilder } from "./SequenceBuilder";
import { SmartSchedulingTab } from "./SmartSchedulingTab";
import { populateCampaignRecipients, htmlToPlainText, getSmsInfo } from "@/lib/campaignHelpers";
import { calculateCost } from "@/lib/costCalculator";
import type { CampaignTipo, SequenceStep } from "@/types";

const CANALI = [
  { value: "email" as CampaignTipo, label: "Email", icon: Mail, desc: "Invia email personalizzate", costPer: 0.001 },
  { value: "sms" as CampaignTipo, label: "SMS", icon: Phone, desc: "Messaggi brevi via SMS", costPer: 0.05 },
  { value: "whatsapp" as CampaignTipo, label: "WhatsApp", icon: MessageSquare, desc: "Template WhatsApp Business", costPer: 0.04 },
];

export interface WhatsAppVariable {
  index: number;
  tipo: "campo" | "fisso";
  valore: string;
}

export interface WizardData {
  tipo: CampaignTipo;
  tipoCampagna: "blast" | "sequence";
  nome: string;
  subject: string;
  subject_b: string;
  ab_test_enabled: boolean;
  ab_test_split: number;
  ab_test_sample_size: number;
  body_html: string;
  body_text: string;
  sender_email: string;
  sender_name: string;
  reply_to: string;
  template_whatsapp_id: string;
  template_whatsapp_language: string;
  template_whatsapp_variables: WhatsAppVariable[];
  recipientSource: "all" | "list" | "filter";
  selectedListId: string;
  filterStato: string[];
  filterHasEmail: boolean;
  filterHasTelefono: boolean;
  sending_rate_per_hour: number;
  recipientCount: number;
  scheduled_at: Date | null;
  scheduleTime: string;
  aiEnabled: boolean;
  aiModel: string;
  aiContext: string;
  aiObjective: string;
  // Sequence fields
  steps: SequenceStep[];
  timezone: string;
  ora_inizio_invio: string;
  ora_fine_invio: string;
  solo_lavorativi: boolean;
  stop_su_risposta: boolean;
  tracking_aperture: boolean;
}

const defaultData: WizardData = {
  tipo: "email",
  tipoCampagna: "blast",
  nome: "",
  subject: "",
  subject_b: "",
  ab_test_enabled: false,
  ab_test_split: 50,
  ab_test_sample_size: 100,
  body_html: "",
  body_text: "",
  sender_email: "",
  sender_name: "",
  reply_to: "",
  template_whatsapp_id: "",
  template_whatsapp_language: "it",
  template_whatsapp_variables: [],
  recipientSource: "all",
  selectedListId: "",
  filterStato: [],
  filterHasEmail: false,
  filterHasTelefono: false,
  sending_rate_per_hour: 500,
  recipientCount: 0,
  scheduled_at: null,
  scheduleTime: "09:00",
  aiEnabled: false,
  aiModel: "haiku",
  aiContext: "",
  aiObjective: "",
  steps: [],
  timezone: "Europe/Rome",
  ora_inizio_invio: "08:00",
  ora_fine_invio: "19:00",
  solo_lavorativi: true,
  stop_su_risposta: true,
  tracking_aperture: true,
};

interface CampaignWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function CampaignWizard({ open, onOpenChange, onCreated }: CampaignWizardProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...defaultData });
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  const isSequence = data.tipoCampagna === "sequence";

  // Dynamic steps based on campaign type
  const STEPS = isSequence
    ? [
        { id: "tipo", label: "Canale", icon: Mail },
        { id: "destinatari", label: "Destinatari", icon: Users },
        { id: "sequenza", label: "Sequenza", icon: GitBranch },
        { id: "scheduling", label: "Recapito", icon: Settings2 },
        { id: "riepilogo", label: "Riepilogo", icon: Eye },
      ]
    : [
        { id: "tipo", label: "Canale", icon: Mail },
        { id: "destinatari", label: "Destinatari", icon: Users },
        { id: "contenuto", label: "Contenuto", icon: FileText },
        { id: "ai", label: "AI ✨", icon: Sparkles },
        { id: "riepilogo", label: "Riepilogo", icon: Eye },
      ];

  const totalSteps = STEPS.length;

  useEffect(() => {
    if (open) {
      setStep(0);
      setTemplates([]);
      supabase
        .from("app_settings")
        .select("chiave, valore")
        .in("chiave", ["sender_name_default", "sender_email_default", "reply_to_default"])
        .then(({ data: settings }) => {
          const map: Record<string, string> = {};
          settings?.forEach((s: any) => { if (s.valore) map[s.chiave] = s.valore; });
          setData({
            ...defaultData,
            sender_name: map.sender_name_default || "",
            sender_email: map.sender_email_default || "",
            reply_to: map.reply_to_default || "",
          });
        });
    }
  }, [open]);

  useEffect(() => {
    if (!data.tipo || !open) return;
    supabase.from("campaign_templates" as any)
      .select("*")
      .eq("tipo", data.tipo)
      .order("utilizzi", { ascending: false })
      .limit(6)
      .then(({ data: tpl }) => setTemplates(tpl || []));
  }, [data.tipo, open]);

  const update = (partial: Partial<WizardData>) => setData((d) => ({ ...d, ...partial }));

  const canale = CANALI.find((c) => c.value === data.tipo)!;

  const messageLength = data.tipo === "sms" ? data.body_text.length : 0;
  const costBreakdown = calculateCost(data.tipo, data.recipientCount, messageLength);
  const costStimato = costBreakdown.totalCost;

  const canNext = () => {
    if (step === 0) return !!data.tipo && data.nome.trim().length > 0;
    if (step === 1) return data.recipientCount > 0;
    if (step === 2) {
      if (isSequence) {
        // Sequence: at least 1 step with content
        return data.steps.length > 0 && data.steps.every(s => {
          if (s.tipo === "email") return (s.soggetto || "").trim().length > 0 && (s.corpo_html || "").trim().length > 0;
          return (s.messaggio || "").trim().length > 0;
        });
      }
      // Blast
      if (data.tipo === "email") {
        return (
          data.subject.trim().length > 0 &&
          data.body_html.trim().length > 0 &&
          data.sender_email.trim().length > 0 &&
          EMAIL_REGEX.test(data.sender_email.trim())
        );
      }
      if (data.tipo === "sms") return data.body_text.trim().length > 0;
      if (data.tipo === "whatsapp") {
        return data.template_whatsapp_id.trim().length > 0 && data.template_whatsapp_language.trim().length > 0;
      }
    }
    if (step === 3) return true;
    return true;
  };

  const addWhatsAppVariable = () => {
    const nextIndex = data.template_whatsapp_variables.length + 1;
    update({
      template_whatsapp_variables: [
        ...data.template_whatsapp_variables,
        { index: nextIndex, tipo: "campo", valore: "nome" },
      ],
    });
  };

  const removeWhatsAppVariable = (idx: number) => {
    const vars = data.template_whatsapp_variables.filter((_, i) => i !== idx);
    update({
      template_whatsapp_variables: vars.map((v, i) => ({ ...v, index: i + 1 })),
    });
  };

  const updateWhatsAppVariable = (idx: number, partial: Partial<WhatsAppVariable>) => {
    const vars = [...data.template_whatsapp_variables];
    vars[idx] = { ...vars[idx], ...partial };
    update({ template_whatsapp_variables: vars });
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      let scheduledAt: string | null = null;
      if (data.scheduled_at) {
        const d = new Date(data.scheduled_at);
        const [h, m] = data.scheduleTime.split(":").map(Number);
        d.setHours(h, m, 0, 0);
        scheduledAt = d.toISOString();
      }

      const bodyText = data.tipo === "email" ? htmlToPlainText(data.body_html) : data.body_text;
      const user_id = await getCurrentUserId();

      const { data: newCampaign, error } = await supabase.from("campaigns").insert({
        user_id,
        nome: data.nome.trim(),
        tipo: data.tipo,
        tipo_campagna: data.tipoCampagna,
        stato: scheduledAt ? "schedulata" : "bozza",
        subject: data.subject || null,
        subject_b: data.ab_test_enabled ? (data.subject_b || null) : null,
        ab_test_enabled: data.ab_test_enabled,
        ab_test_split: data.ab_test_split,
        ab_test_sample_size: data.ab_test_sample_size,
        body_html: data.body_html || null,
        body_text: bodyText || null,
        template_whatsapp_id: data.template_whatsapp_id || null,
        template_whatsapp_language: data.tipo === "whatsapp" ? data.template_whatsapp_language : null,
        template_whatsapp_variables: data.tipo === "whatsapp" ? data.template_whatsapp_variables : [],
        sender_email: data.sender_email || null,
        sender_name: data.sender_name || null,
        reply_to: data.reply_to || null,
        totale_destinatari: data.recipientCount,
        sending_rate_per_hour: data.sending_rate_per_hour,
        costo_stimato_eur: costStimato,
        scheduled_at: scheduledAt,
        ai_personalization_enabled: data.aiEnabled,
        ai_model: data.aiEnabled ? data.aiModel : null,
        ai_context: data.aiEnabled ? data.aiContext : null,
        ai_objective: data.aiEnabled ? data.aiObjective : null,
        ai_personalization_status: "none",
        // Sequence scheduling fields
        timezone: data.timezone,
        ora_inizio_invio: data.ora_inizio_invio,
        ora_fine_invio: data.ora_fine_invio,
        solo_lavorativi: data.solo_lavorativi,
        stop_su_risposta: data.stop_su_risposta,
        tracking_aperture: data.tracking_aperture,
      } as any).select("id").single();

      if (error) throw error;
      if (!newCampaign) throw new Error("Errore creazione campagna");

      // If sequence, save steps
      if (isSequence && data.steps.length > 0) {
        const stepRows = data.steps.map((s) => ({
          campaign_id: newCampaign.id,
          step_number: s.step_number,
          tipo: s.tipo,
          delay_giorni: s.delay_giorni,
          delay_ore: s.delay_ore,
          condizione: s.condizione,
          soggetto: s.soggetto || null,
          corpo_html: s.corpo_html || null,
          messaggio: s.messaggio || null,
          ab_nome: s.ab_nome || null,
          ab_peso: s.ab_peso,
        }));
        const { error: stepsErr } = await supabase.from("campaign_steps" as any).insert(stepRows);
        if (stepsErr) throw stepsErr;
      }

      // Populate recipients
      try {
        const inserted = await populateCampaignRecipients(newCampaign.id, data);
        toast({
          title: scheduledAt ? "Campagna schedulata" : "Campagna creata",
          description: scheduledAt
            ? `"${data.nome}" programmata per ${format(new Date(scheduledAt), "dd MMM yyyy 'alle' HH:mm", { locale: it })} — ${inserted} destinatari`
            : `"${data.nome}" salvata come bozza — ${inserted} destinatari${isSequence ? ` — ${data.steps.length} step` : ""}`,
        });
      } catch (recipientErr: any) {
        await supabase.from("campaigns").delete().eq("id", newCampaign.id);
        throw new Error(`Errore popolamento destinatari: ${recipientErr.message}`);
      }

      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const smsInfo = getSmsInfo(data.body_text);

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

            {/* Tipo campagna: Blast vs Sequence */}
            <div>
              <Label className="font-mono text-xs mb-3 block">TIPO CAMPAGNA</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => update({ tipoCampagna: "blast" })}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    data.tipoCampagna === "blast"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <Send className="h-5 w-5 mb-2 text-primary" />
                  <p className="font-semibold text-sm">Blast</p>
                  <p className="text-xs text-muted-foreground">Un singolo invio a tutta la lista</p>
                </button>
                <button
                  onClick={() => update({ tipoCampagna: "sequence" })}
                  className={cn(
                    "p-4 rounded-xl border-2 text-left transition-all",
                    data.tipoCampagna === "sequence"
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <GitBranch className="h-5 w-5 mb-2 text-primary" />
                  <p className="font-semibold text-sm">Sequenza</p>
                  <p className="text-xs text-muted-foreground">Multi-step con follow-up automatici</p>
                  <Badge className="mt-1 text-xs bg-yellow-500/20 text-yellow-600 border-yellow-500/30">+35% reply rate</Badge>
                </button>
              </div>
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
                  </button>
                ))}
              </div>
            </div>

            {/* Templates */}
            {templates.length > 0 && (
              <div>
                <Label className="terminal-header mb-2 block">Parti da un template</Label>
                <Input
                  placeholder="Cerca template..."
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="font-mono text-xs mb-2"
                />
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {filteredTemplates.map((tpl: any) => (
                    <button
                      key={tpl.id}
                      onClick={() => {
                        update({
                          subject: tpl.subject || "",
                          body_html: tpl.body_html || "",
                          body_text: tpl.body_text || "",
                          template_whatsapp_id: tpl.template_whatsapp_id || "",
                          sender_email: tpl.sender_email || data.sender_email,
                          sender_name: tpl.sender_name || data.sender_name,
                          reply_to: tpl.reply_to || data.reply_to,
                          sending_rate_per_hour: tpl.sending_rate_per_hour || 500,
                          aiEnabled: tpl.ai_personalization_enabled || false,
                          aiModel: tpl.ai_model || "haiku",
                          aiContext: tpl.ai_context || "",
                          aiObjective: tpl.ai_objective || "",
                        });
                        supabase.from("campaign_templates" as any)
                          .update({ utilizzi: (tpl.utilizzi || 0) + 1 } as any)
                          .eq("id", tpl.id)
                          .then(() => {});
                        toast({ title: `Template "${tpl.nome}" applicato` });
                        setStep(1);
                      }}
                      className={cn(
                        "rounded-md border border-border bg-card p-2.5 text-left hover:border-primary/40 transition-colors",
                        tpl.subject === data.subject && tpl.body_html === data.body_html && "border-primary bg-primary/5"
                      )}
                    >
                      <p className="font-mono text-xs font-medium truncate">{tpl.nome}</p>
                      {tpl.subject && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{tpl.subject}</p>}
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        Usato {tpl.utilizzi || 0} volte{tpl.ai_personalization_enabled ? " · ✨ AI" : ""}
                      </p>
                    </button>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <p className="col-span-2 text-xs text-muted-foreground text-center py-2">Nessun template trovato</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Destinatari */}
        {step === 1 && (
          <WizardStepRecipients data={data} update={update} />
        )}

        {/* Step 2: Contenuto (Blast) or Sequenza (Sequence) */}
        {step === 2 && !isSequence && (
          <div className="space-y-4">
            {data.tipo === "email" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="terminal-header mb-1.5 block">Mittente nome</Label>
                    <Input value={data.sender_name} onChange={(e) => update({ sender_name: e.target.value })} placeholder="LeadHunter Pro" className="font-mono text-sm" />
                  </div>
                  <div>
                    <Label className="terminal-header mb-1.5 block">Mittente email *</Label>
                    <Input value={data.sender_email} onChange={(e) => update({ sender_email: e.target.value })} placeholder="noreply@tuodominio.it" className="font-mono text-sm" />
                    {data.sender_email && !EMAIL_REGEX.test(data.sender_email) && (
                      <p className="text-[10px] text-destructive font-mono mt-1">Email mittente non valida</p>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="terminal-header mb-1.5 block">Reply-to</Label>
                  <Input value={data.reply_to} onChange={(e) => update({ reply_to: e.target.value })} placeholder="info@tuodominio.it" className="font-mono text-sm" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="terminal-header">Oggetto *</Label>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground">A/B Test</span>
                      <Switch
                        checked={data.ab_test_enabled}
                        onCheckedChange={(v) => update({ ab_test_enabled: v })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {data.ab_test_enabled && (
                        <span className="shrink-0 w-5 h-5 rounded bg-primary/10 border border-primary/30 flex items-center justify-center font-mono text-[10px] text-primary font-bold">A</span>
                      )}
                      <Input value={data.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="Scopri i nostri servizi" className="font-mono text-sm" />
                    </div>
                    {data.ab_test_enabled && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 w-5 h-5 rounded bg-secondary/50 border border-border flex items-center justify-center font-mono text-[10px] font-bold">B</span>
                          <Input value={data.subject_b} onChange={(e) => update({ subject_b: e.target.value })} placeholder="Variante B dell'oggetto..." className="font-mono text-sm" />
                        </div>
                        <div className="rounded-md border border-border bg-accent p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] text-muted-foreground">Split A/B</span>
                            <span className="font-mono text-xs font-medium">{data.ab_test_split}% / {100 - data.ab_test_split}%</span>
                          </div>
                          <Slider
                            value={[data.ab_test_split]}
                            onValueChange={([v]) => update({ ab_test_split: v })}
                            min={10}
                            max={90}
                            step={5}
                          />
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] text-muted-foreground">Campione test</span>
                            <span className="font-mono text-xs font-medium">
                              {Math.min(data.ab_test_sample_size, data.recipientCount)} destinatari
                            </span>
                          </div>
                          <Slider
                            value={[data.ab_test_sample_size]}
                            onValueChange={([v]) => update({ ab_test_sample_size: v })}
                            min={20}
                            max={Math.max(data.recipientCount, 100)}
                            step={10}
                          />
                          <p className="font-mono text-[10px] text-muted-foreground">
                            Il campione riceverà le 2 varianti. Dopo 4h, la variante con più aperture verrà inviata ai restanti.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
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
                  const { isGsm7, maxSingle, smsCount, len } = smsInfo;
                  const isOver = len > maxSingle;
                  return (
                    <div className="space-y-1 mt-1">
                      <div className="flex items-center justify-between">
                        <p className={cn("text-[10px] font-mono", isOver ? "text-warning" : "text-muted-foreground")}>
                          {len}/{maxSingle} caratteri {isOver && `— ${smsCount} SMS`}
                        </p>
                        {isOver && (
                          <span className="text-[10px] font-mono text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                            ⚠️ {smsCount} SMS — costo ×{smsCount}
                          </span>
                        )}
                      </div>
                      {!isGsm7 && len > 0 && (
                        <div className="flex items-start gap-1.5 rounded-md bg-warning/10 border border-warning/20 px-2 py-1.5">
                          <AlertTriangle className="h-3 w-3 text-warning mt-0.5 shrink-0" />
                          <span className="font-mono text-[10px] text-warning leading-relaxed">
                            Caratteri speciali rilevati (UCS-2): limite ridotto a 70 car/SMS invece di 160
                          </span>
                        </div>
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
              <div className="space-y-4">
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
                <div>
                  <Label className="terminal-header mb-1.5 block">Lingua template</Label>
                  <Select value={data.template_whatsapp_language} onValueChange={(v) => update({ template_whatsapp_language: v })}>
                    <SelectTrigger className="font-mono text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">Italiano (it)</SelectItem>
                      <SelectItem value="en">Inglese (en)</SelectItem>
                      <SelectItem value="en_US">Inglese US (en_US)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="terminal-header mb-1.5 block">Variabili template</Label>
                  <p className="text-[10px] text-muted-foreground mb-2 font-mono">
                    Mappa le variabili {"{{1}}"}, {"{{2}}"} ecc. ai campi contatto o valori fissi
                  </p>
                  <div className="space-y-2">
                    {data.template_whatsapp_variables.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-2 rounded-md border border-border bg-accent p-2">
                        <span className="font-mono text-xs text-primary font-bold shrink-0 w-8">{`{{${v.index}}}`}</span>
                        <Select value={v.tipo} onValueChange={(val) => updateWhatsAppVariable(idx, { tipo: val as "campo" | "fisso" })}>
                          <SelectTrigger className="font-mono text-xs w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="campo">Campo</SelectItem>
                            <SelectItem value="fisso">Fisso</SelectItem>
                          </SelectContent>
                        </Select>
                        {v.tipo === "campo" ? (
                          <Select value={v.valore} onValueChange={(val) => updateWhatsAppVariable(idx, { valore: val })}>
                            <SelectTrigger className="font-mono text-xs flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nome">Nome</SelectItem>
                              <SelectItem value="azienda">Azienda</SelectItem>
                              <SelectItem value="citta">Città</SelectItem>
                              <SelectItem value="telefono">Telefono</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={v.valore}
                            onChange={(e) => updateWhatsAppVariable(idx, { valore: e.target.value })}
                            placeholder="Valore fisso..."
                            className="font-mono text-xs flex-1"
                          />
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeWhatsAppVariable(idx)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" className="font-mono text-xs mt-2" onClick={addWhatsAppVariable}>
                    <Plus className="h-3 w-3 mr-1" /> Aggiungi variabile
                  </Button>
                </div>
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

        {/* Step 2: Sequence Builder */}
        {step === 2 && isSequence && (
          <div className="space-y-4">
            {/* Sender info for sequence emails */}
            {data.tipo === "email" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="terminal-header mb-1.5 block">Mittente nome</Label>
                  <Input value={data.sender_name} onChange={(e) => update({ sender_name: e.target.value })} placeholder="LeadHunter Pro" className="font-mono text-sm" />
                </div>
                <div>
                  <Label className="terminal-header mb-1.5 block">Mittente email *</Label>
                  <Input value={data.sender_email} onChange={(e) => update({ sender_email: e.target.value })} placeholder="noreply@tuodominio.it" className="font-mono text-sm" />
                </div>
              </div>
            )}
            <SequenceBuilder
              steps={data.steps}
              onChange={(steps) => update({ steps })}
            />
          </div>
        )}

        {/* Step 3: AI (blast) or Scheduling (sequence) */}
        {step === 3 && !isSequence && (
          <WizardStepAI data={data} update={update} />
        )}
        {step === 3 && isSequence && (
          <SmartSchedulingTab
            data={{
              timezone: data.timezone,
              ora_inizio_invio: data.ora_inizio_invio,
              ora_fine_invio: data.ora_fine_invio,
              solo_lavorativi: data.solo_lavorativi,
              stop_su_risposta: data.stop_su_risposta,
              tracking_aperture: data.tracking_aperture,
            }}
            onChange={(updates) => update(updates)}
          />
        )}

        {/* Step 4: Riepilogo */}
        {step === totalSteps - 1 && (
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

          {step < totalSteps - 1 ? (
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
