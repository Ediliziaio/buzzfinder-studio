import { useMemo, useState, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Download, ListPlus, Globe, Star, ExternalLink, Mail, Search } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLists } from "@/hooks/useLists";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Contact } from "@/types";

interface Props {
  results: Contact[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  sessionId: string | null;
  totalFound: number;
  duplicates: number;
  onScrapeEmails?: (contacts: Contact[]) => void;
}

export function MapsResultsTable({ results, selectedIds, onSelectionChange, sessionId, totalFound, duplicates, onScrapeEmails }: Props) {
  const { lists } = useLists();
  const [exporting, setExporting] = useState(false);
  // Keep stable refs for callbacks used in column defs
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const handleExportCsv = async () => {
    if (results.length === 0) { toast.error("Nessun risultato da esportare"); return; }
    setExporting(true);
    try {
      // Export the contacts already in memory (fast, no extra DB round-trip)
      const toExport = selectedIds.size > 0 ? results.filter((r) => selectedIds.has(r.id)) : results;
      const headers = [
        "azienda", "email", "telefono", "sito_web", "indirizzo", "citta",
        "cap", "stato", "fonte", "google_rating", "google_reviews_count",
        "google_categories", "note",
      ];
      const csvRows = [headers.join(",")];
      for (const row of toExport) {
        const values = headers.map((h) => {
          const val = (row as any)[h];
          if (val === null || val === undefined) return "";
          if (Array.isArray(val)) return `"${val.join("; ")}"`;
          const str = String(val);
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        });
        csvRows.push(values.join(","));
      }
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `contatti_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${toExport.length} contatti esportati`);
    } catch (err: any) {
      toast.error(err.message || "Errore esportazione");
    } finally {
      setExporting(false);
    }
  };

  const handleAddToList = async (listId: string, listName: string) => {
    if (results.length === 0) { toast.error("Nessun contatto da aggiungere — avvia prima uno scraping"); return; }
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : results.map((r) => r.id);
    if (ids.length === 0) { toast.error("Nessun contatto selezionato"); return; }
    const inserts = ids.map((contact_id) => ({ list_id: listId, contact_id }));
    const { error } = await supabase.from("list_contacts").upsert(inserts, { onConflict: "list_id,contact_id" });
    if (error) { toast.error("Errore aggiunta a lista: " + error.message); return; }
    const { count } = await supabase.from("list_contacts").select("*", { count: "exact", head: true }).eq("list_id", listId);
    await supabase.from("lists").update({ totale_contatti: count || 0 }).eq("id", listId);
    toast.success(`${ids.length} contatti aggiunti a "${listName}"`);
  };

  const handleScrapeEmails = () => {
    const selected = results.filter((r) => selectedIds.has(r.id) && r.sito_web);
    if (selected.length === 0) { toast.error("Seleziona contatti con sito web"); return; }
    if (onScrapeEmails) {
      onScrapeEmails(selected);
    } else {
      const urls = selected.map((c) => c.sito_web!).filter(Boolean);
      toast.info(`${urls.length} URL pronti per lo scraping. Vai a Scraper → Siti Web.`);
    }
  };

