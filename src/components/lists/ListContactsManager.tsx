import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Trash2, Users, Filter, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ContactList, Contact } from "@/types";

interface Props {
  list: ContactList | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function ListContactsManager({ list, onClose, onUpdate }: Props) {
  const [members, setMembers] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [candidates, setCandidates] = useState<Contact[]>([]);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState<Set<string>>(new Set());

  const isDynamic = list?.tipo === "dinamica";

  const fetchMembers = useCallback(async () => {
    if (!list) return;
    setLoading(true);
    try {
      if (isDynamic) {
        // Query contacts using saved filters
        let q = supabase.from("contacts").select("*").order("azienda").limit(500);
        const f = list.filtri as Record<string, unknown>;
        if (f.stato && Array.isArray(f.stato)) q = q.in("stato", f.stato as string[]);
        if (f.fonte && Array.isArray(f.fonte)) q = q.in("fonte", f.fonte as string[]);
        if (f.citta && Array.isArray(f.citta)) q = q.in("citta", f.citta as string[]);
        if (f.hasEmail) q = q.not("email", "is", null);
        if (f.hasTelefono) q = q.not("telefono", "is", null);
        const { data } = await q;
        setMembers((data as Contact[]) || []);
      } else {
        // Static: join through list_contacts
        const { data } = await supabase
          .from("list_contacts")
          .select("contact_id")
          .eq("list_id", list.id);
        const ids = (data || []).map(r => r.contact_id);
        if (ids.length === 0) { setMembers([]); return; }
        const { data: contacts } = await supabase
          .from("contacts")
          .select("*")
          .in("id", ids)
          .order("azienda")
          .limit(500);
        setMembers((contacts as Contact[]) || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [list, isDynamic]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const searchCandidates = useCallback(async () => {
    if (!candidateSearch.trim() || !list) return;
    setCandidateLoading(true);
    try {
      const memberIds = members.map(m => m.id);
      let q = supabase.from("contacts").select("*")
        .or(`azienda.ilike.%${candidateSearch}%,nome.ilike.%${candidateSearch}%,email.ilike.%${candidateSearch}%`)
        .limit(50);
      const { data } = await q;
      setCandidates(((data as Contact[]) || []).filter(c => !memberIds.includes(c.id)));
    } catch (err) {
      console.error(err);
    } finally {
      setCandidateLoading(false);
    }
  }, [candidateSearch, list, members]);

  const handleAddContacts = async () => {
    if (!list || selectedToAdd.size === 0) return;
    try {
      const rows = Array.from(selectedToAdd).map(contact_id => ({ list_id: list.id, contact_id }));
      const { error } = await supabase.from("list_contacts").insert(rows);
      if (error) throw error;
      // Update count
      await supabase.from("lists").update({ totale_contatti: members.length + selectedToAdd.size }).eq("id", list.id);
      toast.success(`${selectedToAdd.size} contatti aggiunti`);
      setSelectedToAdd(new Set());
      setCandidates([]);
      setCandidateSearch("");
      setShowAddPanel(false);
      fetchMembers();
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleRemove = async (contactId: string) => {
    if (!list) return;
    try {
      await supabase.from("list_contacts").delete().eq("list_id", list.id).eq("contact_id", contactId);
      await supabase.from("lists").update({ totale_contatti: Math.max(0, members.length - 1) }).eq("id", list.id);
      toast.success("Contatto rimosso");
      fetchMembers();
      onUpdate();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const refreshDynamic = async () => {
    if (!list || !isDynamic) return;
    await fetchMembers();
    await supabase.from("lists").update({ totale_contatti: members.length }).eq("id", list.id);
    onUpdate();
    toast.success("Lista aggiornata");
  };

  const filtered = members.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.azienda?.toLowerCase().includes(s) || c.nome?.toLowerCase().includes(s) || c.email?.toLowerCase().includes(s);
  });

  return (
    <Sheet open={!!list} onOpenChange={v => !v && onClose()}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {list?.nome}
            <Badge variant="outline" className="font-mono text-[10px] ml-2">
              {isDynamic ? "DINAMICA" : "STATICA"}
            </Badge>
          </SheetTitle>
          {list?.descrizione && <p className="text-xs text-muted-foreground font-mono">{list.descrizione}</p>}
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca nella lista..." className="pl-9 h-9" />
            </div>
            {isDynamic ? (
              <Button size="sm" variant="outline" onClick={refreshDynamic}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Aggiorna
              </Button>
            ) : (
              <Button size="sm" onClick={() => setShowAddPanel(!showAddPanel)}>
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Aggiungi
              </Button>
            )}
          </div>

          {/* Dynamic filters display */}
          {isDynamic && list?.filtri && Object.keys(list.filtri).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground mt-0.5" />
              {Object.entries(list.filtri as Record<string, unknown>).map(([k, v]) => (
                <Badge key={k} variant="secondary" className="font-mono text-[10px]">
                  {k}: {Array.isArray(v) ? (v as string[]).join(", ") : String(v)}
                </Badge>
              ))}
            </div>
          )}

          {/* Add contacts panel (static only) */}
          {showAddPanel && !isDynamic && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="font-mono text-xs text-primary font-bold">CERCA CONTATTI DA AGGIUNGERE</p>
              <div className="flex gap-2">
                <Input value={candidateSearch} onChange={e => setCandidateSearch(e.target.value)} placeholder="Cerca per azienda, nome o email..." className="h-8 text-xs" onKeyDown={e => e.key === "Enter" && searchCandidates()} />
                <Button size="sm" variant="outline" onClick={searchCandidates} disabled={candidateLoading}>Cerca</Button>
              </div>
              {candidates.length > 0 && (
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {candidates.map(c => (
                    <label key={c.id} className="flex items-center gap-2 text-xs font-mono p-1 rounded hover:bg-muted/50 cursor-pointer">
                      <input type="checkbox" checked={selectedToAdd.has(c.id)} onChange={e => {
                        const s = new Set(selectedToAdd);
                        e.target.checked ? s.add(c.id) : s.delete(c.id);
                        setSelectedToAdd(s);
                      }} className="accent-primary" />
                      <span className="text-foreground">{c.azienda}</span>
                      <span className="text-muted-foreground">{c.email || "—"}</span>
                    </label>
                  ))}
                  <Button size="sm" onClick={handleAddContacts} disabled={selectedToAdd.size === 0} className="mt-1">
                    Aggiungi {selectedToAdd.size} selezionati
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <p className="font-mono text-xs text-muted-foreground">
            {filtered.length} contatti {search ? `(filtrati da ${members.length})` : ""}
          </p>

          {/* Members table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[10px]">AZIENDA</TableHead>
                  <TableHead className="font-mono text-[10px]">EMAIL</TableHead>
                  <TableHead className="font-mono text-[10px]">TELEFONO</TableHead>
                  <TableHead className="font-mono text-[10px]">STATO</TableHead>
                  {!isDynamic && <TableHead className="font-mono text-[10px] w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 font-mono text-xs text-muted-foreground">Caricamento...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 font-mono text-xs text-muted-foreground">Nessun contatto</TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.azienda}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.email || "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{c.telefono || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px]">{c.stato}</Badge>
                    </TableCell>
                    {!isDynamic && (
                      <TableCell>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRemove(c.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
