import { useState, useEffect, useCallback } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Copy, Loader2, Merge, SkipForward, CheckCircle,
  AlertTriangle, Users, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Contact } from "@/types";

interface DuplicateGroup {
  reason: "email" | "telefono" | "azienda";
  confidence: "alta" | "media";
  contacts: Contact[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Score how "complete" a contact is — more fields = better primary
function completenessScore(c: Contact): number {
  let score = 0;
  if (c.email) score += 3;
  if (c.telefono) score += 2;
  if (c.nome) score += 1;
  if (c.azienda) score += 1;
  if (c.citta) score += 1;
  if (c.sito_web) score += 1;
  if (c.indirizzo) score += 1;
  if ((c.tags || []).length > 0) score += 1;
  if (c.email_quality === "valid") score += 2;
  return score;
}

// Merge two contacts: primary wins on conflicts, duplicate fills gaps
function mergeContacts(primary: Contact, duplicate: Contact): Partial<Contact> {
  return {
    nome: primary.nome ?? duplicate.nome,
    cognome: primary.cognome ?? duplicate.cognome,
    azienda: primary.azienda || duplicate.azienda,
    telefono: primary.telefono ?? duplicate.telefono,
    telefono_normalizzato: primary.telefono_normalizzato ?? duplicate.telefono_normalizzato,
    email: primary.email ?? duplicate.email,
    email_quality: (primary.email_quality === "valid" ? "valid"
      : duplicate.email_quality === "valid" ? "valid"
      : primary.email_quality ?? duplicate.email_quality),
    email_valid: primary.email_valid || duplicate.email_valid,
    email_confidence: Math.max(primary.email_confidence || 0, duplicate.email_confidence || 0),
    sito_web: primary.sito_web ?? duplicate.sito_web,
    indirizzo: primary.indirizzo ?? duplicate.indirizzo,
    citta: primary.citta ?? duplicate.citta,
    provincia: primary.provincia ?? duplicate.provincia,
    cap: primary.cap ?? duplicate.cap,
    regione: primary.regione ?? duplicate.regione,
    lat: primary.lat ?? duplicate.lat,
    lng: primary.lng ?? duplicate.lng,
    linkedin_url: primary.linkedin_url ?? duplicate.linkedin_url,
    facebook_url: primary.facebook_url ?? duplicate.facebook_url,
    instagram_url: primary.instagram_url ?? duplicate.instagram_url,
    google_rating: primary.google_rating ?? duplicate.google_rating,
    google_reviews_count: primary.google_reviews_count ?? duplicate.google_reviews_count,
    note: [primary.note, duplicate.note].filter(Boolean).join("\n\n") || null,
    tags: Array.from(new Set([...(primary.tags || []), ...(duplicate.tags || [])])),
  };
}

// Tables that have contact_id and should have records reassigned
const RELATED_TABLES = [
  "campaign_recipients",
  "contact_activities",
  "list_contacts",
  "pipeline_leads",
  "scraping_jobs",
  "sequence_enrollments",
  "sequence_sends",
  "automation_executions",
  "call_sessions",
] as const;

async function reassignAndMerge(primary: Contact, duplicate: Contact): Promise<void> {
  // 1. Update primary with merged data
  const merged = mergeContacts(primary, duplicate);
  const { error: updateErr } = await (supabase as any)
    .from("contacts")
    .update(merged)
    .eq("id", primary.id);
  if (updateErr) throw new Error("Errore aggiornamento contatto: " + updateErr.message);

  // 2. Reassign related records (ignore conflicts)
  for (const table of RELATED_TABLES) {
    await (supabase as any)
      .from(table)
      .update({ contact_id: primary.id })
      .eq("contact_id", duplicate.id);
    // If there was a unique constraint violation, some records remain on duplicate.id
    // They will be cascade-deleted in step 3.
  }

  // 3. Delete the duplicate (cascade deletes any remaining orphaned records)
  const { error: deleteErr } = await (supabase as any)
    .from("contacts")
    .delete()
    .eq("id", duplicate.id);
  if (deleteErr) throw new Error("Errore eliminazione duplicato: " + deleteErr.message);
}

export function DeduplicationPanel({ open, onClose, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [stats, setStats] = useState({ merged: 0, skipped: 0 });
  const [done, setDone] = useState(false);

  const loadDuplicates = useCallback(async () => {
    setLoading(true);
    setDone(false);
    setStats({ merged: 0, skipped: 0 });
    setCurrentIdx(0);
    setDismissed(new Set());

    try {
      // Fetch all contacts with enough data for comparison
      const { data, error } = await (supabase as any)
        .from("contacts")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      const contacts: Contact[] = data || [];

      const foundGroups: DuplicateGroup[] = [];
      const usedIds = new Set<string>();

      // 1. Group by identical email (case-insensitive)
      const emailMap = new Map<string, Contact[]>();
      for (const c of contacts) {
        if (!c.email) continue;
        const key = c.email.toLowerCase().trim();
        if (!emailMap.has(key)) emailMap.set(key, []);
        emailMap.get(key)!.push(c);
      }
      for (const [, group] of emailMap) {
        if (group.length < 2) continue;
        // Take the two most interesting duplicates (highest completeness)
        const sorted = group.sort((a, b) => completenessScore(b) - completenessScore(a));
        const pair = sorted.slice(0, 2);
        if (usedIds.has(pair[0].id) || usedIds.has(pair[1].id)) continue;
        usedIds.add(pair[0].id);
        usedIds.add(pair[1].id);
        foundGroups.push({ reason: "email", confidence: "alta", contacts: pair });
      }

      // 2. Group by identical normalized phone
      const phoneMap = new Map<string, Contact[]>();
      for (const c of contacts) {
        const raw = c.telefono_normalizzato || c.telefono;
        if (!raw) continue;
        const key = raw.replace(/\D/g, "").replace(/^0+/, "").slice(-9); // last 9 digits
        if (key.length < 7) continue;
        if (!phoneMap.has(key)) phoneMap.set(key, []);
        phoneMap.get(key)!.push(c);
      }
      for (const [, group] of phoneMap) {
        if (group.length < 2) continue;
        const sorted = group.sort((a, b) => completenessScore(b) - completenessScore(a));
        const pair = sorted.slice(0, 2);
        if (usedIds.has(pair[0].id) || usedIds.has(pair[1].id)) continue;
        usedIds.add(pair[0].id);
        usedIds.add(pair[1].id);
        foundGroups.push({ reason: "telefono", confidence: "alta", contacts: pair });
      }

      // 3. Group by identical company name (exact, case-insensitive)
      const azMap = new Map<string, Contact[]>();
      for (const c of contacts) {
        if (!c.azienda || usedIds.has(c.id)) continue;
        const key = c.azienda.toLowerCase().trim().replace(/\s+/g, " ");
        if (key.length < 4) continue;
        if (!azMap.has(key)) azMap.set(key, []);
        azMap.get(key)!.push(c);
      }
      for (const [, group] of azMap) {
        if (group.length < 2) continue;
        const sorted = group.sort((a, b) => completenessScore(b) - completenessScore(a));
        const pair = sorted.slice(0, 2);
        if (usedIds.has(pair[0].id) || usedIds.has(pair[1].id)) continue;
        usedIds.add(pair[0].id);
        usedIds.add(pair[1].id);
        foundGroups.push({ reason: "azienda", confidence: "media", contacts: pair });
      }

      setGroups(foundGroups);
    } catch (err: any) {
      toast.error(err.message || "Errore ricerca duplicati");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadDuplicates();
  }, [open, loadDuplicates]);

  const activeGroups = groups.filter((g) => {
    const key = g.contacts.map((c) => c.id).sort().join("|");
    return !dismissed.has(key);
  });

  const currentGroup = activeGroups[currentIdx] ?? null;

  const groupKey = (g: DuplicateGroup) => g.contacts.map((c) => c.id).sort().join("|");

  const handleDismiss = () => {
    if (!currentGroup) return;
    setDismissed((prev) => new Set([...prev, groupKey(currentGroup)]));
    setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    if (currentIdx >= activeGroups.length - 1) setCurrentIdx(Math.max(0, activeGroups.length - 2));
  };

  const handleMerge = async (primaryIdx: 0 | 1) => {
    if (!currentGroup) return;
    const primary = currentGroup.contacts[primaryIdx];
    const duplicate = currentGroup.contacts[primaryIdx === 0 ? 1 : 0];
    const key = groupKey(currentGroup);
    setMerging(key);
    try {
      await reassignAndMerge(primary, duplicate);
      toast.success(`✓ Uniti: "${primary.azienda || primary.nome}"`);
      setDismissed((prev) => new Set([...prev, key]));
      setStats((s) => ({ ...s, merged: s.merged + 1 }));
      if (currentIdx >= activeGroups.length - 1) setCurrentIdx(Math.max(0, activeGroups.length - 2));
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Errore merge");
    } finally {
      setMerging(null);
    }
  };

  const handleMergeAuto = async () => {
    if (!currentGroup) return;
    const [a, b] = currentGroup.contacts;
    const primary = completenessScore(a) >= completenessScore(b) ? a : b;
    const duplicate = primary === a ? b : a;
    await handleMerge(currentGroup.contacts.indexOf(primary) as 0 | 1);
  };

  const reasonLabel: Record<DuplicateGroup["reason"], string> = {
    email: "Email identica",
    telefono: "Telefono identico",
    azienda: "Nome azienda identico",
  };

  const reasonColor: Record<DuplicateGroup["confidence"], string> = {
    alta: "text-primary border-primary/30 bg-primary/5",
    media: "text-yellow-400 border-yellow-500/30 bg-yellow-500/5",
  };

  const pct = groups.length > 0 ? Math.round(((groups.length - activeGroups.length) / groups.length) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <Copy className="h-5 w-5 text-primary" />
            Deduplicazione Contatti
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-mono text-sm text-muted-foreground">Analisi duplicati in corso…</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle className="h-10 w-10 text-primary" />
            <p className="font-mono text-sm font-bold text-foreground">Nessun duplicato trovato!</p>
            <p className="font-mono text-xs text-muted-foreground">Il database è pulito.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Progress header */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span>
                  <span className="text-foreground font-bold">{groups.length}</span> gruppi trovati —{" "}
                  <span className="text-primary">{stats.merged}</span> uniti,{" "}
                  <span>{stats.skipped}</span> ignorati
                </span>
                <span>{activeGroups.length} rimasti</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>

            {activeGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <CheckCircle className="h-8 w-8 text-primary" />
                <p className="font-mono text-sm font-bold text-foreground">Revisione completata!</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {stats.merged} uniti • {stats.skipped} ignorati
                </p>
              </div>
            ) : currentGroup ? (
              <>
                {/* Navigation */}
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] ${reasonColor[currentGroup.confidence]}`}>
                    <AlertTriangle className="h-3 w-3" />
                    {reasonLabel[currentGroup.reason]} — Confidenza {currentGroup.confidence}
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentIdx === 0}
                      onClick={() => setCurrentIdx((i) => i - 1)}>
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <span>{currentIdx + 1} / {activeGroups.length}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={currentIdx >= activeGroups.length - 1}
                      onClick={() => setCurrentIdx((i) => i + 1)}>
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Side-by-side comparison */}
                <div className="grid grid-cols-2 gap-3">
                  {currentGroup.contacts.map((c, i) => (
                    <div key={c.id}
                      className={`rounded-lg border p-3 space-y-2 ${i === 0 ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] text-muted-foreground">{i === 0 ? "CONTATTO A" : "CONTATTO B"}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          Score: <span className="text-foreground">{completenessScore(c)}</span>
                        </span>
                      </div>
                      <div className="space-y-1">
                        <Row label="Azienda" value={c.azienda} />
                        <Row label="Nome" value={[c.nome, c.cognome].filter(Boolean).join(" ")} />
                        <Row label="Email" value={c.email} quality={c.email_quality} />
                        <Row label="Tel" value={c.telefono} />
                        <Row label="Città" value={c.citta} />
                        <Row label="Sito" value={c.sito_web} />
                        <Row label="Fonte" value={c.fonte} />
                        <Row label="Aggiunto" value={new Date(c.created_at).toLocaleDateString("it-IT")} />
                      </div>
                      <Button
                        size="sm"
                        className="w-full font-mono text-[10px] h-7"
                        variant={i === 0 ? "default" : "outline"}
                        disabled={!!merging}
                        onClick={() => handleMerge(i as 0 | 1)}
                      >
                        {merging === groupKey(currentGroup)
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <><Merge className="h-3 w-3 mr-1" /> Mantieni questo</>}
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 font-mono text-xs gap-1"
                    disabled={!!merging}
                    onClick={handleMergeAuto}
                  >
                    <Merge className="h-3.5 w-3.5" />
                    Unisci auto (mantieni più completo)
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-mono text-xs gap-1 text-muted-foreground"
                    disabled={!!merging}
                    onClick={handleDismiss}
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Ignora
                  </Button>
                </div>
              </>
            ) : null}

            {/* Bulk auto-merge high confidence */}
            {activeGroups.filter(g => g.confidence === "alta").length > 1 && (
              <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
                <Users className="h-4 w-4 text-primary shrink-0" />
                <span className="font-mono text-xs text-muted-foreground flex-1">
                  {activeGroups.filter(g => g.confidence === "alta").length} duplicati ad alta confidenza trovati.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="font-mono text-[10px] h-7 shrink-0"
                  disabled={!!merging}
                  onClick={async () => {
                    const highConf = activeGroups.filter(g => g.confidence === "alta");
                    let merged = 0;
                    for (const g of highConf) {
                      const [a, b] = g.contacts;
                      const primary = completenessScore(a) >= completenessScore(b) ? a : b;
                      const dup = primary === a ? b : a;
                      try {
                        setMerging(groupKey(g));
                        await reassignAndMerge(primary, dup);
                        setDismissed((prev) => new Set([...prev, groupKey(g)]));
                        merged++;
                      } catch { /* skip */ }
                    }
                    setMerging(null);
                    setStats((s) => ({ ...s, merged: s.merged + merged }));
                    toast.success(`${merged} duplicati uniti automaticamente`);
                    onComplete();
                  }}
                >
                  Unisci tutti ({activeGroups.filter(g => g.confidence === "alta").length})
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, quality }: { label: string; value?: string | null; quality?: string | null }) {
  if (!value) return null;
  const qColor = quality === "valid" ? "text-primary" : quality === "risky" ? "text-yellow-500" : quality === "invalid" ? "text-destructive" : "";
  return (
    <div className="flex gap-1.5">
      <span className="font-mono text-[9px] text-muted-foreground w-10 shrink-0 mt-0.5">{label}</span>
      <span className={`font-mono text-[10px] truncate ${qColor || "text-foreground"}`}>{value}</span>
    </div>
  );
}
