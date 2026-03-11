import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { Contact } from "@/types";
import { Star } from "lucide-react";

interface Props {
  contacts: Contact[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onContactClick: (contact: Contact) => void;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export function ContactsTable({ contacts, isLoading, selectedIds, onSelectionChange, onContactClick, page, totalPages, totalCount, onPageChange }: Props) {
  const columns = useMemo<ColumnDef<Contact>[]>(() => [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={contacts.length > 0 && selectedIds.size === contacts.length}
          onChange={(e) => {
            if (e.target.checked) {
              onSelectionChange(new Set(contacts.map((c) => c.id)));
            } else {
              onSelectionChange(new Set());
            }
          }}
          className="accent-primary"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.original.id)}
          onChange={(e) => {
            const next = new Set(selectedIds);
            if (e.target.checked) next.add(row.original.id);
            else next.delete(row.original.id);
            onSelectionChange(next);
          }}
          className="accent-primary"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      size: 40,
    },
    {
      accessorKey: "azienda",
      header: "Nome / Azienda",
      cell: ({ row }) => (
        <div>
          {row.original.nome && (
            <div className="font-medium text-foreground text-sm">{row.original.nome} {row.original.cognome}</div>
          )}
          <div className="text-muted-foreground text-xs">{row.original.azienda}</div>
        </div>
      ),
      size: 200,
    },
    {
      accessorKey: "citta",
      header: "Città",
      cell: ({ getValue }) => <span className="text-sm">{(getValue() as string) || "—"}</span>,
      size: 120,
    },
    {
      accessorKey: "telefono",
      header: "Telefono",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs">{(getValue() as string) || "—"}</span>
      ),
      size: 140,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => {
        const email = row.original.email;
        const confidence = row.original.email_confidence;
        if (!email) return <span className="text-muted-foreground text-xs">—</span>;
        const color = confidence >= 3 ? "text-primary" : confidence >= 2 ? "text-warning" : "text-destructive";
        return (
          <div className="flex items-center gap-1">
            <span className={`text-xs font-mono ${color}`}>{email}</span>
            <div className="flex">
              {[1, 2, 3].map((i) => (
                <Star key={i} className={`h-2.5 w-2.5 ${i <= confidence ? color : "text-muted"}`} fill={i <= confidence ? "currentColor" : "none"} />
              ))}
            </div>
          </div>
        );
      },
      size: 220,
    },
    {
      accessorKey: "email_quality",
      header: "Qualità",
      cell: ({ row }) => {
        const q = (row.original as any).email_quality;
        if (q === "valid") return <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">✓ Valida</span>;
        if (q === "risky") return <span className="rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] text-accent-foreground">⚠ Rischio</span>;
        if (q === "invalid") return <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive">✗ Invalida</span>;
        return <span className="font-mono text-[10px] text-muted-foreground">—</span>;
      },
      size: 80,
    },
    {
      accessorKey: "fonte",
      header: "Fonte",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      size: 80,
    },
    {
      accessorKey: "stato",
      header: "Stato",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      size: 120,
    },
    {
      accessorKey: "ultima_attivita",
      header: "Ultima attività",
      cell: ({ getValue }) => {
        const val = getValue() as string;
        if (!val) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs text-muted-foreground">{new Date(val).toLocaleDateString("it-IT")}</span>;
      },
      size: 120,
    },
  ], [contacts, selectedIds, onSelectionChange]);

  const table = useReactTable({
    data: contacts,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <div className="font-mono text-sm text-muted-foreground">Caricamento contatti...</div>
      </div>
    );
  }

  if (contacts.length === 0 && page === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <div className="font-mono text-sm text-muted-foreground">Nessun contatto trovato</div>
        <p className="mt-1 text-xs text-muted-foreground">Importa un CSV o avvia lo scraper per popolare il database.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="bg-accent">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="terminal-header px-3 py-2 text-left"
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
                  className={`border-t border-border cursor-pointer transition-colors hover:bg-primary/5 hover:border-l-2 hover:border-l-primary ${
                    i % 2 === 0 ? "bg-card" : "bg-background"
                  }`}
                  onClick={() => onContactClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">
          Pagina {page + 1} di {totalPages || 1} — {totalCount.toLocaleString()} contatti totali
        </span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => onPageChange(0)}>
            <ChevronsLeft className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => onPageChange(page - 1)}>
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)}>
            <ChevronRight className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => onPageChange(totalPages - 1)}>
            <ChevronsRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
