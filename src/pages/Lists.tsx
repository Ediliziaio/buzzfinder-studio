import { List } from "lucide-react";

export default function ListsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <List className="h-6 w-6 text-primary" />
        <h1 className="font-display text-xl font-bold text-foreground">LISTE</h1>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="font-mono text-sm text-muted-foreground">Modulo Liste — Fase 5</p>
      </div>
    </div>
  );
}
