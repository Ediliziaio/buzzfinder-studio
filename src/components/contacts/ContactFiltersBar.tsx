import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContactFilters, ContactStato, ContactFonte } from "@/types";

interface Props {
  filters: ContactFilters;
  onChange: (filters: ContactFilters) => void;
}

const statiOptions: ContactStato[] = ["nuovo", "da_contattare", "contattato", "risposto", "non_interessato", "cliente"];
const fonteOptions: ContactFonte[] = ["google_maps", "csv_import", "manuale", "web_scrape"];

export function ContactFiltersBar({ filters, onChange }: Props) {
  const hasActiveFilters = Object.values(filters).some((v) =>
    Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ""
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca nome, azienda, email, tel..."
          value={filters.search || ""}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-9 h-8 font-mono text-xs bg-accent border-border"
        />
      </div>

      {/* Stato */}
      <Select
        value={filters.stato?.[0] || "all"}
        onValueChange={(v) => onChange({ ...filters, stato: v === "all" ? undefined : [v as ContactStato] })}
      >
        <SelectTrigger className="w-[140px] h-8 text-xs font-mono bg-accent border-border">
          <SelectValue placeholder="Stato" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutti gli stati</SelectItem>
          {statiOptions.map((s) => (
            <SelectItem key={s} value={s} className="font-mono text-xs">{s.replace("_", " ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Fonte */}
      <Select
        value={filters.fonte?.[0] || "all"}
        onValueChange={(v) => onChange({ ...filters, fonte: v === "all" ? undefined : [v as ContactFonte] })}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs font-mono bg-accent border-border">
          <SelectValue placeholder="Fonte" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tutte le fonti</SelectItem>
          {fonteOptions.map((f) => (
            <SelectItem key={f} value={f} className="font-mono text-xs">{f.replace("_", " ")}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Has email */}
      <Select
        value={filters.hasEmail === undefined ? "all" : filters.hasEmail ? "yes" : "no"}
        onValueChange={(v) => onChange({ ...filters, hasEmail: v === "all" ? undefined : v === "yes" })}
      >
        <SelectTrigger className="w-[120px] h-8 text-xs font-mono bg-accent border-border">
          <SelectValue placeholder="Ha email" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Email: tutti</SelectItem>
          <SelectItem value="yes">Con email</SelectItem>
          <SelectItem value="no">Senza email</SelectItem>
        </SelectContent>
      </Select>

      {/* Has telefono */}
      <Select
        value={filters.hasTelefono === undefined ? "all" : filters.hasTelefono ? "yes" : "no"}
        onValueChange={(v) => onChange({ ...filters, hasTelefono: v === "all" ? undefined : v === "yes" })}
      >
        <SelectTrigger className="w-[120px] h-8 text-xs font-mono bg-accent border-border">
          <SelectValue placeholder="Ha tel" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Tel: tutti</SelectItem>
          <SelectItem value="yes">Con telefono</SelectItem>
          <SelectItem value="no">Senza telefono</SelectItem>
        </SelectContent>
      </Select>

      {/* Reset */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs font-mono text-muted-foreground" onClick={() => onChange({})}>
          <X className="h-3 w-3 mr-1" /> RESET
        </Button>
      )}
    </div>
  );
}
