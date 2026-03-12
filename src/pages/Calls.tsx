import { useState, useEffect, useCallback, useRef } from "react";
import {
  Phone, PhoneCall, PhoneOff, PhoneMissed, Clock, TrendingUp,
  Euro, Mic, FileText, Play, RefreshCw, Search, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KpiCard } from "@/components/shared/KpiCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { CallSession, Contact } from "@/types";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ── Helpers ──────────────────────────────────────────────────────────
const esitoBadge: Record<string, { label: string; cls: string }> = {
  interessato: { label: "Interessato", cls: "bg-green-600/20 text-green-400 border-green-600/30" },
  appuntamento: { label: "Appuntamento", cls: "bg-purple-600/20 text-purple-400 border-purple-600/30" },
  richiama: { label: "Richiama", cls: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" },
  non_interessato: { label: "Non interessato", cls: "bg-muted text-muted-foreground border-border" },
  da_analizzare: { label: "Da analizzare", cls: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
  altro: { label: "Altro", cls: "bg-muted text-muted-foreground border-border" },
};

const statoBadge: Record<string, { label: string; cls: string }> = {
  calling: { label: "In corso", cls: "bg-green-600/20 text-green-400 border-green-600/30 animate-pulse" },
  scheduled: { label: "Schedulata", cls: "bg-blue-600/20 text-blue-400 border-blue-600/30" },
  completed: { label: "Completata", cls: "bg-muted text-muted-foreground border-border" },
  no_answer: { label: "No risposta", cls: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30" },
  busy: { label: "Occupato", cls: "bg-orange-600/20 text-orange-400 border-orange-600/30" },
  failed: { label: "Fallita", cls: "bg-destructive/20 text-destructive border-destructive/30" },
  voicemail: { label: "Segreteria", cls: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Annullata", cls: "bg-muted text-muted-foreground border-border" },
};

const sentimentEmoji: Record<string, string> = { positivo: "😊", neutro: "😐", negativo: "😞" };

function fmtDurata(sec: number | null) {
  if (!sec) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── Main Component ───────────────────────────────────────────────────
export default function Calls() {
  const [tab, setTab] = useState("live");
  const [calls, setCalls] = useState<(CallSession & { contacts?: Pick<Contact, "id" | "nome" | "cognome" | "azienda" | "telefono"> })[]>([]);
  const [liveCalls, setLiveCalls] = useState<(CallSession & { contacts?: Pick<Contact, "id" | "nome" | "cognome" | "azienda" | "telefono"> })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<(typeof calls)[0] | null>(null);
  const [showNewCall, setShowNewCall] = useState(false);

  // Filters
  const [filterStato, setFilterStato] = useState("all");
  const [filterEsito, setFilterEsito] = useState("all");
  const [filterPeriodo, setFilterPeriodo] = useState("oggi");

  // KPIs
  const [kpis, setKpis] = useState({ totale: 0, completate: 0, interessati: 0, costo: 0 });

  // Analytics
  const [chartData, setChartData] = useState<{ giorno: string; chiamate: number }[]>([]);

  // Live timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [tick, setTick] = useState(0);

  const fetchCalls = useCallback(async () => {
    let query = supabase
      .from("call_sessions")
      .select("*, contacts(id, nome, cognome, azienda, telefono)")
      .order("created_at", { ascending: false });

    const now = new Date();
    if (filterPeriodo === "oggi") {
      query = query.gte("created_at", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());
    } else if (filterPeriodo === "7gg") {
      query = query.gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
    } else if (filterPeriodo === "30gg") {
      query = query.gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
    }

    if (filterStato !== "all") query = query.eq("stato", filterStato);
    if (filterEsito !== "all") query = query.eq("esito", filterEsito);

    const { data, error } = await query.limit(200);
    if (error) { console.error(error.message); toast.error("Errore caricamento chiamate"); }
    setCalls((data as unknown as typeof calls) || []);
    setLoading(false);
  }, [filterStato, filterEsito, filterPeriodo]);

  const fetchLive = useCallback(async () => {
    const { data } = await supabase
      .from("call_sessions")
      .select("*, contacts(id, nome, cognome, azienda, telefono)")
      .in("stato", ["calling", "scheduled"])
      .order("created_at", { ascending: false });
    setLiveCalls((data as unknown as typeof liveCalls) || []);
  }, []);

  const fetchKpis = useCallback(async () => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("call_sessions")
      .select("stato, esito, costo_eur")
      .gte("created_at", todayStart.toISOString());
    if (!data) return;
    setKpis({
      totale: data.length,
      completate: data.filter((c) => c.stato === "completed").length,
      interessati: data.filter((c) => c.esito === "interessato" || c.esito === "appuntamento").length,
      costo: data.reduce((s, c) => s + Number(c.costo_eur || 0), 0),
    });
  }, []);

  const fetchChart = useCallback(async () => {
    const sevenDaysAgo = new Date(Date.now() - 6 * 86400000);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const { data } = await supabase
      .from("call_sessions")
      .select("created_at")
      .gte("created_at", sevenDaysAgo.toISOString());

    // Group by day client-side
    const countByDay: Record<string, number> = {};
    (data || []).forEach((c) => {
      const day = new Date(c.created_at).toISOString().slice(0, 10);
      countByDay[day] = (countByDay[day] || 0) + 1;
    });

    const days: { giorno: string; chiamate: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      days.push({ giorno: format(d, "EEE dd", { locale: it }), chiamate: countByDay[key] || 0 });
    }
    setChartData(days);
  }, []);

  useEffect(() => {
    fetchCalls();
    fetchLive();
    fetchKpis();
    fetchChart();
  }, [fetchCalls, fetchLive, fetchKpis, fetchChart]);

  // Realtime for live
  useEffect(() => {
    const channel = supabase
      .channel("call_sessions_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "call_sessions" }, () => {
        fetchLive();
        fetchKpis();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLive, fetchKpis]);

  // Live timer
  useEffect(() => {
    timerRef.current = setInterval(() => setTick((t) => t + 1), 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function liveDurata(call: CallSession) {
    if (!call.started_at) return "—";
    const sec = Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
    return fmtDurata(sec);
  }

  const liveCount = liveCalls.filter((c) => c.stato === "calling").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold font-mono text-foreground">📞 CHIAMATE AI</h1>
          {liveCount > 0 && (
            <Badge className="bg-green-600/20 text-green-400 border-green-600/30 animate-pulse">{liveCount} live</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchCalls(); fetchLive(); fetchKpis(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Ricarica
          </Button>
          <Button size="sm" onClick={() => setShowNewCall(true)}>
            <Phone className="h-4 w-4 mr-1" /> Nuova chiamata
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="TOTALE OGGI" value={kpis.totale} icon={<Phone className="h-4 w-4" />} />
        <KpiCard label="COMPLETATE" value={`${kpis.completate} (${kpis.totale ? Math.round((kpis.completate / kpis.totale) * 100) : 0}%)`} icon={<PhoneCall className="h-4 w-4" />} />
        <KpiCard label="INTERESSATI" value={kpis.interessati} icon={<TrendingUp className="h-4 w-4" />} />
        <KpiCard label="COSTO OGGI" value={`€${kpis.costo.toFixed(2)}`} icon={<Euro className="h-4 w-4" />} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="live">Live {liveCount > 0 && `(${liveCount})`}</TabsTrigger>
          <TabsTrigger value="storico">Storico</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ── LIVE ──────────────────────────────────────────── */}
        <TabsContent value="live">
          {liveCalls.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground font-mono text-sm">
              Nessuna chiamata in corso o schedulata
            </div>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Azienda</TableHead>
                    <TableHead>Numero</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Durata</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {liveCalls.map((c) => {
                    const sb = statoBadge[c.stato] || statoBadge.calling;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono text-sm">{c.contacts?.azienda || "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{c.phone_number_to}</TableCell>
                        <TableCell><Badge className={sb.cls}>{sb.label}</Badge></TableCell>
                        <TableCell className="font-mono text-sm">{c.stato === "calling" ? liveDurata(c) : "—"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={async () => {
                            await supabase.from("call_sessions").update({ stato: "cancelled" }).eq("id", c.id);
                            fetchLive();
                            toast.success("Chiamata annullata");
                          }}>
                            <PhoneOff className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── STORICO ───────────────────────────────────────── */}
        <TabsContent value="storico">
          <div className="flex flex-wrap gap-2 mb-4">
            <Select value={filterStato} onValueChange={setFilterStato}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Stato" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="completed">Completata</SelectItem>
                <SelectItem value="no_answer">No risposta</SelectItem>
                <SelectItem value="busy">Occupato</SelectItem>
                <SelectItem value="failed">Fallita</SelectItem>
                <SelectItem value="voicemail">Segreteria</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterEsito} onValueChange={setFilterEsito}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Esito" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli esiti</SelectItem>
                <SelectItem value="interessato">Interessato</SelectItem>
                <SelectItem value="appuntamento">Appuntamento</SelectItem>
                <SelectItem value="richiama">Richiama</SelectItem>
                <SelectItem value="non_interessato">Non interessato</SelectItem>
                <SelectItem value="da_analizzare">Da analizzare</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPeriodo} onValueChange={setFilterPeriodo}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Periodo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="oggi">Oggi</SelectItem>
                <SelectItem value="7gg">Ultimi 7gg</SelectItem>
                <SelectItem value="30gg">Ultimi 30gg</SelectItem>
                <SelectItem value="all">Tutto</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Azienda</TableHead>
                  <TableHead>Numero</TableHead>
                  <TableHead>Data/ora</TableHead>
                  <TableHead>Durata</TableHead>
                  <TableHead>Esito</TableHead>
                  <TableHead>Sent.</TableHead>
                  <TableHead>Costo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Caricamento...</TableCell></TableRow>
                ) : calls.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nessuna chiamata trovata</TableCell></TableRow>
                ) : calls.map((c) => {
                  const eb = esitoBadge[c.esito || ""] || esitoBadge.da_analizzare;
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelectedCall(c)}>
                      <TableCell className="font-mono text-sm">{c.contacts?.azienda || "—"}</TableCell>
                      <TableCell className="font-mono text-sm">{c.phone_number_to}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{format(new Date(c.created_at), "dd/MM HH:mm", { locale: it })}</TableCell>
                      <TableCell className="font-mono text-sm">{fmtDurata(c.durata_secondi)}</TableCell>
                      <TableCell><Badge className={eb.cls}>{eb.label}</Badge></TableCell>
                      <TableCell>{c.sentiment ? sentimentEmoji[c.sentiment] : "—"}</TableCell>
                      <TableCell className="font-mono text-sm">€{Number(c.costo_eur || 0).toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── ANALYTICS ─────────────────────────────────────── */}
        <TabsContent value="analytics">
          <div className="grid gap-6">
            <div className="rounded-lg border border-border p-4">
              <h3 className="terminal-header mb-4">CHIAMATE ULTIMI 7 GIORNI</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="giorno" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "monospace" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "monospace" }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))", fontFamily: "monospace", fontSize: 12 }} />
                  <Bar dataKey="chiamate" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Detail Dialog ───────────────────────────────────── */}
      <CallDetailDialog call={selectedCall} onClose={() => setSelectedCall(null)} onRefresh={fetchCalls} />

      {/* ── New Call Dialog ──────────────────────────────────── */}
      <NewCallDialog open={showNewCall} onClose={() => setShowNewCall(false)} onSuccess={() => { fetchLive(); fetchKpis(); }} />
    </div>
  );
}

// ── Call Detail Dialog ───────────────────────────────────────────────
function CallDetailDialog({ call, onClose, onRefresh }: {
  call: (CallSession & { contacts?: Pick<Contact, "id" | "nome" | "cognome" | "azienda" | "telefono"> }) | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  if (!call) return null;
  const eb = esitoBadge[call.esito || ""] || esitoBadge.da_analizzare;
  const sb = statoBadge[call.stato] || statoBadge.completed;

  const handleRichiama = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("make-call", {
        body: { contact_id: call.contact_id, campaign_id: call.campaign_id },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (res.error) throw new Error(res.error.message);
      toast.success("Chiamata avviata!");
      onClose();
      onRefresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore avvio chiamata");
    }
  };

  return (
    <Dialog open={!!call} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Phone className="h-4 w-4" />
            {call.contacts?.azienda || "Chiamata"} — {call.contacts?.nome || ""} {call.contacts?.cognome || ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status & esito */}
          <div className="flex gap-2 flex-wrap">
            <Badge className={sb.cls}>{sb.label}</Badge>
            {call.esito && <Badge className={eb.cls}>{eb.label}</Badge>}
            {call.sentiment && <span className="text-lg">{sentimentEmoji[call.sentiment]}</span>}
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-sm font-mono">
            <div><span className="text-muted-foreground">Durata:</span> {fmtDurata(call.durata_secondi)}</div>
            <div><span className="text-muted-foreground">Costo:</span> €{Number(call.costo_eur || 0).toFixed(2)}</div>
            <div><span className="text-muted-foreground">Inizio:</span> {call.started_at ? format(new Date(call.started_at), "dd/MM/yy HH:mm:ss") : "—"}</div>
            <div><span className="text-muted-foreground">Fine:</span> {call.ended_at ? format(new Date(call.ended_at), "dd/MM/yy HH:mm:ss") : "—"}</div>
          </div>

          {/* Riassunto AI */}
          {call.riassunto_ai && (
            <div>
              <h4 className="terminal-header mb-1">RIASSUNTO AI</h4>
              <p className="text-sm font-mono bg-muted/50 rounded p-3 border border-border">{call.riassunto_ai}</p>
            </div>
          )}

          {/* Note AI */}
          {call.note_ai && (
            <div>
              <h4 className="terminal-header mb-1">NOTE AI</h4>
              <p className="text-sm font-mono bg-muted/50 rounded p-3 border border-border">{call.note_ai}</p>
            </div>
          )}

          {/* Trascrizione */}
          {call.trascrizione && (
            <div>
              <h4 className="terminal-header mb-1">TRASCRIZIONE</h4>
              <div className="bg-card rounded p-3 border border-border font-mono text-xs space-y-1 max-h-64 overflow-y-auto">
                {call.trascrizione.split("\n").map((line, i) => {
                  const isAgent = line.startsWith("Agente:");
                  const isLead = line.startsWith("Lead:");
                  return (
                    <div key={i} className={isAgent ? "text-blue-400" : isLead ? "text-green-400" : "text-muted-foreground"}>
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Azioni */}
          <div className="flex gap-2 flex-wrap pt-2">
            {call.recording_url && (
              <Button variant="outline" size="sm" asChild>
                <a href={call.recording_url} target="_blank" rel="noreferrer">
                  <Play className="h-4 w-4 mr-1" /> Ascolta registrazione
                </a>
              </Button>
            )}
            {call.esito === "richiama" && (
              <Button size="sm" onClick={handleRichiama}>
                <Phone className="h-4 w-4 mr-1" /> Richiama
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── New Call Dialog ──────────────────────────────────────────────────
function NewCallDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<Pick<Contact, "id" | "nome" | "cognome" | "azienda" | "telefono">[]>([]);
  const [selected, setSelected] = useState<typeof results[0] | null>(null);
  const [obiettivo, setObiettivo] = useState("");
  const [contesto, setContesto] = useState("");
  const [schedula, setSchedula] = useState(false);
  const [schedulaAt, setSchedulaAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!searchQ || searchQ.length < 2) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, nome, cognome, azienda, telefono")
        .or(`azienda.ilike.%${searchQ}%,nome.ilike.%${searchQ}%`)
        .not("telefono", "is", null)
        .limit(10);
      setResults((data as typeof results) || []);
    }, 300);
  }, [searchQ]);

  const handleSubmit = async () => {
    if (!selected) { toast.error("Seleziona un contatto"); return; }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("make-call", {
        body: {
          contact_id: selected.id,
          obiettivo: obiettivo || undefined,
          script_contesto: contesto || undefined,
          scheduled_at: schedula && schedulaAt ? new Date(schedulaAt).toISOString() : undefined,
        },
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      if (res.error) throw new Error(res.error.message);
      toast.success(schedula ? "Chiamata schedulata!" : "Chiamata avviata!");
      onSuccess();
      onClose();
      // Reset
      setSearchQ(""); setSelected(null); setObiettivo(""); setContesto(""); setSchedula(false);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="font-mono">Nuova Chiamata AI</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Search */}
          <div>
            <Label className="text-xs font-mono">Cerca contatto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Nome o azienda..." value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setSelected(null); }} />
            </div>
            {results.length > 0 && !selected && (
              <div className="mt-1 border border-border rounded-md bg-card max-h-40 overflow-y-auto">
                {results.map((r) => (
                  <button key={r.id} className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm font-mono flex items-center gap-2" onClick={() => setSelected(r)}>
                    <span className="font-medium">{r.azienda}</span>
                    <span className="text-muted-foreground">— {r.nome || ""} {r.cognome || ""}</span>
                    <Badge variant="outline" className="ml-auto text-xs">{r.telefono}</Badge>
                  </button>
                ))}
              </div>
            )}
            {selected && (
              <div className="mt-1 flex items-center gap-2">
                <Badge className="bg-primary/20 text-primary border-primary/30">{selected.azienda} — {selected.telefono}</Badge>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelected(null)}>Cambia</Button>
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-mono">Obiettivo</Label>
            <Textarea placeholder="Es: Fissa una demo di 30 minuti" rows={2} value={obiettivo} onChange={(e) => setObiettivo(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs font-mono">Contesto</Label>
            <Textarea placeholder="Es: Il lead ha aperto la nostra email 3 volte" rows={2} value={contesto} onChange={(e) => setContesto(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={schedula} onCheckedChange={setSchedula} />
            <Label className="text-xs font-mono">Schedula per dopo</Label>
          </div>
          {schedula && (
            <Input type="datetime-local" value={schedulaAt} onChange={(e) => setSchedulaAt(e.target.value)} />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={submitting || !selected}>
            <Phone className="h-4 w-4 mr-1" /> {schedula ? "Schedula" : "Avvia chiamata"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
