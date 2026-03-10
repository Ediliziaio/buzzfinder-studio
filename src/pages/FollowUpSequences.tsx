import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { GitBranch, Plus, Trash2, GripVertical, Clock, Mail, Eye, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Campaign } from "@/types";

interface FollowUpSequence {
  id: string;
  campaign_id: string;
  nome: string;
  attiva: boolean;
  created_at: string;
  campaigns?: { nome: string; tipo: string; stato: string } | null;
}

interface FollowUpStep {
  id: string;
  sequence_id: string;
  ordine: number;
  delay_giorni: number;
  condizione: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  created_at: string;
}

const condizioni = [
  { value: "non_aperto", label: "Non ha aperto", icon: Eye },
  { value: "aperto_non_cliccato", label: "Aperto ma non cliccato", icon: MousePointerClick },
  { value: "non_risposto", label: "Non ha risposto", icon: Mail },
  { value: "sempre", label: "Invia sempre", icon: Clock },
];

export default function FollowUpSequencesPage() {
  const [sequences, setSequences] = useState<FollowUpSequence[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editSequence, setEditSequence] = useState<FollowUpSequence | null>(null);
  const [steps, setSteps] = useState<FollowUpStep[]>([]);

  // New sequence form
  const [newName, setNewName] = useState("");
  const [newCampaignId, setNewCampaignId] = useState("");

  const fetchSequences = useCallback(async () => {
    const { data } = await supabase
      .from("follow_up_sequences")
      .select("*, campaigns(nome, tipo, stato)")
      .order("created_at", { ascending: false });
    setSequences((data as unknown as FollowUpSequence[]) || []);
    setLoading(false);
  }, []);

  const fetchCampaigns = useCallback(async () => {
    const { data } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    setCampaigns((data as unknown as Campaign[]) || []);
  }, []);

  useEffect(() => {
    fetchSequences();
    fetchCampaigns();
  }, [fetchSequences, fetchCampaigns]);

  const loadSteps = async (sequenceId: string) => {
    const { data } = await supabase
      .from("follow_up_steps")
      .select("*")
      .eq("sequence_id", sequenceId)
      .order("ordine", { ascending: true });
    setSteps((data as unknown as FollowUpStep[]) || []);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newCampaignId) return;
    const { error } = await supabase.from("follow_up_sequences").insert({
      nome: newName.trim(),
      campaign_id: newCampaignId,
      attiva: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Sequenza creata");
    setShowCreate(false);
    setNewName("");
    setNewCampaignId("");
    fetchSequences();
  };

  const handleToggle = async (seq: FollowUpSequence) => {
    await supabase.from("follow_up_sequences").update({ attiva: !seq.attiva }).eq("id", seq.id);
    fetchSequences();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("follow_up_sequences").delete().eq("id", id);
    toast.success("Sequenza eliminata");
    fetchSequences();
    if (editSequence?.id === id) setEditSequence(null);
  };

  const handleAddStep = async () => {
    if (!editSequence) return;
    const nextOrder = steps.length + 1;
    const { error } = await supabase.from("follow_up_steps").insert({
      sequence_id: editSequence.id,
      ordine: nextOrder,
      delay_giorni: 3,
      condizione: "non_aperto",
      subject: `Follow-up #${nextOrder}`,
      body_html: "",
      body_text: "",
    });
    if (error) { toast.error(error.message); return; }
    loadSteps(editSequence.id);
  };

  const handleUpdateStep = async (stepId: string, updates: Partial<FollowUpStep>) => {
    await supabase.from("follow_up_steps").update(updates as any).eq("id", stepId);
    if (editSequence) loadSteps(editSequence.id);
  };

  const handleDeleteStep = async (stepId: string) => {
    await supabase.from("follow_up_steps").delete().eq("id", stepId);
    if (editSequence) loadSteps(editSequence.id);
  };

  const openEdit = (seq: FollowUpSequence) => {
    setEditSequence(seq);
    loadSteps(seq.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">SEQUENZE FOLLOW-UP</h1>
          <span className="font-mono text-xs text-muted-foreground">{sequences.length} sequenze</span>
        </div>
        <Button onClick={() => setShowCreate(true)} className="font-mono text-xs">
          <Plus className="mr-1 h-4 w-4" /> Nuova sequenza
        </Button>
      </div>

      {/* Sequences list */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="terminal-header">Nome</TableHead>
              <TableHead className="terminal-header">Campagna</TableHead>
              <TableHead className="terminal-header">Stato</TableHead>
              <TableHead className="terminal-header">Attiva</TableHead>
              <TableHead className="terminal-header w-[100px]">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center font-mono text-xs text-muted-foreground py-8">Caricamento...</TableCell>
              </TableRow>
            ) : sequences.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center font-mono text-xs text-muted-foreground py-8">
                  Nessuna sequenza. Crea la prima per automatizzare i follow-up.
                </TableCell>
              </TableRow>
            ) : (
              sequences.map((seq) => (
                <TableRow key={seq.id} className="cursor-pointer hover:bg-accent/50" onClick={() => openEdit(seq)}>
                  <TableCell className="font-mono text-sm font-medium">{seq.nome}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{seq.campaigns?.nome || "—"}</TableCell>
                  <TableCell>{seq.campaigns?.stato ? <StatusBadge status={seq.campaigns.stato} /> : "—"}</TableCell>
                  <TableCell>
                    <Switch
                      checked={seq.attiva}
                      onCheckedChange={() => handleToggle(seq)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(seq.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono">Nuova sequenza follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-mono text-xs">Nome sequenza</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="es. Follow-up non aperti" className="font-mono text-sm mt-1" />
            </div>
            <div>
              <Label className="font-mono text-xs">Campagna collegata</Label>
              <Select value={newCampaignId} onValueChange={setNewCampaignId}>
                <SelectTrigger className="mt-1 font-mono text-xs">
                  <SelectValue placeholder="Seleziona campagna..." />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="font-mono text-xs">{c.nome} ({c.tipo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={!newName.trim() || !newCampaignId} className="w-full font-mono text-xs">
              Crea sequenza
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit steps panel */}
      {editSequence && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-mono text-sm font-bold">{editSequence.nome}</h3>
              <p className="font-mono text-[10px] text-muted-foreground">
                Campagna: {editSequence.campaigns?.nome} — {steps.length} step configurati
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleAddStep} className="font-mono text-xs">
              <Plus className="h-3 w-3 mr-1" /> Aggiungi step
            </Button>
          </div>

          {/* Visual timeline */}
          <div className="space-y-3">
            {steps.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground text-center py-6">
                Nessuno step. Aggiungi il primo follow-up.
              </p>
            ) : (
              steps.map((step, i) => (
                <div key={step.id} className="relative rounded-lg border border-border bg-accent p-4 space-y-3">
                  {/* Timeline connector */}
                  {i > 0 && (
                    <div className="absolute -top-3 left-6 w-px h-3 bg-border" />
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                        <span className="font-mono text-[10px] text-primary font-bold">{step.ordine}</span>
                      </div>
                      <span className="font-mono text-xs font-medium">Step {step.ordine}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteStep(step.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="font-mono text-[10px] text-muted-foreground">Delay (giorni)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={step.delay_giorni}
                        onChange={(e) => handleUpdateStep(step.id, { delay_giorni: parseInt(e.target.value) || 1 })}
                        className="h-8 font-mono text-xs mt-1"
                      />
                    </div>
                    <div>
                      <Label className="font-mono text-[10px] text-muted-foreground">Condizione</Label>
                      <Select
                        value={step.condizione}
                        onValueChange={(v) => handleUpdateStep(step.id, { condizione: v })}
                      >
                        <SelectTrigger className="h-8 font-mono text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {condizioni.map((c) => (
                            <SelectItem key={c.value} value={c.value} className="font-mono text-xs">{c.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="font-mono text-[10px] text-muted-foreground">Oggetto</Label>
                    <Input
                      value={step.subject || ""}
                      onChange={(e) => handleUpdateStep(step.id, { subject: e.target.value })}
                      placeholder="es. Hai visto la nostra proposta?"
                      className="h-8 font-mono text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="font-mono text-[10px] text-muted-foreground">Corpo messaggio</Label>
                    <Textarea
                      value={step.body_text || ""}
                      onChange={(e) => handleUpdateStep(step.id, { body_text: e.target.value })}
                      placeholder="Ciao {{nome}}, volevo sapere se..."
                      className="font-mono text-xs mt-1 min-h-[60px]"
                    />
                  </div>

                  {/* Visual summary */}
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground bg-background rounded px-2 py-1.5">
                    <Clock className="h-3 w-3" />
                    <span>Dopo {step.delay_giorni} giorn{step.delay_giorni === 1 ? "o" : "i"}</span>
                    <span>→</span>
                    <span>Se: {condizioni.find((c) => c.value === step.condizione)?.label}</span>
                    <span>→</span>
                    <Mail className="h-3 w-3" />
                    <span>Invia</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
