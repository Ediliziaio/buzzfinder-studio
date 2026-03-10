import { cn } from "@/lib/utils";
import type { ContactStato, ContactFonte, CampaignStato, ScrapingSessionStatus } from "@/types";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  nuovo: "border-info bg-info/10 text-info",
  da_contattare: "border-warning bg-warning/10 text-warning",
  contattato: "border-primary bg-primary/10 text-primary",
  risposto: "bg-primary text-primary-foreground",
  non_interessato: "border-muted-foreground bg-muted text-muted-foreground",
  cliente: "bg-[hsl(262,80%,70%)] text-primary-foreground",
  // Fonti
  google_maps: "border-info bg-info/10 text-info",
  csv_import: "border-[hsl(262,80%,70%)] bg-[hsl(262,80%,70%)]/10 text-[hsl(262,80%,70%)]",
  manuale: "border-muted-foreground bg-muted text-muted-foreground",
  web_scrape: "border-warning bg-warning/10 text-warning",
  // Campaign / scraping status
  bozza: "border-muted-foreground bg-muted text-muted-foreground",
  schedulata: "border-info bg-info/10 text-info",
  in_corso: "border-primary bg-primary/10 text-primary",
  completata: "bg-primary text-primary-foreground",
  pausa: "border-warning bg-warning/10 text-warning",
  errore: "border-destructive bg-destructive/10 text-destructive",
  pending: "border-muted-foreground bg-muted text-muted-foreground",
  running: "border-primary bg-primary/10 text-primary",
  completed: "bg-primary text-primary-foreground",
  failed: "border-destructive bg-destructive/10 text-destructive",
  paused: "border-warning bg-warning/10 text-warning",
  // Recipients
  sent: "border-primary bg-primary/10 text-primary",
  delivered: "bg-primary text-primary-foreground",
  opened: "border-info bg-info/10 text-info",
  clicked: "border-[hsl(262,80%,70%)] bg-[hsl(262,80%,70%)]/10 text-[hsl(262,80%,70%)]",
  bounced: "border-destructive bg-destructive/10 text-destructive",
  unsubscribed: "border-muted-foreground bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  nuovo: "Nuovo",
  da_contattare: "Da contattare",
  contattato: "Contattato",
  risposto: "Risposto",
  non_interessato: "Non interessato",
  cliente: "Cliente",
  google_maps: "Maps",
  csv_import: "CSV",
  manuale: "Manuale",
  web_scrape: "Web",
  bozza: "Bozza",
  schedulata: "Schedulata",
  in_corso: "In corso",
  completata: "Completata",
  pausa: "In pausa",
  errore: "Errore",
  pending: "In attesa",
  running: "In esecuzione",
  completed: "Completato",
  failed: "Fallito",
  paused: "In pausa",
  sent: "Inviato",
  delivered: "Consegnato",
  opened: "Aperto",
  clicked: "Cliccato",
  bounced: "Rimbalzato",
  unsubscribed: "Disiscritto",
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-mono font-medium transition-colors",
        statusStyles[status] || "border-muted-foreground bg-muted text-muted-foreground",
        className
      )}
    >
      {statusLabels[status] || status}
    </span>
  );
}
