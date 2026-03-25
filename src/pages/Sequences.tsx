import { useState, useEffect } from "react";
import { Plus, Play, Pause, Archive, Trash2, ChevronRight, Users, Mail, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

// Types
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
  descrizione: string;
  status: "bozza" | "attiva" | "archiviata";
  created_at: string;
  _steps?: SequenceStep[];
  _enrollments?: number;
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editSeq, setEditSeq] = useState<Sequence | null>(null);

  // Builder state
  const [nome, setNome] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [steps, setSteps] = useState<SequenceStep[]>([
    { step_number: 1, delay_days: 0, subject: "", body: "" },
    { step_number: 2, delay_days: 3, subject: "", body: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const loadSequences = async () => {
    setLoading(true);
    const userId = await getCurrentUserId();
    const { data } = await supabase
      .from("email_sequences")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data) {
      // Load enrollment counts
      const withCounts = await Promise.all(data.map(async (seq: Sequence) => {
        const { count } = await supabase
          .from("sequence_enrollments")
          .select("*", { count: "exact", head: true })
          .eq("sequence_id", seq.id)
          .eq("status", "attiva");
        return { ...seq, _enrollments: count ?? 0 };
      }));
      setSequences(withCounts);
    }
    setLoading(false);
  };

  useEffect(() => { loadSequences(); }, []);

  const openBuilder = (seq?: Sequence) => {
    if (seq) {
      setEditSeq(seq);
      setNome(seq.nome);
      setDescrizione(seq.descrizione || "");
      // Load steps
      supabase.from("sequence_steps").select("*").eq("sequence_id", seq.id).order("step_number")
        .then(({ data }) => { if (data) setSteps(data); });
    } else {
      setEditSeq(null);
      setNome("");
      setDescrizione("");
      setSteps([
        { step_number: 1, delay_days: 0, subject: "", body: "" },
        { step_number: 2, delay_days: 3, subject: "", body: "" },
      ]);
    }
    setShowBuilder(true);
  };

  const addStep = () => {
    const lastDelay = steps[steps.length - 1]?.delay_days ?? 0;
    setSteps(s => [...s, { step_number: s.length + 1, delay_days: lastDelay + 3, subject: "", body: "" }]);
  };

  const removeStep = (i: number) => {
    setSteps(s => s.filter((_, idx) => idx !== i).map((st, idx) => ({ ...st, step_number: idx + 1 })));
  };

  const updateStep = (i: number, field: keyof SequenceStep, value: string | number) => {
    setSteps(s => s.map((st, idx) => idx === i ? { ...st, [field]: value } : st));
  };

  const saveSequence = async () => {
    if (!nome.trim()) { toast.error("Inserisci un nome per la sequenza"); return; }
    if (steps.some(s => !s.subject.trim() || !s.body.trim())) {
      toast.error("Tutti gli step devono avere oggetto e testo");
      return;
    }
    setSaving(true);
    try {
      const userId = await getCurrentUserId();
      let seqId: string;
      if (editSeq) {
        await supabase.from("email_sequences").update({ nome, descrizione, updated_at: new Date().toISOString() }).eq("id", editSeq.id);
        seqId = editSeq.id;
        await supabase.from("sequence_steps").delete().eq("sequence_id", seqId);
      } else {
        const { data, error } = await supabase.from("email_sequences")
          .insert({ user_id: userId, nome, descrizione, status: "bozza" })
          .select().single();
        if (error) throw error;
        seqId = data.id;
      }
      await supabase.from("sequence_steps").insert(
        steps.map(s => ({ sequence_id: seqId, step_number: s.step_number, delay_days: s.delay_days, subject: s.subject, body: s.body }))
      );
      toast.success(editSeq ? "Sequenza aggiornata" : "Sequenza creata");
      setShowBuilder(false);
      loadSequences();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (seq: Sequence) => {
    const newStatus = seq.status === "attiva" ? "bozza" : "attiva";
    await supabase.from("email_sequences").update({ status: newStatus }).eq("id", seq.id);
    loadSequences();
    toast.success(newStatus === "attiva" ? "Sequenza attivata" : "Sequenza messa in bozza");
  };

  const deleteSequence = async (seq: Sequence) => {
    if (!window.confirm(`Eliminare la sequenza "${seq.nome}"? Tutti gli iscritti verranno rimossi.`)) return;
    await supabase.from("email_sequences").delete().eq("id", seq.id);
    loadSequences();
    toast.success("Sequenza eliminata");
  };

  const statusBadge = (status: string) => {
    if (status === "attiva") return <Badge className="bg-primary/20 text-primary border-primary/30">Attiva</Badge>;
    if (status === "archiviata") return <Badge variant="secondary">Archiviata</Badge>;
    return <Badge variant="outline">Bozza</Badge>;
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-wider text-foreground">SEQUENZE EMAIL</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Automazioni multi-step per follow-up</p>
        </div>
        <Button onClick={() => openBuilder()} className="font-mono text-xs">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> NUOVA SEQUENZA
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12 font-mono text-sm">Caricamento…</div>
      ) : sequences.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4 border border-dashed border-border rounded-lg">
          <Mail className="h-12 w-12 text-muted-foreground" />
          <p className="font-mono text-sm text-muted-foreground">Nessuna sequenza ancora</p>
          <Button variant="outline" onClick={() => openBuilder()}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Crea la prima sequenza
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sequences.map(seq => (
            <div key={seq.id} className="border border-border rounded-lg bg-card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-foreground truncate">{seq.nome}</span>
                    {statusBadge(seq.status)}
                  </div>
                  {seq.descrizione && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{seq.descrizione}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {seq._enrollments} attivi</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(seq.created_at).toLocaleDateString("it-IT")}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="ghost" size="sm" className="font-mono text-[10px] h-7" onClick={() => openBuilder(seq)}>
                  Modifica
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => toggleStatus(seq)}
                  title={seq.status === "attiva" ? "Metti in bozza" : "Attiva"}>
                  {seq.status === "attiva" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => deleteSequence(seq)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Builder Dialog */}
      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono font-bold">{editSeq ? "MODIFICA SEQUENZA" : "NUOVA SEQUENZA"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">NOME *</label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="es. Follow-up Infissi" className="font-mono text-sm" />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">DESCRIZIONE</label>
                <Input value={descrizione} onChange={e => setDescrizione(e.target.value)} placeholder="Descrizione opzionale" className="font-mono text-sm" />
              </div>
            </div>

            <div className="text-xs font-mono text-muted-foreground font-bold mt-2">STEP SEQUENZA</div>
            <p className="text-xs text-muted-foreground -mt-3">Variabili disponibili: {"{{nome}}"} {"{{azienda}}"} {"{{citta}}"} {"{{sito_web}}"}</p>

            {steps.map((step, i) => (
              <div key={i} className="border border-border rounded-lg p-3 flex flex-col gap-3 relative">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-primary">STEP {step.step_number}</span>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-mono text-muted-foreground">ATTENDI</label>
                    <Input type="number" min={0} max={90}
                      value={step.delay_days}
                      onChange={e => updateStep(i, "delay_days", parseInt(e.target.value) || 0)}
                      className="w-16 h-6 text-xs font-mono text-center p-1" />
                    <span className="text-[10px] font-mono text-muted-foreground">giorni{i === 0 ? " (0=subito)" : " dopo step " + i}</span>
                    {steps.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeStep(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <Input placeholder="Oggetto email *" value={step.subject} onChange={e => updateStep(i, "subject", e.target.value)} className="font-mono text-xs" />
                <Textarea placeholder="Testo email *" value={step.body} onChange={e => updateStep(i, "body", e.target.value)}
                  className="font-mono text-xs min-h-[100px] resize-none" />
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
    </div>
  );
}
