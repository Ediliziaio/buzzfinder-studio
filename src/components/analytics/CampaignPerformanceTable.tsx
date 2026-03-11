import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface CampaignRow {
  id: string;
  nome: string;
  stato: string;
  inviati: number;
  aperti: number;
  cliccati: number;
  errori: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

interface Props {
  campaigns: CampaignRow[];
  onSelectCampaign?: (id: string) => void;
}

type SortKey = "inviati" | "openRate" | "clickRate" | "bounceRate";

export function CampaignPerformanceTable({ campaigns, onSelectCampaign }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("inviati");
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...campaigns].sort((a, b) => {
    const diff = (a[sortKey] || 0) - (b[sortKey] || 0);
    return sortAsc ? diff : -diff;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const sortIcon = (key: SortKey) => sortKey === key ? (sortAsc ? " ↑" : " ↓") : "";

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="terminal-header">Performance per Campagna</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-mono text-xs">Campagna</TableHead>
            <TableHead className="font-mono text-xs text-right cursor-pointer" onClick={() => toggleSort("inviati")}>Inviati{sortIcon("inviati")}</TableHead>
            <TableHead className="font-mono text-xs text-right cursor-pointer" onClick={() => toggleSort("openRate")}>Open %{sortIcon("openRate")}</TableHead>
            <TableHead className="font-mono text-xs text-right cursor-pointer" onClick={() => toggleSort("clickRate")}>Click %{sortIcon("clickRate")}</TableHead>
            <TableHead className="font-mono text-xs text-right cursor-pointer" onClick={() => toggleSort("bounceRate")}>Bounce %{sortIcon("bounceRate")}</TableHead>
            <TableHead className="font-mono text-xs text-right">Stato</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((c) => (
            <TableRow
              key={c.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelectCampaign?.(c.id)}
            >
              <TableCell className="font-mono text-xs font-semibold">{c.nome}</TableCell>
              <TableCell className="font-mono text-xs text-right">{c.inviati.toLocaleString()}</TableCell>
              <TableCell className={`font-mono text-xs text-right ${c.openRate > 30 ? "text-success" : c.openRate < 10 ? "text-destructive" : ""}`}>
                {c.openRate.toFixed(1)}%
              </TableCell>
              <TableCell className={`font-mono text-xs text-right ${c.clickRate > 5 ? "text-success" : ""}`}>
                {c.clickRate.toFixed(1)}%
              </TableCell>
              <TableCell className={`font-mono text-xs text-right ${c.bounceRate > 5 ? "text-destructive" : ""}`}>
                {c.bounceRate.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right">
                <Badge variant={c.stato === "in_corso" ? "default" : "outline"} className="font-mono text-[10px]">
                  {c.stato}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center font-mono text-xs text-muted-foreground py-8">
                Nessuna campagna nel periodo selezionato
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