  // Stable column definitions — use refs to avoid re-creating on every results/selectedIds change
  const columns = useMemo<ColumnDef<Contact>[]>(() => [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={resultsRef.current.length > 0 && selectedIdsRef.current.size === resultsRef.current.length}
          onChange={(e) => {
            onSelectionChangeRef.current(e.target.checked ? new Set(resultsRef.current.map((c) => c.id)) : new Set());
          }}
          className="accent-primary"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIdsRef.current.has(row.original.id)}
          onChange={(e) => {
            const next = new Set(selectedIdsRef.current);
            if (e.target.checked) next.add(row.original.id);
            else next.delete(row.original.id);
            onSelectionChangeRef.current(next);
          }}
          className="accent-primary"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 36,
    },
    {
      id: "index",
      header: "#",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">{row.index + 1}</span>
      ),
      size: 40,
    },
    {
      accessorKey: "azienda",
      header: "Nome Azienda",
      cell: ({ getValue }) => (
        <span className="text-sm font-medium text-foreground">{getValue() as string}</span>
      ),
      size: 200,
    },
    {
      accessorKey: "citta",
      header: "Città",
      cell: ({ getValue }) => (
        <span className="text-xs">{(getValue() as string) || "—"}</span>
      ),
      size: 100,
    },
    {
      accessorKey: "telefono",
      header: "Telefono",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{(getValue() as string) || "—"}</span>
      ),
      size: 130,
    },
    {
      accessorKey: "sito_web",
      header: "Sito Web",
      cell: ({ getValue }) => {
        const url = getValue() as string;
        if (!url) return <span className="text-muted-foreground text-xs">—</span>;
        const display = url.replace(/^https?:\/\/(www\.)?/, "").substring(0, 30);
        return (
          <a
            href={url.startsWith("http") ? url : `https://${url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-info hover:underline font-mono"
            onClick={(e) => e.stopPropagation()}
          >
            {display}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        );
      },
      size: 180,
    },
    {
      accessorKey: "google_rating",
      header: "⭐ Rating",
      cell: ({ row }) => {
        const rating = row.original.google_rating;
        if (!rating) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-warning fill-warning" />
            <span className="font-mono text-xs text-foreground">{rating}</span>
          </div>
        );
      },
      size: 80,
    },
    {
      accessorKey: "google_reviews_count",
      header: "💬 Rec.",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{(getValue() as number) || 0}</span>
      ),
      size: 60,
    },
    {
      accessorKey: "google_categories",
      header: "Categorie",
      cell: ({ getValue }) => {
        const cats = (getValue() as string[]) || [];
        if (cats.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {cats.slice(0, 2).map((c) => (
              <span key={c} className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{c}</span>
            ))}
            {cats.length > 2 && (
              <span className="text-[10px] font-mono text-muted-foreground">+{cats.length - 2}</span>
            )}
          </div>
        );
      },
      size: 160,
    },
    {
      accessorKey: "stato",
      header: "Stato",
      cell: ({ getValue }) => <StatusBadge status={(getValue() as string) || "nuovo"} />,
      size: 100,
    },
    {
      id: "actions",
      header: "Azioni",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {row.original.sito_web && (
            <a
              href={row.original.sito_web.startsWith("http") ? row.original.sito_web : `https://${row.original.sito_web}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <Globe className="h-3 w-3" />
              </Button>
            </a>
          )}
        </div>
      ),
      size: 80,
    },
  ], []); // stable — no deps needed, uses refs

  const table = useReactTable({
    data: results,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-sm font-bold text-foreground">
              {sessionId ? "RISULTATI SESSIONE" : "RISULTATI"}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
            <span>Trovati: <span className="text-foreground">{totalFound.toLocaleString()}</span></span>
            <span>Selezionati: <span className="text-foreground">{selectedIds.size}</span></span>
            {duplicates > 0 && (
              <span>Duplicati: <span className="text-warning">{duplicates}</span></span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="font-mono text-xs h-7" onClick={handleExportCsv} disabled={exporting}>
            <Download className="h-3 w-3 mr-1" /> {exporting ? "ESPORTA..." : "ESPORTA CSV"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="font-mono text-xs h-7">
                <ListPlus className="h-3 w-3 mr-1" /> AGGIUNGI A LISTA
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
          {selectedIds.size > 0 && (
            <Button size="sm" className="font-mono text-xs h-7" onClick={handleScrapeEmails}>
              <Mail className="h-3 w-3 mr-1" /> SCRAPA EMAIL ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {results.length === 0 ? (
        <div className="flex-1 rounded-lg border border-border bg-card flex items-center justify-center">
          <div className="text-center space-y-2">
            <Search className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-mono text-sm text-muted-foreground">
              Configura e avvia lo scraping per vedere i risultati
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 rounded-lg border border-border overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-accent">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="terminal-header px-2 py-2 text-left"
                      style={{ width: header.getSize() }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-t border-border transition-colors hover:bg-primary/5 hover:border-l-2 hover:border-l-primary ${
                    i % 2 === 0 ? "bg-card" : "bg-background"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-2 py-1.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
