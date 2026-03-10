import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2, Filter, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { ContactList } from "@/types";

interface Props {
  lists: ContactList[];
  isLoading: boolean;
  onSelect: (list: ContactList) => void;
  onRefetch: () => void;
}

export function ListsTable({ lists, isLoading, onSelect, onRefetch }: Props) {
  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Eliminare la lista "${nome}"?`)) return;
    try {
      await supabase.from("list_contacts").delete().eq("list_id", id);
      const { error } = await supabase.from("lists").delete().eq("id", id);
      if (error) throw error;
      toast.success("Lista eliminata");
      onRefetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-[10px]">NOME</TableHead>
            <TableHead className="font-mono text-[10px]">TIPO</TableHead>
            <TableHead className="font-mono text-[10px] text-right">CONTATTI</TableHead>
            <TableHead className="font-mono text-[10px]">CREATA</TableHead>
            <TableHead className="font-mono text-[10px] text-right">AZIONI</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center py-12 font-mono text-xs text-muted-foreground">Caricamento...</TableCell></TableRow>
          ) : lists.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="text-center py-12 font-mono text-xs text-muted-foreground">Nessuna lista creata</TableCell></TableRow>
          ) : lists.map(list => (
            <TableRow key={list.id} className="cursor-pointer" onClick={() => onSelect(list)}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {list.tipo === "dinamica" ? <Filter className="h-3.5 w-3.5 text-primary" /> : <Users className="h-3.5 w-3.5 text-muted-foreground" />}
                  <div>
                    <p className="font-mono text-xs font-medium text-foreground">{list.nome}</p>
                    {list.descrizione && <p className="font-mono text-[10px] text-muted-foreground truncate max-w-[200px]">{list.descrizione}</p>}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={list.tipo === "dinamica" ? "default" : "secondary"} className="font-mono text-[10px]">
                  {list.tipo === "dinamica" ? "DINAMICA" : "STATICA"}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-foreground">{list.totale_contatti.toLocaleString()}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {format(new Date(list.created_at), "dd MMM yyyy", { locale: it })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onSelect(list)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(list.id, list.nome)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
