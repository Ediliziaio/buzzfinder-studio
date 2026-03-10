import { useState } from "react";
import { Mail, MessageSquare, Smartphone, Tag, Trash2, ListPlus, ArrowDownUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useLists } from "@/hooks/useLists";
import { toast } from "sonner";
import type { ContactStato } from "@/types";

const STATI: { value: ContactStato; label: string }[] = [
  { value: "nuovo", label: "Nuovo" },
  { value: "da_contattare", label: "Da contattare" },
  { value: "contattato", label: "Contattato" },
  { value: "risposto", label: "Risposto" },
  { value: "non_interessato", label: "Non interessato" },
  { value: "cliente", label: "Cliente" },
];

interface Props {
  count: number;
  selectedIds: Set<string>;
  onClear: () => void;
  onDelete?: () => void;
  onRefresh?: () => void;
}

export function BulkActionBar({ count, selectedIds, onClear, onDelete, onRefresh }: Props) {
  const { lists } = useLists();
  const [tagInput, setTagInput] = useState("");
  const [showTagDialog, setShowTagDialog] = useState(false);

  const ids = Array.from(selectedIds);

  const handleBulkStatus = async (stato: ContactStato) => {
    const { error } = await supabase.from("contacts").update({ stato }).in("id", ids);
    if (error) { toast.error("Errore aggiornamento stato"); return; }
    toast.success(`${count} contatti aggiornati a "${stato}"`);
    onRefresh?.();
  };

  const handleAddToList = async (listId: string, listName: string) => {
    const inserts = ids.map((contact_id) => ({ list_id: listId, contact_id }));
    const { error } = await supabase.from("list_contacts").upsert(inserts, { onConflict: "list_id,contact_id" });
    if (error) { toast.error("Errore aggiunta a lista"); return; }
    // Update list count
    const { count: newCount } = await supabase.from("list_contacts").select("*", { count: "exact", head: true }).eq("list_id", listId);
    await supabase.from("lists").update({ totale_contatti: newCount || 0 }).eq("id", listId);
    toast.success(`${count} contatti aggiunti a "${listName}"`);
  };

  const handleBulkTag = async () => {
    if (!tagInput.trim()) return;
    const tag = tagInput.trim().toLowerCase();
    // Fetch current tags for selected contacts, append new tag
    const { data } = await supabase.from("contacts").select("id, tags").in("id", ids);
    if (!data) return;
    const updates = data.map((c) => ({
      id: c.id,
      tags: Array.from(new Set([...(c.tags || []), tag])),
    }));
    for (const u of updates) {
      await supabase.from("contacts").update({ tags: u.tags }).eq("id", u.id);
    }
    toast.success(`Tag "${tag}" aggiunto a ${count} contatti`);
    setShowTagDialog(false);
    setTagInput("");
    onRefresh?.();
  };

  const handleBulkDelete = async () => {
    const { error } = await supabase.from("contacts").delete().in("id", ids);
    if (error) { toast.error("Errore eliminazione"); return; }
    toast.success(`${count} contatti eliminati`);
    onClear();
    onRefresh?.();
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-primary/30 bg-card px-4 py-3 shadow-2xl animate-slide-up">
      <div className="flex items-center gap-2 border-r border-border pr-3">
        <span className="font-mono text-sm text-primary font-bold">{count}</span>
        <span className="font-mono text-xs text-muted-foreground">selezionati</span>
      </div>

      {/* Stato */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1">
            <ArrowDownUp className="h-3 w-3" /> STATO
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {STATI.map((s) => (
            <DropdownMenuItem key={s.value} onClick={() => handleBulkStatus(s.value)} className="font-mono text-xs">
              {s.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Tag */}
      <AlertDialog open={showTagDialog} onOpenChange={setShowTagDialog}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1">
            <Tag className="h-3 w-3" /> TAG
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono">Aggiungi tag a {count} contatti</AlertDialogTitle>
          </AlertDialogHeader>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Nome tag..."
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleBulkTag()}
          />
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs">Annulla</AlertDialogCancel>
            <AlertDialogAction className="font-mono text-xs" onClick={handleBulkTag}>Aggiungi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Lista */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1">
            <ListPlus className="h-3 w-3" /> LISTA
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {lists.length === 0 ? (
            <DropdownMenuItem disabled className="font-mono text-xs text-muted-foreground">Nessuna lista</DropdownMenuItem>
          ) : (
            lists.map((l) => (
              <DropdownMenuItem key={l.id} onClick={() => handleAddToList(l.id, l.nome)} className="font-mono text-xs">
                {l.nome}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs font-mono gap-1 text-destructive hover:text-destructive">
            <Trash2 className="h-3 w-3" /> ELIMINA
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-mono">Elimina {count} contatti?</AlertDialogTitle>
            <AlertDialogDescription className="font-mono text-xs">
              Questa azione è irreversibile. I contatti selezionati verranno eliminati permanentemente dal database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-mono text-xs">Annulla</AlertDialogCancel>
            <AlertDialogAction className="font-mono text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleBulkDelete}>
              Elimina definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <button onClick={onClear} className="ml-2 text-muted-foreground hover:text-foreground">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
