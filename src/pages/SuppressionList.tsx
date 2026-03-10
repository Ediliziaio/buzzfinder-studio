import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldOff, Search, Download, Trash2, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SuppressionEntry {
  id: string;
  email: string;
  motivo: string | null;
  campaign_id: string | null;
  created_at: string;
  campaigns?: { nome: string } | null;
}

async function fetchSuppressionList() {
  const { data, error } = await supabase
    .from("suppression_list")
    .select("*, campaigns(nome)")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data as unknown as SuppressionEntry[]) || [];
}

export default function SuppressionListPage() {
  const [search, setSearch] = useState("");

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ["suppression_list"],
    queryFn: fetchSuppressionList,
    staleTime: 30_000,
  });

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      e.email.toLowerCase().includes(s) ||
      e.motivo?.toLowerCase().includes(s) ||
      e.campaigns?.nome?.toLowerCase().includes(s)
    );
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("suppression_list").delete().eq("id", id);
    if (error) {
      toast.error("Errore rimozione");
      return;
    }
    toast.success("Email rimossa dalla suppression list");
    refetch();
  };

  const handleExportCsv = () => {
    const headers = ["email", "motivo", "campagna", "data"];
    const rows = filtered.map((e) => [
      e.email,
      e.motivo || "",
      e.campaigns?.nome || "",
      e.created_at ? format(new Date(e.created_at), "dd/MM/yyyy HH:mm") : "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suppression_list_${format(new Date(), "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} righe esportate`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldOff className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">SUPPRESSION LIST</h1>
          <span className="font-mono text-xs text-muted-foreground">{entries.length} email</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="font-mono text-xs">
            <RefreshCw className="h-3 w-3 mr-1" /> Aggiorna
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={filtered.length === 0} className="font-mono text-xs">
            <Download className="h-3 w-3 mr-1" /> ESPORTA CSV
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per email, motivo o campagna..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 font-mono text-xs bg-accent border-border"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="font-mono text-2xl font-bold text-foreground">{entries.length}</div>
          <div className="font-mono text-[10px] text-muted-foreground mt-1">TOTALE DISISCRITTI</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="font-mono text-2xl font-bold text-foreground">
            {entries.filter((e) => e.motivo === "unsubscribe").length}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground mt-1">DISISCRIZIONE VOLONTARIA</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-3 text-center">
          <div className="font-mono text-2xl font-bold text-foreground">
            {entries.filter((e) => e.motivo === "bounce" || e.motivo === "complaint").length}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground mt-1">BOUNCE / COMPLAINT</div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="terminal-header">EMAIL</TableHead>
              <TableHead className="terminal-header">MOTIVO</TableHead>
              <TableHead className="terminal-header">CAMPAGNA</TableHead>
              <TableHead className="terminal-header">DATA</TableHead>
              <TableHead className="terminal-header w-[60px]">AZIONI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center font-mono text-xs text-muted-foreground py-8">
                  Caricamento...
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center font-mono text-xs text-muted-foreground py-8">
                  {search ? "Nessun risultato per la ricerca" : "Nessuna email nella suppression list"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-xs">{entry.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`font-mono text-[10px] ${
                        entry.motivo === "unsubscribe"
                          ? "border-primary/30 text-primary"
                          : entry.motivo === "bounce"
                          ? "border-destructive/30 text-destructive"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {entry.motivo || "altro"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {entry.campaigns?.nome || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {entry.created_at
                      ? format(new Date(entry.created_at), "dd MMM yyyy HH:mm", { locale: it })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-mono">Rimuovere dalla suppression list?</AlertDialogTitle>
                          <AlertDialogDescription className="font-mono text-xs">
                            L'email <strong>{entry.email}</strong> potrà ricevere nuovamente campagne.
                            Questa azione non può essere annullata automaticamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="font-mono text-xs">Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            className="font-mono text-xs"
                            onClick={() => handleDelete(entry.id)}
                          >
                            Rimuovi
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
