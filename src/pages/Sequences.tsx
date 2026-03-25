import { useState, useEffect, useMemo } from "react";
import {
  Plus, Play, Pause, Trash2, Users, Mail, Clock, ChevronLeft,
  Search, CheckSquare, Square, Send, RefreshCw, GitBranch, AlertCircle, Check
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SequenceStep {
  id?: string;
  step_number: number;
  delay_days: number;
  subject: string;
  body: string;
}

interface Sequence {
  id: string;
  nome: string;
  descrizione: string | null;
  status: "bozza" | "attiva" | "archiviata";
  created_at: string;
  _enrolledActive: number;
  _enrolledCompleted: number;
  _emailsSent: number;
}

interface Enrollment {
  id: string;
  contact_id: string;
  sender_id: string | null;
  current_step: number;
  status: string;
  enrolled_at: string;
  last_sent_at: string | null;
  next_send_at: string;
  contacts: { nome: string | null; azienda: string | null; email: string | null };
}

interface ContactRow {
  id: string;
  nome: string | null;
  azienda: string | null;
  email: string;
}

interface Sender {
  id: string;
  nome: string;
  email_from: string;
  email_nome: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  if (status === "attiva") return <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-[10px]">Attiva</Badge>;
  if (status === "completata") return <Badge className="bg-primary/15 text-primary border-primary/30 text-[10px]">Completata</Badge>;
  if (status === "fermata") return <Badge variant="secondary" className="text-[10px]">Fermata</Badge>;
  if (status === "errore") return <Badge variant="destructive" className="text-[10px]">Errore</Badge>;
  return <Badge variant="outline" className="text-[10px]">Bozza</Badge>;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function SequencesPage() {
  const [view, setView] = useState<"list" | "detail">("list");
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selectedSeq, setSelectedSeq] = useState<Sequence | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  // Builder
  const [showBuilder, setShowBuilder] = useState(false);
  const [editSeq, setEditSeq] = useState<Sequence | null>(null);
  const [bNome, setBNome] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [steps, setSteps] = useState<SequenceStep[]>([
    { step_number: 1, delay_days: 0, subject: "", body: "" },
    { step_number: 2, delay_days: 3, subject: "", body: "" },
  ]);
  const [saving, setSaving] = useState(false);

  // Enroll dialog
  const [showEnroll, setShowEnroll] = useState(false);
  const [enrollSeq, setEnrollSeq] = useState<Sequence | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [senders, setSenders] = useState<Sender[]>([]);
  const [selectedSender, setSelectedSender] = useState<string>("");
  const [enrolling, setEnrolling] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(false);

  // Processing
  const [processingSeqId, setProcessingSeqId] = useState<string | null>(null);

  // ─── Load sequences ─────────────────────────────────────────────────────

  const loadSequences = async () => {
    setLoading(true);
    const userId = await getCurrentUserId();
    const { data } = await supabase
      .from("email_sequences")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    const withStats = await Promise.all(data.map(async (seq: any) => {
      const [{ count: active }, { count: completed }, { count: sent }] = await Promise.all([
        supabase.from("sequence_enrollments").select("*", { count: "exact", head: true }).eq("sequence_id", seq.id).eq("status", "attiva"),
        supabase.from("sequence_enrollments").select("*", { count: "exact", head: true }).eq("sequence_id", seq.id).eq("status", "completata"),
        supabase.from("sequence_sends").select("*", { count: "exact", head: true })
          .eq("status", "inviato")
          .in("enrollment_id",
            supabase.from("sequence_enrollments").select("id").eq("sequence_id", seq.id) as any
          ),
      ]);
      return { ...seq, _enrolledActive: active ?? 0, _enrolledCompleted: completed ?? 0, _emailsSent: sent ?? 0 };
    }));
    setSequences(withStats);
    setLoading(false);
  };

  useEffect(() => { loadSequences(); }, []);

  // ─── Load enrollments for detail view ───────────────────────────────────

  const loadEnrollments = async (seqId: string) => {
    setLoadingEnrollments(true);
    const { data } = await supabase
      .from("sequence_enrollments")
      .select("id, contact_id, sender_id, current_step, status, enrolled_at, last_sent_at, next_send_at, contacts(nome, azienda, email)")
      .eq("sequence_id", seqId)
      .order("enrolled_at", { ascending: false })
      .limit(200);
    setEnrollments((data ?? []) as any);
    setLoadingEnrollments(false);
  };

  const openDetail = (seq: Sequence) => {
    setSelectedSeq(seq);
    setView("detail");
    loadEnrollments(seq.id);
  };

  // ─── Process sequences ───────────────────────────────────────────────────

  const processSequence = async (seq: Sequence) => {
    if (seq.status !== "attiva") {
      toast.error("Attiva prima la sequenza per processarla");
      return;
    }
    setProcessingSeqId(seq.id);
    try {
      const res = await supabase.functions.invoke("run-sequences", {
        body: { sequence_id: seq.id },
      });
      const d = res.data as any;
      if (d?.ok) {
        toast.success(`Processati: ${d.sent ?? 0} email inviati${d.errors ? `, ${d.errors} errori` : ""}`);
        loadSequences();
        if (view === "detail" && selectedSeq?.id === seq.id) loadEnrollments(seq.id);
      } else {
        toast.error(d?.error ?? res.error?.message ?? "Errore");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Errore");
    } finally {
      setProcessingSeqId(null);
    }
  };

  // ─── Builder ─────────────────────────────────────────────────────────────

  const openBuilder = (seq?: Sequence) => {
    if (seq) {
      setEditSeq(seq);
      setBNome(seq.nome);
      setBDesc(seq.descrizione ?? "");
      supabase.from("sequence_steps").select("*").eq("sequence_id", seq.id).order("step_number")
        .then(({ data }) => { if (data) setSteps(data as any); });
    } else {
      setEditSeq(null);
      setBNome(""); setBDesc("");
      setSteps([
        { step_number: 1, delay_days: 0, subject: "", body: "" },
        { step_number: 2, delay_days: 3, subject: "", body: "" },
      ]);
    }
    setShowBuilder(true);
  };

  const addStep = () => {
    const last = steps[steps.length - 1]?.delay_days ?? 0;
    setSteps(s => [...s, { step_number: s.length + 1, delay_days: last + 3, subject: "", body: "" }]);
  };

  const removeStep = (i: number) => setSteps(s =>
    s.filter((_, idx) => idx !== i).map((st, idx) => ({ ...st, step_number: idx + 1 }))
  );

  const updateStep = (i: number, field: keyof SequenceStep, value: string | number) =>
    setSteps(s => s.map((st, idx) => idx === i ? { ...st, [field]: value } : st));

  const saveSequence = async () => {
    if (!bNome.trim()) { toast.error("Inserisci un nome"); return; }
    if (steps.some(s => !s.subject.trim() || !s.body.trim())) {
      toast.error("Tutti gli step devono avere oggetto e testo");
      return;
    }
    setSaving(true);
    try {
      const userId = await getCurrentUserId();
      let seqId: string;
      if (editSeq) {
        await supabase.from("email_sequences").update({ nome: bNome, descrizione: bDesc, updated_at: new Date().toISOString() }).eq("id", editSeq.id);
        seqId = editSeq.id;
        await supabase.from("sequence_steps").delete().eq("sequence_id", seqId);
      } else {
        const { data, error } = await supabase.from("email_sequences")
          .insert({ user_id: userId, nome: bNome, descrizione: bDesc, status: "bozza" })
          .select().single();
        if (error) throw error;
        seqId = data.id;
      }
      await supabase.from("sequence_steps").insert(
        steps.map(s => ({ sequence_id: seqId, step_number: s.step_number, delay_days: s.delay_days, subject: s.subject, body: s.body }))
      );
      toast.success(editSeq ? "Sequenza aggiornata ✓" : "Sequenza creata ✓");
      setShowBuilder(false);
      loadSequences();
    } catch (e: any) {
      toast.error(e.message ?? "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle status ───────────────────────────────────────────────────────

  const toggleStatus = async (seq: Sequence, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = seq.status === "attiva" ? "bozza" : "attiva";
    await supabase.from("email_sequences").update({ status: newStatus }).eq("id", seq.id);
    loadSequences();
    toast.success(newStatus === "attiva" ? "Sequenza attivata ✓" : "Sequenza disattivata");
  };

  const deleteSequence = async (seq: Sequence, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Eliminare "${seq.nome}"? Tutti gli iscritti verranno rimossi.`)) return;
    await supabase.from("email_sequences").delete().eq("id", seq.id);
    loadSequences();
    if (view === "detail" && selectedSeq?.id === seq.id) setView("list");
    toast.success("Sequenza eliminata");
  };

  // ─── Pause/unenroll enrollment ───────────────────────────────────────────

  const pauseEnrollment = async (id: string, current: string) => {
    const newStatus = current === "attiva" ? "fermata" : "attiva";
    await supabase.from("sequence_enrollments").update({ status: newStatus }).eq("id", id);
    if (selectedSeq) loadEnrollments(selectedSeq.id);
    toast.success(newStatus === "attiva" ? "Riattivato" : "Iscrizione fermata");
  };

  const deleteEnrollment = async (id: string) => {
    await supabase.from("sequence_enrollments").delete().eq("id", id);
    if (selectedSeq) loadEnrollments(selectedSeq.id);
    loadSequences();
    toast.success("Iscrizione rimossa");
  };

  // ─── Enroll dialog ───────────────────────────────────────────────────────

  const openEnrollDialog = async (seq: Sequence, e: React.MouseEvent) => {
    e.stopPropagation();
    setEnrollSeq(seq);
    setSelectedContacts(new Set());
    setContactSearch("");
    setShowEnroll(true);
    setLoadingContacts(true);

    const userId = await getCurrentUserId();
    const [{ data: cts }, { data: snds }] = await Promise.all([
      supabase.from("contacts").select("id, nome, azienda, email, email_quality").eq("user_id", userId).not("email", "is", null).order("azienda").limit(500),
      supabase.from("sender_pool").select("id, nome, email_from, email_nome").eq("user_id", userId).eq("attivo", true).not("email_from", "is", null),
    ]);

    // Get already enrolled contacts for this sequence
    const { data: alreadyEnrolled } = await supabase
      .from("sequence_enrollments")
      .select("contact_id")
      .eq("sequence_id", seq.id)
      .in("status", ["attiva", "completata"]);

    const enrolledIds = new Set((alreadyEnrolled ?? []).map((e: any) => e.contact_id));
    const filteredContacts = (cts ?? []).filter((c: any) => !enrolledIds.has(c.id));

    setContacts(filteredContacts as any);
    setSenders((snds ?? []) as any);
    if (snds && snds.length > 0) setSelectedSender(snds[0].id);
    setLoadingContacts(false);
  };

  const filteredContacts = useMemo(() => {
    const q = contactSearch.toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c =>
      (c.nome ?? "").toLowerCase().includes(q) ||
      (c.azienda ?? "").toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  const toggleContact = (id: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
  const deselectAll = () => setSelectedContacts(new Set());

  const enrollContacts = async () => {
    if (selectedContacts.size === 0) { toast.error("Seleziona almeno un contatto"); return; }
    if (!selectedSender) { toast.error("Seleziona un mittente"); return; }
    if (!enrollSeq) return;
    setEnrolling(true);

    const userId = await getCurrentUserId();
    const now = new Date().toISOString();
    const rows = Array.from(selectedContacts).map(contactId => ({
      sequence_id: enrollSeq.id,
      contact_id: contactId,
      user_id: userId,
      sender_id: selectedSender,
      current_step: 0,
      status: "attiva",
      enrolled_at: now,
      next_send_at: now,
    }));

    // Check first step delay
    const { data: firstStep } = await supabase
      .from("sequence_steps")
      .select("delay_days")
      .eq("sequence_id", enrollSeq.id)
      .eq("step_number", 1)
      .single();

    if (firstStep && firstStep.delay_days > 0) {
      const sendAt = new Date();
      sendAt.setDate(sendAt.getDate() + firstStep.delay_days);
      rows.forEach(r => r.next_send_at = sendAt.toISOString());
    }

    const { error } = await supabase.from("sequence_enrollments").insert(rows);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${rows.length} contatti iscritti alla sequenza ✓`);
      setShowEnroll(false);
      loadSequences();
      if (view === "detail" && selectedSeq?.id === enrollSeq.id) loadEnrollments(enrollSeq.id);
    }
    setEnrolling(false);
  };

  // ─── Enroll Dialog render ────────────────────────────────────────────────

  function renderEnrollDialog() {
    return (
      <Dialog open={showEnroll} onOpenChange={setShowEnroll}>
        <DialogContent className="max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-mono font-bold">ISCRIVI CONTATTI — {enrollSeq?.nome}</DialogTitle>
          </DialogHeader>

          {enrollSeq?.status === "bozza" && (
            <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-mono">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              La sequenza è in bozza. Attivala per avviare gli invii automatici.
            </div>
          )}

          <div className="flex flex-col gap-3 flex-1 min-h-0">
            {/* Sender */}
            <div>
              <label className="text-[10px] font-mono text-muted-foreground mb-1 block">MITTENTE *</label>
              {senders.length === 0 ? (
                <p className="text-xs text-destructive font-mono">Nessun mittente attivo. Configura un mittente nelle impostazioni.</p>
              ) : (
                <Select value={selectedSender} onValueChange={setSelectedSender}>
                  <SelectTrigger className="font-mono text-xs h-8">
                    <SelectValue placeholder="Seleziona mittente" />
                  </SelectTrigger>
                  <SelectContent>
                    {senders.map(s => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.nome} — {s.email_from}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                placeholder="Cerca contatti…"
                className="pl-8 h-8 font-mono text-xs"
              />
            </div>

            {/* Select all / count */}
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
              <span>{selectedContacts.size} selezionati su {filteredContacts.length} disponibili</span>
              <div className="flex gap-2">
                <button onClick={selectAll} className="text-primary hover:underline">Seleziona tutti</button>
                <button onClick={deselectAll} className="hover:underline">Deseleziona</button>
              </div>
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto border border-border rounded-lg min-h-0 max-h-64">
              {loadingContacts ? (
                <div className="p-4 text-center text-xs text-muted-foreground font-mono">Caricamento…</div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground font-mono">
                  {contacts.length === 0 ? "Nessun contatto con email disponibile" : "Nessun risultato"}
                </div>
              ) : (
                filteredContacts.map(c => {
                  const q = (c as any).email_quality as string | null;
                  const qColor = q === "valid" ? "text-primary" : q === "risky" ? "text-yellow-500" : q === "invalid" ? "text-destructive" : "text-muted-foreground";
                  const qLabel = q === "valid" ? "✓" : q === "risky" ? "⚠" : q === "invalid" ? "✗" : "?";
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 px-3 py-2 border-b border-border cursor-pointer hover:bg-primary/5 last:border-b-0"
                      onClick={() => toggleContact(c.id)}
                    >
                      {selectedContacts.has(c.id)
                        ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                        : <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.azienda ?? c.nome ?? "—"}</p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">{c.email}</p>
                      </div>
                      <span className={`font-mono text-[10px] shrink-0 ${qColor}`} title={q ?? "Non verificata"}>{qLabel}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Warning for risky/invalid selected contacts */}
            {(() => {
              const selectedList = filteredContacts.filter(c => selectedContacts.has(c.id));
              const riskyCount = selectedList.filter(c => (c as any).email_quality === "risky").length;
              const invalidCount = selectedList.filter(c => (c as any).email_quality === "invalid").length;
              const unverifiedCount = selectedList.filter(c => !(c as any).email_quality).length;
              if (invalidCount > 0 || riskyCount > 0 || unverifiedCount > 0) {
                return (
                  <div className="flex items-start gap-2 p-2 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-[10px] font-mono">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      {invalidCount > 0 && `${invalidCount} email invalide (✗), `}
                      {riskyCount > 0 && `${riskyCount} rischiose (⚠), `}
                      {unverifiedCount > 0 && `${unverifiedCount} non verificate (?). `}
                      Vai su Contatti → Verifica Email prima di inviare.
                    </span>
                  </div>
                );
              }
              return null;
            })()}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setShowEnroll(false)}>Annulla</Button>
            <Button onClick={enrollContacts} disabled={enrolling || selectedContacts.size === 0 || !selectedSender}>
              {enrolling ? "Iscrizione…" : `Iscrivi ${selectedContacts.size} contatti`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Detail view ─────────────────────────────────────────────────────────

  if (view === "detail" && selectedSeq) {
    return (
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setView("list")} className="font-mono text-xs">
            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> INDIETRO
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg font-bold tracking-wider">{selectedSeq.nome}</h1>
              {statusBadge(selectedSeq.status)}
            </div>
            {selectedSeq.descrizione && <p className="text-xs text-muted-foreground">{selectedSeq.descrizione}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="font-mono text-[10px] h-7"
              onClick={e => openEnrollDialog(selectedSeq, e)}>
              <Users className="h-3 w-3 mr-1" /> ISCRIVI CONTATTI
            </Button>
            <Button variant="outline" size="sm" className="font-mono text-[10px] h-7"
              disabled={processingSeqId === selectedSeq.id}
              onClick={() => processSequence(selectedSeq)}>
              {processingSeqId === selectedSeq.id
                ? <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> PROCESSANDO…</>
                : <><Send className="h-3 w-3 mr-1" /> PROCESSA ORA</>}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "ATTIVI", value: selectedSeq._enrolledActive, color: "text-green-400" },
            { label: "COMPLETATI", value: selectedSeq._enrolledCompleted, color: "text-primary" },
            { label: "EMAIL INVIATE", value: selectedSeq._emailsSent, color: "text-foreground" },
            { label: "TOTALE ISCRITTI", value: selectedSeq._enrolledActive + selectedSeq._enrolledCompleted, color: "text-foreground" },
          ].map(s => (
            <div key={s.label} className="border border-border rounded-lg bg-card p-3 text-center">
              <div className={`font-mono text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Enrollments table */}
        <div className="border border-border rounded-lg overflow-hidden">
          <div className="bg-accent px-3 py-2 flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold text-muted-foreground">ISCRITTI ({enrollments.length})</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => loadEnrollments(selectedSeq.id)}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          {loadingEnrollments ? (
            <div className="p-6 text-center text-muted-foreground font-mono text-xs">Caricamento…</div>
          ) : enrollments.length === 0 ? (
            <div className="p-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="font-mono text-xs text-muted-foreground">Nessun iscritto ancora</p>
              <Button variant="outline" size="sm" className="mt-3 font-mono text-[10px]"
                onClick={e => openEnrollDialog(selectedSeq, e)}>
                <Plus className="h-3 w-3 mr-1" /> Iscrivi contatti
              </Button>
            </div>
          ) : (
            <div className="overflow-auto max-h-[50vh]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-accent">
                  <tr>
                    {["Contatto", "Email", "Step", "Stato", "Ultimo invio", "Prossimo invio", ""].map(h => (
                      <th key={h} className="text-left px-3 py-2 font-mono text-[10px] text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map(e => (
                    <tr key={e.id} className="border-t border-border hover:bg-primary/5">
                      <td className="px-3 py-2 font-medium">{(e.contacts as any)?.azienda ?? (e.contacts as any)?.nome ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-muted-foreground">{(e.contacts as any)?.email ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-primary">{e.current_step}</td>
                      <td className="px-3 py-2">{statusBadge(e.status)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{fmtDate(e.last_sent_at)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{e.status === "attiva" ? fmtDate(e.next_send_at) : "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0"
                            title={e.status === "attiva" ? "Ferma" : "Riattiva"}
                            onClick={() => pauseEnrollment(e.id, e.status)}>
                            {e.status === "attiva" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive"
                            onClick={() => deleteEnrollment(e.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {renderEnrollDialog()}
      </div>
    );
  }

  // ─── List view ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground">SEQUENZE EMAIL</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Follow-up automatici multi-step</p>
        </div>
        <Button onClick={() => openBuilder()} className="font-mono text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> NUOVA SEQUENZA
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 font-mono text-sm text-muted-foreground">Caricamento…</div>
      ) : sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 border border-dashed border-border rounded-lg">
          <GitBranch className="h-12 w-12 text-muted-foreground" />
          <p className="font-mono text-sm text-muted-foreground">Nessuna sequenza ancora</p>
          <Button variant="outline" onClick={() => openBuilder()}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Crea la prima sequenza
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {sequences.map(seq => (
            <div
              key={seq.id}
              className="border border-border rounded-lg bg-card p-4 cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => openDetail(seq)}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-sm">{seq.nome}</span>
                    {statusBadge(seq.status)}
                  </div>
                  {seq.descrizione && <p className="text-xs text-muted-foreground truncate">{seq.descrizione}</p>}
                  <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {seq._enrolledActive} attivi</span>
                    <span className="flex items-center gap-1"><Check className="h-3 w-3" /> {seq._enrolledCompleted} completati</span>
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {seq._emailsSent} email inviate</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(seq.created_at).toLocaleDateString("it-IT")}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <Button variant="outline" size="sm" className="font-mono text-[10px] h-7"
                    onClick={e => openEnrollDialog(seq, e)}>
                    <Users className="h-3 w-3 mr-1" /> ISCRIVI
                  </Button>
                  <Button variant="outline" size="sm" className="font-mono text-[10px] h-7"
                    disabled={processingSeqId === seq.id}
                    onClick={e => { e.stopPropagation(); processSequence(seq); }}>
                    {processingSeqId === seq.id
                      ? <RefreshCw className="h-3 w-3 animate-spin" />
                      : <><Send className="h-3 w-3 mr-1" /> PROCESSA</>}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                    title={seq.status === "attiva" ? "Disattiva" : "Attiva"}
                    onClick={e => toggleStatus(seq, e)}>
                    {seq.status === "attiva" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="sm" className="font-mono text-[10px] h-7"
                    onClick={e => { e.stopPropagation(); openBuilder(seq); }}>
                    Modifica
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                    onClick={e => deleteSequence(seq, e)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono font-bold">
              {editSeq ? "MODIFICA SEQUENZA" : "NUOVA SEQUENZA"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block">NOME *</label>
                <Input value={bNome} onChange={e => setBNome(e.target.value)} placeholder="es. Follow-up Infissi" className="font-mono text-sm" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground mb-1 block">DESCRIZIONE</label>
                <Input value={bDesc} onChange={e => setBDesc(e.target.value)} placeholder="Descrizione opzionale" className="font-mono text-sm" />
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono text-muted-foreground font-bold mb-1">STEP SEQUENZA</div>
              <p className="text-[10px] text-muted-foreground">Variabili: {"{{"} nome {"}}"}  {"{{"} azienda {"}}"}  {"{{"} citta {"}}"}  {"{{"} sito_web {"}}"}</p>
            </div>
            {steps.map((step, i) => (
              <div key={i} className="border border-border rounded-lg p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-primary">STEP {step.step_number}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">Attendi</span>
                    <Input type="number" min={0} max={90} value={step.delay_days}
                      onChange={e => updateStep(i, "delay_days", parseInt(e.target.value) || 0)}
                      className="w-16 h-6 text-xs font-mono text-center p-1" />
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {i === 0 ? "giorni dall'iscrizione" : `giorni dopo step ${i}`}
                    </span>
                    {steps.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeStep(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <Input placeholder="Oggetto email *" value={step.subject}
                  onChange={e => updateStep(i, "subject", e.target.value)} className="font-mono text-xs" />
                <Textarea placeholder={"Testo email *\n\nCiao {{nome}},\n\n..."} value={step.body}
                  onChange={e => updateStep(i, "body", e.target.value)}
                  className="font-mono text-xs min-h-[120px] resize-none" />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addStep} className="font-mono text-xs self-start">
              <Plus className="h-3 w-3 mr-1" /> Aggiungi step
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowBuilder(false)}>Annulla</Button>
            <Button onClick={saveSequence} disabled={saving}>
              {saving ? "Salvataggio…" : editSeq ? "Aggiorna" : "Crea Sequenza"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renderEnrollDialog()}
    </div>
  );
}
