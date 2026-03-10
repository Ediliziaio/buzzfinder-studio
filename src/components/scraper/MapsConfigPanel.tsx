import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Play, Pause, Square, ChevronDown, RotateCcw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { MapsConfig } from "@/pages/ScraperMaps";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  config: MapsConfig;
  onChange: (config: MapsConfig) => void;
  costEstimate: string;
  isRunning: boolean;
  isPaused?: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume?: () => void;
  onStop: () => void;
}

const categorySuggestions = [
  "serramentisti", "idraulici", "imprese edili", "geometri", "elettricisti",
  "falegnamerie", "carpenterie", "studi tecnici", "agenzie immobiliari",
  "commercialisti", "avvocati", "dentisti", "ristoranti", "hotel",
];

const citySuggestions = ["Milano", "Roma", "Torino", "Bologna", "Firenze", "Napoli"];

const maxResultsOptions = [100, 500, 1000, 2500, 5000];

export function MapsConfigPanel({ config, onChange, costEstimate, isRunning, isPaused, onStart, onPause, onResume, onStop }: Props) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const disabled = isRunning || !!isPaused;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      {/* Query */}
      <div className="space-y-1.5">
        <Label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Categoria business *</Label>
        <Input
          value={config.query}
          onChange={(e) => onChange({ ...config, query: e.target.value })}
          placeholder="es. serramentisti, idraulici..."
          className="font-mono text-sm bg-accent border-border"
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-1">
          {categorySuggestions.slice(0, 6).map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...config, query: s })}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              disabled={disabled}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* City */}
      <div className="space-y-1.5">
        <Label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Città *</Label>
        <Input
          value={config.citta}
          onChange={(e) => onChange({ ...config, citta: e.target.value })}
          placeholder="es. Milano"
          className="font-mono text-sm bg-accent border-border"
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-1">
          {citySuggestions.map((s) => (
            <button
              key={s}
              onClick={() => onChange({ ...config, citta: s })}
              className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              disabled={disabled}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Radius */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Raggio di ricerca</Label>
          <span className="font-mono text-xs text-foreground">{config.raggio} km</span>
        </div>
        <Slider
          value={[config.raggio]}
          onValueChange={([v]) => onChange({ ...config, raggio: v })}
          min={1}
          max={100}
          step={1}
          disabled={disabled}
          className="py-2"
        />
      </div>

      {/* Max results */}
      <div className="space-y-1.5">
        <Label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Massimo risultati</Label>
        <div className="flex gap-2">
          {maxResultsOptions.map((n) => (
            <button
              key={n}
              onClick={() => onChange({ ...config, maxResults: n })}
              disabled={disabled}
              className={`flex-1 rounded-md border px-2 py-1.5 font-mono text-xs transition-colors ${
                config.maxResults === n
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-accent text-muted-foreground hover:text-foreground"
              }`}
            >
              {n >= 1000 ? `${n / 1000}k` : n}
            </button>
          ))}
        </div>
      </div>

      {/* Advanced filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-accent px-3 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
          <span>Filtri Avanzati</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-3 rounded-md border border-border bg-accent p-3">
          <div className="flex items-center justify-between">
            <Label className="font-mono text-xs text-muted-foreground">Solo con sito web</Label>
            <Switch
              checked={config.soloConSito}
              onCheckedChange={(v) => onChange({ ...config, soloConSito: v })}
              disabled={disabled}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="font-mono text-xs text-muted-foreground">Solo con telefono</Label>
            <Switch
              checked={config.soloConTelefono}
              onCheckedChange={(v) => onChange({ ...config, soloConTelefono: v })}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-xs text-muted-foreground">Rating minimo</Label>
            <Select
              value={String(config.ratingMin)}
              onValueChange={(v) => onChange({ ...config, ratingMin: parseFloat(v) })}
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs font-mono bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Qualsiasi</SelectItem>
                <SelectItem value="3">3.0+</SelectItem>
                <SelectItem value="3.5">3.5+</SelectItem>
                <SelectItem value="4">4.0+</SelectItem>
                <SelectItem value="4.5">4.5+</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="font-mono text-xs text-muted-foreground">N° recensioni minimo</Label>
            <Input
              type="number"
              value={config.recensioniMin}
              onChange={(e) => onChange({ ...config, recensioniMin: parseInt(e.target.value) || 0 })}
              className="h-8 font-mono text-xs bg-background border-border"
              disabled={disabled}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Cost estimate */}
      <div className="rounded-md border border-border bg-accent p-3 space-y-1">
        <div className="terminal-header">STIMA COSTI API</div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">
            Google Places: ~€2.50 / 1.000
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground">⚡</span>
          <span className="font-mono text-sm text-warning font-medium">Stimato: €{costEstimate}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          onClick={onStart}
          disabled={disabled || !config.query || !config.citta}
          className="w-full font-mono font-bold"
          size="lg"
        >
          <Play className="h-4 w-4 mr-2" />
          AVVIA SCRAPING
        </Button>
        {(isRunning || isPaused) && (
          <div className="flex gap-2">
            {isPaused ? (
              <Button onClick={onResume} variant="outline" className="flex-1 font-mono text-xs">
                <RotateCcw className="h-3 w-3 mr-1" /> RIPRENDI
              </Button>
            ) : (
              <Button onClick={onPause} variant="outline" className="flex-1 font-mono text-xs">
                <Pause className="h-3 w-3 mr-1" /> PAUSA
              </Button>
            )}
            <Button onClick={onStop} variant="destructive" className="flex-1 font-mono text-xs">
              <Square className="h-3 w-3 mr-1" /> STOP
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
