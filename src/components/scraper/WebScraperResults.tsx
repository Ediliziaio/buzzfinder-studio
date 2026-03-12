import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Star, ExternalLink, Linkedin, Facebook, Instagram, Download } from "lucide-react";
import type { Contact, ScrapingJob } from "@/types";

interface Props {
  enrichedContacts: (Contact & { _jobs?: ScrapingJob[] })[];
  jobs: ScrapingJob[];
  onDetailClick: (job: ScrapingJob) => void;
}

function exportResultsCsv(completedJobs: ScrapingJob[]) {
  const headers = ["URL", "Email", "Telefoni", "LinkedIn", "Facebook", "Instagram", "Tempo (s)"];
  const rows = completedJobs.map((j) => {
    const social = (j.social_found || {}) as Record<string, string>;
    return [
      j.url,
      (j.emails_found || []).join("; "),
      (j.phones_found || []).join("; "),
      social.linkedin || "",
      social.facebook || "",
      social.instagram || "",
      j.processing_time_ms ? (j.processing_time_ms / 1000).toFixed(1) : "",
    ];
  });

  const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `scraper-risultati-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function WebScraperResults({ enrichedContacts, jobs, onDetailClick }: Props) {
  const completedJobs = jobs.filter((j) => j.status === "completed");

  const columns = useMemo<ColumnDef<ScrapingJob>[]>(() => [
    {
      accessorKey: "url",
      header: "Azienda / URL",
      cell: ({ row }) => {
        const url = row.original.url;
        const domain = url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
        return (
          <div>
            <span className="text-sm font-medium text-foreground">{domain}</span>
          </div>
        );
      },
      size: 180,
    },
    {
      id: "emails",
      header: "Email trovate",
      cell: ({ row }) => {
        const emails = row.original.emails_found || [];
        if (emails.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {emails.slice(0, 3).map((e) => (
              <span key={e} className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-mono text-primary">
                {e}
              </span>
            ))}
            {emails.length > 3 && (
              <span className="text-[10px] font-mono text-muted-foreground">+{emails.length - 3}</span>
            )}
          </div>
        );
      },
      size: 280,
    },
    {
      id: "confidence",
      header: "Confidenza",
      cell: ({ row }) => {
        const emails = row.original.emails_found || [];
        if (emails.length === 0) return null;
        const stars = Math.min(emails.length, 3);
        const color = stars >= 3 ? "text-primary" : stars >= 2 ? "text-warning" : "text-destructive";
        return (
          <div className="flex">
            {[1, 2, 3].map((i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i <= stars ? color : "text-muted"}`}
                fill={i <= stars ? "currentColor" : "none"}
              />
            ))}
          </div>
        );
      },
      size: 80,
    },
    {
      id: "phones",
      header: "Telefoni trovati",
      cell: ({ row }) => {
        const phones = row.original.phones_found || [];
        if (phones.length === 0) return <span className="text-muted-foreground text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {phones.map((p) => (
              <span key={p} className="font-mono text-xs text-foreground">{p}</span>
            ))}
          </div>
        );
      },
      size: 150,
    },
    {
      id: "socials",
      header: "Socials",
      cell: ({ row }) => {
        const social = (row.original.social_found || {}) as Record<string, string>;
        const hasLinkedin = !!social.linkedin;
        const hasFacebook = !!social.facebook;
        const hasInstagram = !!social.instagram;
        if (!hasLinkedin && !hasFacebook && !hasInstagram) {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return (
          <div className="flex items-center gap-1.5">
            {hasLinkedin && <Linkedin className="h-3.5 w-3.5 text-info" />}
            {hasFacebook && <Facebook className="h-3.5 w-3.5 text-info" />}
            {hasInstagram && <Instagram className="h-3.5 w-3.5 text-[hsl(var(--chart-4))]" />}
          </div>
        );
      },
      size: 80,
    },
    {
      id: "time",
      header: "Tempo",
      cell: ({ row }) => {
        const ms = row.original.processing_time_ms;
        if (!ms) return <span className="text-muted-foreground text-xs">—</span>;
        return <span className="font-mono text-xs text-muted-foreground">{(ms / 1000).toFixed(1)}s</span>;
      },
      size: 60,
    },
  ], []);

  const table = useReactTable({
    data: completedJobs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3">
        <div>
          <h2 className="font-display text-sm font-bold text-foreground">RISULTATI ARRICCHITI</h2>
          <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground mt-1">
            <span>Completati: <span className="text-primary">{completedJobs.length}</span></span>
            <span>Con email: <span className="text-foreground">{completedJobs.filter((j) => (j.emails_found?.length || 0) > 0).length}</span></span>
            <span>Con telefono: <span className="text-foreground">{completedJobs.filter((j) => (j.phones_found?.length || 0) > 0).length}</span></span>
          </div>
        </div>
        {completedJobs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="font-mono text-[10px] h-7"
            onClick={() => exportResultsCsv(completedJobs)}
          >
            <Download className="h-3 w-3 mr-1" /> ESPORTA CSV
          </Button>
        )}
      </div>

      {completedJobs.length === 0 ? (
        <div className="flex-1 rounded-lg border border-border bg-card flex items-center justify-center">
          <div className="text-center space-y-2">
            <ExternalLink className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-mono text-sm text-muted-foreground">
              I risultati arricchiti appariranno qui durante lo scraping
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
                  className={`border-t border-border cursor-pointer transition-colors hover:bg-primary/5 hover:border-l-2 hover:border-l-primary ${
                    i % 2 === 0 ? "bg-card" : "bg-background"
                  }`}
                  onClick={() => onDetailClick(row.original)}
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
