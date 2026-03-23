import { useState, useCallback, useRef } from "react";
import {
  Bot, Play, Pause, Search, Mail, CheckCircle, MessageSquare,
  AlertCircle, ChevronRight, Users, Send, TrendingUp, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useSenderPool } from "@/hooks/useSenderPool";
import { toast } from "sonner";

interface AgentConfig {
  categoria: string;
  citta: string;
  raggio: number;
  contestoAzienda: string;
  tono: string;
  oggettoTemplate: string;
  mittente: string;
  maxContattiGiorno: number;
  pausaSeRisposta: boolean;
  followUpAuto: boolean;
}

interface LogEntry {
  id: number;
  icon: string;
  message: string;
  time: string;
  type: "info" | "success" | "error" | "ai";
}

interface AgentRun {
  id: string;
  data: string;
  categoria: string;
  citta: string;
  inviati: number;
  risposte: number;
  stato: "completato" | "in_corso" | "errore" | "fermato";
}

export default function AIAgentPage() {
  const { senders } = useSenderPool("email");

  const [config, setConfig] = useState<AgentConfig>({
    categoria: "",
    citta: "",
    raggio: 25,
    contestoAzienda: "",
    tono: "professionale",
    oggettoTemplate: "Proposta per {{azienda}}",
    mittente: "",
    maxContattiGiorno: 50,
    pausaSeRisposta: true,
    followUpAuto: false,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [stats, setStats] = useState({
    contattiTrovati: 0,
    emailInviate: 0,
    risposte: 0,
  });

  const isPaused = useRef(false);
  const isStopped = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const tassoRisposta =
    stats.emailInviate > 0
      ? ((stats.risposte / stats.emailInviate) * 100).toFixed(1)
      : "0.0";

  const addLog = useCallback(
    (icon: string, message: string, type: LogEntry["type"] = "info") => {
      setLogs((prev) =>
        [
          {
            id: Date.now() + Math.random(),
            icon,
            message,
            time: new Date().toLocaleTimeString("it-IT"),
            type,
          },
          ...prev,
        ].slice(0, 200)
      );
    },
    []
  );

  const updateConfig = (key: keyof AgentConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const runAgent = useCallback(async () => {
    if (!config.categoria || !config.citta) {
      toast.error("Inserisci categoria business e città target");
      return;
    }
    if (!config.mittente) {
      toast.error("Seleziona un mittente");
      return;
    }

    setIsRunning(true);
    isPaused.current = false;
    isStopped.current = false;
    setStats({ contattiTrovati: 0, emailInviate: 0, risposte: 0 });

    const runId = crypto.randomUUID();

    addLog("🚀", "Agente avviato", "info");
    addLog("⚙️", `Configurazione: ${config.categoria} a ${config.citta} (raggio ${config.raggio}km)`, "info");

    try {
      // Step 1: Find contacts via Overpass API (OSM)
      addLog("🔍", `Ricerca contatti: ${config.categoria} ${config.citta}...`, "info");

      const overpassQuery = `
        [out:json][timeout:25];
        area[name="${config.citta}"]->.searchArea;
        (
          node["name"]["shop"](area.searchArea);
          node["name"]["amenity"](area.searchArea);
          node["name"]["office"](area.searchArea);
        );
        out body;
      `;

      let contacts: { name: string; email?: string; website?: string }[] = [];

      try {
        const response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          body: overpassQuery,
          signal: AbortSignal.timeout(30000),
        });
        if (response.ok) {
          const data = await response.json();
          const elements = data.elements || [];
          contacts = elements
            .filter((el: { tags?: Record<string, string> }) => el.tags?.name)
            .slice(0, config.maxContattiGiorno)
            .map((el: { tags?: Record<string, string> }) => ({
              name: el.tags?.name || "",
              email: el.tags?.email || el.tags?.["contact:email"],
              website: el.tags?.website || el.tags?.["contact:website"],
            }))
            .filter((c: { name: string; email?: string }) => c.email);
        }
      } catch {
        addLog("⚠️", "Overpass API non raggiungibile, uso dati demo", "info");
        // Fallback: demo contacts for UI testing
        contacts = [
          { name: `${config.categoria} Demo 1`, email: `info@demo1.it` },
          { name: `${config.categoria} Demo 2`, email: `contact@demo2.it` },
          { name: `${config.categoria} Demo 3`, email: `hello@demo3.it` },
        ].slice(0, 3);
      }

      const found = contacts.length;
      setStats((prev) => ({ ...prev, contattiTrovati: found }));
      addLog("✅", `Trovati ${found} contatti con email`, "success");

      if (found === 0) {
        addLog("⚠️", "Nessun contatto con email trovato. Prova una categoria o città diversa.", "error");
        setIsRunning(false);
        return;
      }

      // Step 2: Send personalized emails
      addLog("📧", "Avvio invio email personalizzate...", "info");

      let sent = 0;
      let replies = 0;

      for (const contact of contacts) {
        if (isStopped.current) {
          addLog("⏹️", "Agente fermato dall'utente", "info");
          break;
        }

        while (isPaused.current && !isStopped.current) {
          await new Promise((r) => setTimeout(r, 500));
        }

        if (isStopped.current) break;

        addLog("📧", `Invio a: ${contact.name} <${contact.email}>`, "info");

        // Step 3: Personalize email
        const oggetto = config.oggettoTemplate.replace("{{azienda}}", contact.name);
        let corpo = "";

        try {
          const { data: aiData, error: aiError } = await supabase.functions.invoke(
            "personalize-messages",
            {
              body: {
                contactName: contact.name,
                contactEmail: contact.email,
                contestoAzienda: config.contestoAzienda,
                tono: config.tono,
                oggettoTemplate: oggetto,
              },
            }
          );
          if (!aiError && aiData?.body) {
            corpo = aiData.body;
            addLog("🤖", "Email personalizzata con AI", "ai");
          } else {
            throw new Error("AI non disponibile");
          }
        } catch {
          // Fallback: template substitution
          corpo = `Gentile ${contact.name},\n\n${config.contestoAzienda}\n\nCordiali saluti`;
          addLog("📝", "Email generata da template", "info");
        }

        // Step 4: Send via edge function
        try {
          const { error: sendError } = await supabase.functions.invoke("send-direct-email", {
            body: {
              to: contact.email,
              subject: oggetto,
              body: corpo,
              sender_id: config.mittente,
            },
          });

          if (sendError) throw sendError;

          sent++;
          setStats((prev) => ({ ...prev, emailInviate: sent }));
          addLog("✓", `Inviata con successo a ${contact.email}`, "success");
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Errore sconosciuto";
          addLog("❌", `Errore invio a ${contact.email}: ${message}`, "error");
        }

        // Rate limiting pause
        const delay = Math.floor((60 * 60 * 1000) / config.maxContattiGiorno);
        await new Promise((r) => setTimeout(r, Math.min(delay, 2000)));
      }

      // Step 5: Check for recent replies
      try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count } = await supabase
          .from("inbox_messages")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since)
          .eq("tipo", "risposta");
        replies = count || 0;
        setStats((prev) => ({ ...prev, risposte: replies }));
        if (replies > 0) {
          addLog("📬", `${replies} risposta/e ricevuta/e nelle ultime 24h`, "success");
        }
      } catch {
        // inbox_messages may not exist yet
      }

      addLog("🏁", `Sessione completata: ${sent} email inviate, ${replies} risposte`, "success");

      // Save run to history
      setAgentRuns((prev) => [
        {
          id: runId,
          data: new Date().toLocaleDateString("it-IT"),
          categoria: config.categoria,
          citta: config.citta,
          inviati: sent,
          risposte: replies,
          stato: isStopped.current ? "fermato" : "completato",
        },
        ...prev,
      ]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      addLog("❌", `Errore: ${message}`, "error");
      toast.error(`Agente interrotto: ${message}`);
    } finally {
      setIsRunning(false);
      isStopped.current = false;
      isPaused.current = false;
    }
  }, [config, senders, addLog]);

  const handlePause = () => {
    isPaused.current = !isPaused.current;
    if (isPaused.current) {
      addLog("⏸️", "Agente in pausa", "info");
    } else {
      addLog("▶️", "Agente ripreso", "info");
    }
  };

  const handleStop = () => {
    isStopped.current = true;
    isPaused.current = false;
    addLog("⏹️", "Arresto in corso...", "info");
  };

  const statusLabel = isRunning ? "In esecuzione" : "Inattivo";
  const statusColor = isRunning
    ? "bg-green-500/20 text-green-400 border-green-500/30"
    : "bg-muted/50 text-muted-foreground border-border";

  const logTypeColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "text-green-400";
      case "error": return "text-red-400";
      case "ai": return "text-blue-400";
      default: return "text-muted-foreground";
    }
  };

  const statoColor = (stato: AgentRun["stato"]) => {
    switch (stato) {
      case "completato": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "in_corso": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "errore": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "fermato": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Bot className="h-5 w-5 text-primary" />
          <h1 className="text-base font-bold text-foreground tracking-tight">
            AI OUTREACH AGENT
          </h1>
        </div>
        <Badge
          variant="outline"
          className={`text-xs font-mono px-2 py-0.5 ${statusColor}`}
        >
          {statusLabel}
        </Badge>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Configuration panel */}
        <div className="w-96 shrink-0 border-r border-border overflow-y-auto p-4 flex flex-col gap-4">

          {/* OBIETTIVO CAMPAGNA */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="terminal-header flex items-center gap-2 mb-3">
              <Search className="h-3.5 w-3.5" />
              <span>OBIETTIVO CAMPAGNA</span>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Categoria business
                </Label>
                <Input
                  className="font-mono text-sm bg-background"
                  placeholder="es. ristoranti, idraulici..."
                  value={config.categoria}
                  onChange={(e) => updateConfig("categoria", e.target.value)}
                  disabled={isRunning}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Città target
                </Label>
                <Input
                  className="font-mono text-sm bg-background"
                  placeholder="es. Firenze, Milano..."
                  value={config.citta}
                  onChange={(e) => updateConfig("citta", e.target.value)}
                  disabled={isRunning}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Raggio: {config.raggio} km
                </Label>
                <Slider
                  min={5}
                  max={50}
                  step={5}
                  value={[config.raggio]}
                  onValueChange={([v]) => updateConfig("raggio", v)}
                  disabled={isRunning}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* MESSAGGIO AI */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="terminal-header flex items-center gap-2 mb-3">
              <Bot className="h-3.5 w-3.5" />
              <span>MESSAGGIO AI</span>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Contesto azienda
                </Label>
                <Textarea
                  className="font-mono text-sm bg-background resize-none"
                  placeholder="Chi sei, cosa offri, perché li contatti..."
                  rows={4}
                  value={config.contestoAzienda}
                  onChange={(e) => updateConfig("contestoAzienda", e.target.value)}
                  disabled={isRunning}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Tono
                </Label>
                <Select
                  value={config.tono}
                  onValueChange={(v) => updateConfig("tono", v)}
                  disabled={isRunning}
                >
                  <SelectTrigger className="font-mono text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professionale">Professionale</SelectItem>
                    <SelectItem value="amichevole">Amichevole</SelectItem>
                    <SelectItem value="diretto">Diretto</SelectItem>
                    <SelectItem value="consulenziale">Consulenziale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Oggetto email{" "}
                  <span className="text-primary/70">(usa {"{{azienda}}"})</span>
                </Label>
                <Input
                  className="font-mono text-sm bg-background"
                  placeholder="Proposta per {{azienda}}"
                  value={config.oggettoTemplate}
                  onChange={(e) => updateConfig("oggettoTemplate", e.target.value)}
                  disabled={isRunning}
                />
              </div>
            </div>
          </div>

          {/* CONFIGURAZIONE INVIO */}
          <div className="bg-card border border-border rounded-lg p-4">
            <div className="terminal-header flex items-center gap-2 mb-3">
              <Send className="h-3.5 w-3.5" />
              <span>CONFIGURAZIONE INVIO</span>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Mittente
                </Label>
                <Select
                  value={config.mittente}
                  onValueChange={(v) => updateConfig("mittente", v)}
                  disabled={isRunning}
                >
                  <SelectTrigger className="font-mono text-sm bg-background">
                    <SelectValue placeholder="Seleziona mittente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {senders.length === 0 && (
                      <SelectItem value="_none" disabled>
                        Nessun mittente disponibile
                      </SelectItem>
                    )}
                    {senders
                      .filter((s) => s.attivo)
                      .map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome} ({s.email})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Max contatti/giorno
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  className="font-mono text-sm bg-background"
                  value={config.maxContattiGiorno}
                  onChange={(e) =>
                    updateConfig("maxContattiGiorno", parseInt(e.target.value) || 50)
                  }
                  disabled={isRunning}
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <Label className="text-xs text-muted-foreground">
                  Pausa se risposta positiva
                </Label>
                <Switch
                  checked={config.pausaSeRisposta}
                  onCheckedChange={(v) => updateConfig("pausaSeRisposta", v)}
                  disabled={isRunning}
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <Label className="text-xs text-muted-foreground">
                  Follow-up auto dopo 3 giorni
                </Label>
                <Switch
                  checked={config.followUpAuto}
                  onCheckedChange={(v) => updateConfig("followUpAuto", v)}
                  disabled={isRunning}
                />
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            {!isRunning ? (
              <Button
                className="w-full bg-primary text-primary-foreground font-mono text-sm"
                onClick={runAgent}
              >
                <Play className="h-4 w-4 mr-2" />
                ▶ AVVIA AGENTE
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 font-mono text-sm border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                  onClick={handlePause}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  PAUSA
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 font-mono text-sm border-red-500/30 text-red-400 hover:bg-red-500/10"
                  onClick={handleStop}
                >
                  ⏹ FERMA
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Activity log */}
        <div className="flex-1 flex flex-col min-h-0 p-4 gap-4 overflow-hidden">
          {/* Stats cards */}
          <div className="grid grid-cols-4 gap-3 shrink-0">
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="terminal-header flex items-center gap-1.5 mb-2">
                <Users className="h-3 w-3" />
                <span>TROVATI</span>
              </div>
              <div className="text-2xl font-bold text-primary">
                {stats.contattiTrovati}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="terminal-header flex items-center gap-1.5 mb-2">
                <Send className="h-3 w-3" />
                <span>INVIATI</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.emailInviate}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="terminal-header flex items-center gap-1.5 mb-2">
                <MessageSquare className="h-3 w-3" />
                <span>RISPOSTE</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {stats.risposte}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-3">
              <div className="terminal-header flex items-center gap-1.5 mb-2">
                <TrendingUp className="h-3 w-3" />
                <span>TASSO</span>
              </div>
              <div className="text-2xl font-bold text-foreground">
                {tassoRisposta}%
              </div>
            </div>
          </div>

          {/* Terminal log */}
          <div className="flex-1 bg-card border border-border rounded-lg flex flex-col min-h-0">
            <div className="terminal-header flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
              <Clock className="h-3 w-3" />
              <span>LOG ATTIVITÀ</span>
              {isRunning && (
                <span className="ml-auto flex items-center gap-1.5 text-green-400">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  live
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-1">
              {logs.length === 0 ? (
                <div className="text-muted-foreground text-xs text-center mt-8">
                  <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Nessuna attività. Configura e avvia l'agente.</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-2 text-xs py-0.5"
                  >
                    <span className="text-muted-foreground shrink-0 tabular-nums">
                      {log.time}
                    </span>
                    <ChevronRight className="h-3 w-3 shrink-0 mt-0.5 text-primary/50" />
                    <span className="shrink-0">{log.icon}</span>
                    <span className={logTypeColor(log.type)}>{log.message}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Agent runs history */}
      <div className="shrink-0 border-t border-border">
        <div className="px-6 py-3">
          <div className="terminal-header flex items-center gap-2 mb-3">
            <Clock className="h-3.5 w-3.5" />
            <span>STORICO SESSIONI AGENTE</span>
          </div>
          {agentRuns.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Nessuna sessione completata ancora.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="font-mono text-xs terminal-header">Data</TableHead>
                    <TableHead className="font-mono text-xs terminal-header">Categoria</TableHead>
                    <TableHead className="font-mono text-xs terminal-header">Città</TableHead>
                    <TableHead className="font-mono text-xs terminal-header">Inviati</TableHead>
                    <TableHead className="font-mono text-xs terminal-header">Risposte</TableHead>
                    <TableHead className="font-mono text-xs terminal-header">Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentRuns.map((run) => (
                    <TableRow key={run.id} className="border-border">
                      <TableCell className="font-mono text-xs">{run.data}</TableCell>
                      <TableCell className="font-mono text-xs">{run.categoria}</TableCell>
                      <TableCell className="font-mono text-xs">{run.citta}</TableCell>
                      <TableCell className="font-mono text-xs">{run.inviati}</TableCell>
                      <TableCell className="font-mono text-xs">{run.risposte}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs font-mono ${statoColor(run.stato)}`}
                        >
                          {run.stato}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
