import { useState, useEffect, useCallback } from "react";
import {
  Zap, Plus, Trash2, Power, Edit, Play, CheckCircle,
  XCircle, Clock, AlertCircle, Phone, Mail, Tag,
  GitBranch, Bell, Globe, MessageSquare, MousePointer,
  Timer, Target, Layers, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { AutomationRule, AutomationExecution, AutomationTrigger, AutomationAzione } from "@/types";

// ── Trigger / Azione config ──────────────────────────────────────────
const triggerConfig: { tipo: AutomationTrigger; icon: React.ElementType; label: string; desc: string }[] = [
  { tipo: "email_aperta", icon: Mail, label: "Email aperta", desc: "Quando il lead apre la tua email" },
  { tipo: "email_cliccata", icon: MousePointer, label: "Link cliccato", desc: "Quando clicca un link nell'email" },
  { tipo: "risposta_ricevuta", icon: MessageSquare, label: "Risposta ricevuta", desc: "Qualsiasi risposta" },
  { tipo: "no_risposta_dopo", icon: Timer, label: "Nessuna risposta dopo…", desc: "Se non risponde entro N giorni" },
  { tipo: "chiamata_completata", icon: Phone, label: "Chiamata completata", desc: "Dopo una chiamata AI" },
  { tipo: "chiamata_esito", icon: Target, label: "Esito chiamata specifico", desc: "Chiamata con esito determinato" },
  { tipo: "pipeline_stage_cambiato", icon: GitBranch, label: "Stage pipeline cambiato", desc: "Quando il lead avanza nel CRM" },
  { tipo: "contatto_aggiunto", icon: Plus, label: "Aggiunto a campagna", desc: "Quando un contatto entra in campagna" },
  { tipo: "manuale", icon: Zap, label: "Manuale", desc: "Attivata a mano" },
];

const azioneConfig: { tipo: AutomationAzione; icon: React.ElementType; label: string; desc: string }[] = [
  { tipo: "chiama_contatto", icon: Phone, label: "Chiama contatto", desc: "Avvia chiamata AI ElevenLabs" },
  { tipo: "invia_email", icon: Mail, label: "Invia email", desc: "Manda email personalizzata" },
  { tipo: "assegna_tag", icon: Tag, label: "Assegna tag", desc: "Aggiunge tag al contatto" },
  { tipo: "cambia_pipeline_stage", icon: GitBranch, label: "Cambia stage pipeline", desc: "Aggiorna posizione CRM" },
  { tipo: "notifica_slack", icon: Bell, label: "Notifica Slack", desc: "Invia messaggio Slack" },
  { tipo: "notifica_webhook", icon: Globe, label: "Webhook esterno", desc: "POST su URL custom" },
];

const templates = [
  {
    nome: "🔥 Chiama i lead caldi",
    trigger_tipo: "email_aperta" as AutomationTrigger,
    trigger_params: {},
    azione_tipo: "chiama_contatto" as AutomationAzione,
    azione_params: { delay_minuti: 30, obiettivo: "Hai visto ci hai contattato, vuoi una demo?" },
    cooldown_ore: 48,
    max_esecuzioni_per_contatto: 2,
  },
  {
    nome: "🎯 Follow-up interessati",
    trigger_tipo: "risposta_ricevuta" as AutomationTrigger,
    trigger_params: { etichetta: "interessato" },
    azione_tipo: "cambia_pipeline_stage" as AutomationAzione,
    azione_params: { nuovo_stage: "interessato" },
    cooldown_ore: 0,
    max_esecuzioni_per_contatto: 1,
  },
  {
    nome: "⏰ Richiama i 'richiama'",
    trigger_tipo: "chiamata_esito" as AutomationTrigger,
    trigger_params: { esito: "richiama" },
    azione_tipo: "chiama_contatto" as AutomationAzione,
    azione_params: { delay_minuti: 0, obiettivo: "Follow-up su richiesta richiamo" },
    cooldown_ore: 24,
    max_esecuzioni_per_contatto: 3,
  },
  {
    nome: "📊 Notifica Slack lead caldo",
    trigger_tipo: "risposta_ricevuta" as AutomationTrigger,
    trigger_params: { etichetta: "appuntamento_fissato" },
    azione_tipo: "notifica_slack" as AutomationAzione,
    azione_params: {},
    cooldown_ore: 0,
    max_esecuzioni_per_contatto: 1,
  },
  {
    nome: "🚀 Sequenza riattivazione",
    trigger_tipo: "no_risposta_dopo" as AutomationTrigger,
    trigger_params: { giorni: 7 },
    azione_tipo: "chiama_contatto" as AutomationAzione,
    azione_params: { delay_minuti: 0, obiettivo: "Volevo assicurarmi che la mia email fosse arrivata..." },
    cooldown_ore: 168,
    max_esecuzioni_per_contatto: 1,
  },
];

const execStatoBadge: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
  completed: { label: "OK", cls: "bg-green-600/20 text-green-400 border-green-600/30", icon: CheckCircle },
  failed: { label: "Errore", cls: "bg-destructive/20 text-destructive border-destructive/30", icon: XCircle },
  pending: { label: "In coda", cls: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30", icon: Clock },
  running: { label: "In corso", cls: "bg-blue-600/20 text-blue-400 border-blue-600/30 animate-pulse", icon: RefreshCw },
  skipped: { label: "Saltata", cls: "bg-muted text-muted-foreground border-border", icon: AlertCircle },
};

// ── Main ─────────────────────────────────────────────────────────────
export default function Automations() {
  const [tab, setTab] = useState("regole");
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [execs, setExecs] = useState<(AutomationExecution & { automation_rules?: { nome: string }; contacts?: { azienda: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [editRule, setEditRule] = useState<AutomationRule | null>(null);
  const [filterExecStato, setFilterExecStato] = useState("all");

  const fetchRules = useCallback(async () => {
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error(error.message);
    setRules((data as unknown as AutomationRule[]) || []);
    setLoading(false);
  }, []);

  const fetchExecs = useCallback(async () => {
    let query = supabase
      .from("automation_executions")
      .select("*, automation_rules(nome), contacts:contact_id(azienda)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (filterExecStato !== "all") query = query.eq("stato", filterExecStato);
    const { data } = await query;
    setExecs((data as unknown as typeof execs) || []);
  }, [filterExecStato]);

  useEffect(() => { fetchRules(); fetchExecs(); }, [fetchRules, fetchExecs]);

  const toggleRule = async (id: string, attiva: boolean) => {
    await supabase.from("automation_rules").update({ attiva }).eq("id", id);
    fetchRules();
    toast.success(attiva ? "Regola attivata" : "Regola disattivata");
  };

  const deleteRule = async (id: string) => {
    await supabase.from("automation_rules").delete().eq("id", id);
    fetchRules();
    toast.success("Regola eliminata");
  };

  const runManual = async (rule: AutomationRule) => {
    toast.info("Esecuzione manuale non disponibile senza un contatto specifico. Usa il trigger automatico.");
  };

  const activeCount = rules.filter((r) => r.attiva).length;

  const openCreateFromTemplate = (tpl: typeof templates[0]) => {
    setEditRule({
      id: "",
      created_at: "",
      updated_at: "",
      user_id: "",
      nome: tpl.nome,
      descrizione: null,
      attiva: true,
      campaign_id: null,
      trigger_tipo: tpl.trigger_tipo,
      trigger_params: tpl.trigger_params,
      condizioni: [],
      azione_tipo: tpl.azione_tipo,
      azione_params: tpl.azione_params,
      max_esecuzioni_per_contatto: tpl.max_esecuzioni_per_contatto,
      cooldown_ore: tpl.cooldown_ore,
      volte_eseguita: 0,
      ultima_esecuzione: null,
    });
    setShowWizard(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-mono text-foreground">⚡ AUTOMAZIONI</h1>
          {activeCount > 0 && <Badge className="bg-primary/20 text-primary border-primary/30">{activeCount} attive</Badge>}
        </div>
        <Button size="sm" onClick={() => { setEditRule(null); setShowWizard(true); }}>
          <Plus className="h-4 w-4 mr-1" /> Nuova regola
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="regole">Regole attive</TabsTrigger>
          <TabsTrigger value="log">Log esecuzioni</TabsTrigger>
        </TabsList>

        {/* ── REGOLE ────────────────────────────────────────── */}
        <TabsContent value="regole">
          {loading ? (
            <div className="text-center py-16 text-muted-foreground font-mono text-sm">Caricamento...</div>
          ) : rules.length === 0 ? (
            <div className="space-y-6">
              <div className="text-center py-8 text-muted-foreground font-mono text-sm">
                Nessuna regola creata. Parti da un template:
              </div>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {templates.map((tpl, i) => {
                  const tc = triggerConfig.find((t) => t.tipo === tpl.trigger_tipo);
                  const ac = azioneConfig.find((a) => a.tipo === tpl.azione_tipo);
                  return (
                    <button
                      key={i}
                      onClick={() => openCreateFromTemplate(tpl)}
                      className="text-left p-4 rounded-lg border border-border bg-card hover:bg-muted/50 transition-colors"
                    >
                      <div className="font-mono font-bold text-sm mb-2">{tpl.nome}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                        {tc && <Badge variant="outline" className="text-xs">{tc.label}</Badge>}
                        <span>→</span>
                        {ac && <Badge variant="outline" className="text-xs">{ac.label}</Badge>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              {rules.map((rule) => {
                const tc = triggerConfig.find((t) => t.tipo === rule.trigger_tipo);
                const ac = azioneConfig.find((a) => a.tipo === rule.azione_tipo);
                const TIcon = tc?.icon || Zap;
                const AIcon = ac?.icon || Zap;
                return (
                  <div key={rule.id} className="flex items-center gap-4 p-4 rounded-lg border border-border bg-card">
                    <Switch checked={rule.attiva} onCheckedChange={(v) => toggleRule(rule.id, v)} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono font-bold text-sm truncate">{rule.nome}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground font-mono">
                        <Badge variant="outline" className="text-xs gap-1"><TIcon className="h-3 w-3" />{tc?.label}</Badge>
                        <span>→</span>
                        <Badge variant="outline" className="text-xs gap-1"><AIcon className="h-3 w-3" />{ac?.label}</Badge>
                        {rule.campaign_id ? <Badge variant="secondary" className="text-xs">Campagna</Badge> : <Badge variant="secondary" className="text-xs">Globale</Badge>}
                      </div>
                    </div>
                    <div className="text-right text-xs font-mono text-muted-foreground">
                      <div>Eseguita {rule.volte_eseguita}x</div>
                      {rule.ultima_esecuzione && <div>{format(new Date(rule.ultima_esecuzione), "dd/MM HH:mm")}</div>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setEditRule(rule); setShowWizard(true); }}><Edit className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteRule(rule.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── LOG ───────────────────────────────────────────── */}
        <TabsContent value="log">
          <div className="flex gap-2 mb-4">
            <Select value={filterExecStato} onValueChange={setFilterExecStato}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Stato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="completed">Completata</SelectItem>
                <SelectItem value="failed">Fallita</SelectItem>
                <SelectItem value="pending">In coda</SelectItem>
                <SelectItem value="running">In corso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Regola</TableHead>
                  <TableHead>Contatto</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Errore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {execs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground font-mono text-sm">Nessuna esecuzione</TableCell></TableRow>
                ) : execs.map((ex) => {
                  const sb = execStatoBadge[ex.stato] || execStatoBadge.pending;
                  const SIcon = sb.icon;
                  return (
                    <TableRow key={ex.id}>
                      <TableCell className="font-mono text-xs">{format(new Date(ex.created_at), "dd/MM HH:mm", { locale: it })}</TableCell>
                      <TableCell className="font-mono text-sm">{ex.automation_rules?.nome || ex.rule_id.slice(0, 8)}</TableCell>
                      <TableCell className="font-mono text-sm">{ex.contacts?.azienda || ex.contact_id.slice(0, 8)}</TableCell>
                      <TableCell><Badge className={`gap-1 ${sb.cls}`}><SIcon className="h-3 w-3" />{sb.label}</Badge></TableCell>
                      <TableCell>
                        {ex.error_message ? (
                          <Tooltip>
                            <TooltipTrigger><AlertCircle className="h-4 w-4 text-destructive" /></TooltipTrigger>
                            <TooltipContent className="max-w-xs text-xs font-mono">{ex.error_message}</TooltipContent>
                          </Tooltip>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Wizard Dialog */}
      <RuleWizardDialog open={showWizard} initial={editRule} onClose={() => { setShowWizard(false); setEditRule(null); }} onSaved={() => { fetchRules(); setShowWizard(false); setEditRule(null); }} />
    </div>
  );
}

// ── Rule Wizard Dialog ──────────────────────────────────────────────
function RuleWizardDialog({ open, initial, onClose, onSaved }: {
  open: boolean;
  initial: AutomationRule | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = initial && initial.id;
  const [step, setStep] = useState(1);
  const [triggerTipo, setTriggerTipo] = useState<AutomationTrigger>(initial?.trigger_tipo || "email_aperta");
  const [triggerParams, setTriggerParams] = useState<Record<string, unknown>>(initial?.trigger_params || {});
  const [azioneTipo, setAzioneTipo] = useState<AutomationAzione>(initial?.azione_tipo || "chiama_contatto");
  const [azioneParams, setAzioneParams] = useState<Record<string, unknown>>(initial?.azione_params || {});
  const [nome, setNome] = useState(initial?.nome || "");
  const [descrizione, setDescrizione] = useState(initial?.descrizione || "");
  const [campaignId, setCampaignId] = useState(initial?.campaign_id || "");
  const [maxExec, setMaxExec] = useState(initial?.max_esecuzioni_per_contatto || 1);
  const [cooldown, setCooldown] = useState(initial?.cooldown_ore || 24);
  const [saving, setSaving] = useState(false);
  const [campaigns, setCampaigns] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setTriggerTipo(initial?.trigger_tipo || "email_aperta");
      setTriggerParams(initial?.trigger_params || {});
      setAzioneTipo(initial?.azione_tipo || "chiama_contatto");
      setAzioneParams(initial?.azione_params || {});
      setNome(initial?.nome || "");
      setDescrizione(initial?.descrizione || "");
      setCampaignId(initial?.campaign_id || "");
      setMaxExec(initial?.max_esecuzioni_per_contatto || 1);
      setCooldown(initial?.cooldown_ore || 24);
      // Load campaigns
      supabase.from("campaigns").select("id, nome").order("created_at", { ascending: false }).then(({ data }) => {
        setCampaigns((data as { id: string; nome: string }[]) || []);
      });
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("Inserisci un nome per la regola"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      const payload = {
        user_id: user.id,
        nome: nome.trim(),
        descrizione: descrizione || null,
        attiva: true,
        campaign_id: campaignId || null,
        trigger_tipo: triggerTipo,
        trigger_params: triggerParams as unknown as import("@/integrations/supabase/types").Json,
        condizioni: [] as unknown as import("@/integrations/supabase/types").Json,
        azione_tipo: azioneTipo,
        azione_params: azioneParams as unknown as import("@/integrations/supabase/types").Json,
        max_esecuzioni_per_contatto: maxExec,
        cooldown_ore: cooldown,
      };

      if (isEdit) {
        const { error } = await supabase.from("automation_rules").update(payload).eq("id", initial.id);
        if (error) throw error;
        toast.success("Regola aggiornata");
      } else {
        const { error } = await supabase.from("automation_rules").insert(payload);
        if (error) throw error;
        toast.success("Regola creata");
      }
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const tc = triggerConfig.find((t) => t.tipo === triggerTipo);
  const ac = azioneConfig.find((a) => a.tipo === azioneTipo);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{isEdit ? "Modifica regola" : "Nuova regola"} — Step {step}/3</DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <button key={s} onClick={() => setStep(s)} className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {/* ── STEP 1: Trigger ──────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="terminal-header">QUANDO SI ATTIVA?</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {triggerConfig.map((t) => {
                const TIcon = t.icon;
                return (
                  <button
                    key={t.tipo}
                    onClick={() => { setTriggerTipo(t.tipo); setTriggerParams({}); }}
                    className={`p-3 rounded-lg border text-left transition-colors ${triggerTipo === t.tipo ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/50"}`}
                  >
                    <TIcon className="h-4 w-4 mb-1 text-primary" />
                    <div className="font-mono text-xs font-bold">{t.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{t.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Trigger-specific params */}
            {triggerTipo === "no_risposta_dopo" && (
              <div>
                <Label className="text-xs font-mono">Dopo quanti giorni?</Label>
                <Input type="number" min={1} value={(triggerParams.giorni as number) || 3} onChange={(e) => setTriggerParams({ ...triggerParams, giorni: Number(e.target.value) })} />
              </div>
            )}
            {triggerTipo === "chiamata_esito" && (
              <div>
                <Label className="text-xs font-mono">Esito specifico</Label>
                <Select value={(triggerParams.esito as string) || ""} onValueChange={(v) => setTriggerParams({ ...triggerParams, esito: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona esito" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interessato">Interessato</SelectItem>
                    <SelectItem value="non_interessato">Non interessato</SelectItem>
                    <SelectItem value="richiama">Richiama</SelectItem>
                    <SelectItem value="appuntamento">Appuntamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Azione ───────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="terminal-header">COSA FARE?</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {azioneConfig.map((a) => {
                const AIcon = a.icon;
                return (
                  <button
                    key={a.tipo}
                    onClick={() => { setAzioneTipo(a.tipo); setAzioneParams({}); }}
                    className={`p-3 rounded-lg border text-left transition-colors ${azioneTipo === a.tipo ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-muted/50"}`}
                  >
                    <AIcon className="h-4 w-4 mb-1 text-primary" />
                    <div className="font-mono text-xs font-bold">{a.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Action-specific params */}
            {azioneTipo === "chiama_contatto" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-mono">Delay (minuti prima di chiamare)</Label>
                  <Input type="number" min={0} value={(azioneParams.delay_minuti as number) || 0} onChange={(e) => setAzioneParams({ ...azioneParams, delay_minuti: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs font-mono">Obiettivo chiamata</Label>
                  <Textarea rows={2} value={(azioneParams.obiettivo as string) || ""} onChange={(e) => setAzioneParams({ ...azioneParams, obiettivo: e.target.value })} placeholder="Es: Fissa una demo di 30 minuti" />
                </div>
                <div>
                  <Label className="text-xs font-mono">Contesto/script</Label>
                  <Textarea rows={2} value={(azioneParams.script_contesto as string) || ""} onChange={(e) => setAzioneParams({ ...azioneParams, script_contesto: e.target.value })} placeholder="Es: Il lead ha aperto la email 3 volte" />
                </div>
              </div>
            )}
            {azioneTipo === "cambia_pipeline_stage" && (
              <div>
                <Label className="text-xs font-mono">Nuovo stage</Label>
                <Select value={(azioneParams.nuovo_stage as string) || ""} onValueChange={(v) => setAzioneParams({ ...azioneParams, nuovo_stage: v })}>
                  <SelectTrigger><SelectValue placeholder="Seleziona stage" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interessato">Interessato</SelectItem>
                    <SelectItem value="richiesta_info">Richiesta info</SelectItem>
                    <SelectItem value="meeting_fissato">Meeting fissato</SelectItem>
                    <SelectItem value="proposta_inviata">Proposta inviata</SelectItem>
                    <SelectItem value="vinto">Vinto</SelectItem>
                    <SelectItem value="perso">Perso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {azioneTipo === "assegna_tag" && (
              <div>
                <Label className="text-xs font-mono">Tag (separati da virgola)</Label>
                <Input value={Array.isArray(azioneParams.tags) ? (azioneParams.tags as string[]).join(", ") : ""} onChange={(e) => setAzioneParams({ ...azioneParams, tags: e.target.value.split(",").map((t: string) => t.trim()).filter(Boolean) })} placeholder="lead-caldo, da-richiamare" />
              </div>
            )}
            {azioneTipo === "notifica_webhook" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-mono">URL Webhook</Label>
                  <Input value={(azioneParams.url as string) || ""} onChange={(e) => setAzioneParams({ ...azioneParams, url: e.target.value })} placeholder="https://..." />
                </div>
                <div>
                  <Label className="text-xs font-mono">Metodo</Label>
                  <Select value={(azioneParams.metodo as string) || "POST"} onValueChange={(v) => setAzioneParams({ ...azioneParams, metodo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="GET">GET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Settings ─────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="terminal-header">IMPOSTAZIONI</h3>
            <div>
              <Label className="text-xs font-mono">Nome regola *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es: Chiama lead caldi" />
            </div>
            <div>
              <Label className="text-xs font-mono">Descrizione</Label>
              <Textarea rows={2} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Facoltativa" />
            </div>
            <div>
              <Label className="text-xs font-mono">Campagna associata</Label>
              <Select value={campaignId} onValueChange={setCampaignId}>
                <SelectTrigger><SelectValue placeholder="Tutte le campagne" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tutte le campagne</SelectItem>
                  {campaigns.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-mono">Max esecuzioni per contatto</Label>
                <Input type="number" min={1} value={maxExec} onChange={(e) => setMaxExec(Number(e.target.value))} />
              </div>
              <div>
                <Label className="text-xs font-mono">Cooldown (ore)</Label>
                <Input type="number" min={0} value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} />
              </div>
            </div>

            {/* Preview */}
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <div className="terminal-header mb-2">ANTEPRIMA</div>
              <div className="flex items-center gap-2 text-sm font-mono">
                <Badge variant="outline">{tc?.label || triggerTipo}</Badge>
                <span>→</span>
                <Badge variant="outline">{ac?.label || azioneTipo}</Badge>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <div>
            {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)}>Indietro</Button>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Annulla</Button>
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)}>Avanti</Button>
            ) : (
              <Button onClick={handleSave} disabled={saving}>{saving ? "Salvataggio..." : isEdit ? "Aggiorna" : "Salva regola"}</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
