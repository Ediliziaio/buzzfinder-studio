import { Search, Globe } from "lucide-react";

export default function ScraperMapsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Search className="h-6 w-6 text-primary" />
        <h1 className="font-display text-xl font-bold text-foreground">SCRAPER GOOGLE MAPS</h1>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="font-mono text-sm text-muted-foreground">Modulo Scraper Maps — Fase 2</p>
      </div>
    </div>
  );
}
