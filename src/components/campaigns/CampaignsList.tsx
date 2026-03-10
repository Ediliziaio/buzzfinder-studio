import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Mail, MessageSquare, Phone, MoreVertical, Copy, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Campaign } from "@/types";

const tipoIcons: Record<string, React.ReactNode> = {
  email: <Mail className="h-4 w-4" />,
  sms: <Phone className="h-4 w-4" />,
  whatsapp: <MessageSquare className="h-4 w-4" />,
};

// StatusBadge uses the `status` prop directly with its internal mapping

interface CampaignsListProps {
  campaigns: Campaign[];
  isLoading: boolean;
  onEdit: (campaign: Campaign) => void;
  onDuplicate: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
}

export function CampaignsList({ campaigns, isLoading, onEdit, onDuplicate, onDelete }: CampaignsListProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <p className="font-mono text-sm text-muted-foreground">Caricamento campagne...</p>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <Mail className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <p className="mt-3 font-mono text-sm text-muted-foreground">Nessuna campagna creata</p>
        <p className="mt-1 text-xs text-muted-foreground/70">Crea la tua prima campagna Email, SMS o WhatsApp</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="terminal-header">Tipo</TableHead>
            <TableHead className="terminal-header">Nome</TableHead>
            <TableHead className="terminal-header">Stato</TableHead>
            <TableHead className="terminal-header text-right">Destinatari</TableHead>
            <TableHead className="terminal-header text-right">Inviati</TableHead>
            <TableHead className="terminal-header text-right">Aperti</TableHead>
            <TableHead className="terminal-header text-right">Click</TableHead>
            <TableHead className="terminal-header text-right">Costo</TableHead>
            <TableHead className="terminal-header">Creata</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((c) => {
            const openRate = c.inviati > 0 ? ((c.aperti / c.inviati) * 100).toFixed(1) : "—";
            const clickRate = c.inviati > 0 ? ((c.cliccati / c.inviati) * 100).toFixed(1) : "—";
            return (
              <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => onEdit(c)}>
                <TableCell>
                  <span className="text-primary">{tipoIcons[c.tipo]}</span>
                </TableCell>
                <TableCell className="font-mono text-sm font-medium">{c.nome}</TableCell>
                <TableCell>
                  <StatusBadge status={c.stato} />
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{c.totale_destinatari.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-sm">{c.inviati.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-sm">{openRate}{openRate !== "—" ? "%" : ""}</TableCell>
                <TableCell className="text-right font-mono text-sm">{clickRate}{clickRate !== "—" ? "%" : ""}</TableCell>
                <TableCell className="text-right font-mono text-sm">€{Number(c.costo_reale_eur || 0).toFixed(2)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {format(new Date(c.created_at), "dd MMM yy", { locale: it })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(c); }}>
                        <Copy className="mr-2 h-4 w-4" /> Duplica
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(c); }}>
                        <Trash2 className="mr-2 h-4 w-4" /> Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
