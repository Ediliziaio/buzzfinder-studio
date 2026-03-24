import { useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Plus, Play, Pause, Square, Trash2, Download, ChevronDown,
  CheckCircle, XCircle, Loader2, Clock, RotateCcw, Globe, FileUp,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import type { WebScraperConfig } from "@/pages/ScraperWebsites";
import type { ScrapingJob } from "@/types";

const MAX_QUEUE_SIZE = 10000;
const URL_RE = /^(https?:\/\/)?([a-zA-Z0-9\-]+\.)+[a-zA-Z]{2,}(\/.*)?$/;

function isValidUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  return URL_RE.test(trimmed);
}

interface Props {
  urls: string[];
  jobs: ScrapingJob[];
  config: WebScraperConfig;
  onConfigChange: (config: WebScraperConfig) => void;
  onAddUrls: (urls: string[]) => void;
  onImportFromMaps: () => void;
  onImportFromContacts: () => void;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onClearQueue: () => void;
  onJobClick: (job: ScrapingJob) => void;
  onRetryJob?: (job: ScrapingJob) => void;
  isRunning: boolean;
  isPausing?: boolean;
  isPaused?: boolean;
  onResume?: () => void;
  stats: { queued: number; processing: number; completed: number; failed: number };
}

export function WebScraperQueue({
  urls, jobs, config, onConfigChange, onAddUrls, onImportFromMaps, onImportFromContacts,
  onStart, onPause, onStop, onClearQueue, onJobClick, onRetryJob, isRunning,
  isPausing, isPaused, onResume, stats,
}: Props) {
  const [urlInput, setUrlInput] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
      const start = /^(url|sito|website|link|domain)/i.test(lines[0] || "") ? 1 : 0;
      const extracted: string[] = [];
      for (let i = start; i < lines.length; i++) {
        const col = lines[i].split(/[,;\t]/)[0].replace(/^["']|["']$/g, "").trim();
        if (col && isValidUrl(col)) extracted.push(col);
      }
      if (extracted.length === 0) {
        toast.error("Nessun URL valido trovato nel CSV");
      } else {
        onAddUrls(extracted);
        toast.success(`${extracted.length} URL importati da CSV`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleAddUrl = () => {
    if (!urlInput.trim()) return;
    const lines = urlInput.split("\n").map((u) => u.trim()).filter(Boolean);
    const valid: string[] = [];
    const invalid: string[] = [];
    for (const line of lines) {
      if (isValidUrl(line)) valid.push(line);
      else invalid.push(line);
    }
    if (invalid.length > 0) {
      toast.warning(`${invalid.length} URL non validi scartati`, {
        description: invalid.slice(0, 3).join(", ") + (invalid.length > 3 ? "..." : ""),
      });
    }
    const currentTotal = urls.length + jobs.length;
    if (currentTotal + valid.length > MAX_QUEUE_SIZE) {
      const allowed = Math.max(0, MAX_QUEUE_SIZE - currentTotal);
      if (allowed === 0) {
        toast.error(`Limite massimo ${MAX_QUEUE_SIZE} URL raggiunto`);
        return;
      }
      toast.warning(`Solo ${allowed} URL aggiunti (limite ${MAX_QUEUE_SIZE})`);
      onAddUrls(valid.slice(0, allowed));
    } else {
      onAddUrls(valid);
    }
    setUrlInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddUrl();
    }
  };

  const displayItems: Array<{ type: "url" | "job"; url: string; job?: ScrapingJob }> = [
    ...jobs.map((j) => ({ type: "job" as const, url: j.url, job: j })),
    ...urls.filter((u) => !jobs.some((j) => j.url === u || j.url === `https://${u}`))
      .map((u) => ({ type: "url" as const, url: u })),
  ];

  const totalSpeed = jobs.filter((j) => j.status === "completed" && j.processing_time_ms).length;
  const avgTime = totalSpeed > 0
    ? Math.round(jobs.filter((j) => j.status === "completed" && j.processing_time_ms).reduce((s, j) => s + (j.processing_time_ms || 0), 0) / totalSpeed / 1000)
    : 0;

  return (
    <div className="flex flex-col h-full gap-3">
      {/* URL Input */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Textarea
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Incolla URL (uno per riga, Shift+Enter per nuova riga)..."
            className="font-mono text-xs bg-accent border-border min-h-[60px] max-h-[120px] resize-y"
            onKeyDown={handleKeyDown}
            rows={2}
          />
          <Button size="sm" onClick={handleAddUrl} className="shrink-0 self-end">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 font-mono text-[10px] h-7" onClick={onImportFromMaps}>
            <Download className="h-3 w-3 mr-1" /> DA MAPS
          </Button>
          <Button variant="outline" size="sm" className="flex-1 font-mono text-[10px] h-7" onClick={onImportFromContacts}>
            <Download className="h-3 w-3 mr-1" /> SENZA EMAIL
          </Button>
          <Button variant="outline" size="sm" className="flex-1 font-mono text-[10px] h-7" onClick={() => csvInputRef.current?.click()}>
            <FileUp className="h-3 w-3 mr-1" /> DA CSV
          </Button>
          <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvImport} />
        </div>
      </div>

      {/* Job list — cap visible items to avoid freezing with large queues */}
      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {displayItems.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="font-mono text-xs text-muted-foreground">
              Aggiungi URL o importa da contatti
            </p>
          </div>
        ) : (
          <>
            {displayItems.slice(0, 200).map((item, i) => (
              <JobItem
                key={item.job?.id || `url-${i}`}
                item={item}
                onClick={() => item.job && onJobClick(item.job)}
                onRetry={item.job && onRetryJob ? () => onRetryJob(item.job!) : undefined}
              />
            ))}
            {displayItems.length > 200 && (
              <div className="rounded-md border border-border bg-card px-3 py-2 text-center font-mono text-[10px] text-muted-foreground">
                … e altri {(displayItems.length - 200).toLocaleString()} URL in coda
              </div>
            )}
          </>
        )}
      </div>

      {/* Config */}
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors">
          <span>Configurazione</span>
          <ChevronDown className={`h-3 w-3 transition-transform ${configOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-3 rounded-md border border-border bg-card p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="font-mono text-[10px] text-muted-foreground">Timeout (sec)</Label>
              <Input
                type="number"
                value={config.timeoutSec}
                onChange={(e) => onConfigChange({ ...config, timeoutSec: parseInt(e.target.value) || 15 })}
                className="h-7 font-mono text-xs bg-accent border-border"
                disabled={isRunning}
              />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] text-muted-foreground">Delay (ms)</Label>
              <Input
                type="number"
                value={config.delayMs}
                onChange={(e) => onConfigChange({ ...config, delayMs: parseInt(e.target.value) || 1500 })}
                className="h-7 font-mono text-xs bg-accent border-border"
                disabled={isRunning}
              />
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-[10px] text-muted-foreground">Max tentativi</Label>
              <Input
                type="number"
                value={config.maxRetries}
                onChange={(e) => onConfigChange({ ...config, maxRetries: parseInt(e.target.value) || 2 })}
                className="h-7 font-mono text-xs bg-accent border-border"
                disabled={isRunning}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-[10px] text-muted-foreground">Profondità crawl</Label>
            <div className="flex gap-2">
              {(["homepage", "homepage_contacts"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => onConfigChange({ ...config, crawlDepth: v })}
                  disabled={isRunning}
                  className={`flex-1 rounded-md border px-2 py-1 font-mono text-[10px] transition-colors ${
                    config.crawlDepth === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-accent text-muted-foreground"
                  }`}
                >
                  {v === "homepage" ? "Solo homepage" : "Homepage + contatti"}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-[10px] text-muted-foreground">Cerca nelle pagine</Label>
            <div className="space-y-1">
              {([
                { key: "contatti", label: "Contatti" },
                { key: "chiSiamo", label: "Chi siamo" },
                { key: "tutte", label: "Tutte" },
              ] as const).map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
                  <Switch
                    checked={config.searchPages[key]}
                    onCheckedChange={(v) => onConfigChange({
                      ...config,
                      searchPages: { ...config.searchPages, [key]: v },
                    })}
                    disabled={isRunning}
                  />
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Stats + Controls */}
      <div className="rounded-lg border border-border bg-card p-3 space-y-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-mono text-muted-foreground">
          <span>In coda: <span className="text-foreground">{stats.queued}</span></span>
          <span>In corso: <span className="text-info">{stats.processing}</span></span>
          <span>Completati: <span className="text-primary">{stats.completed}</span></span>
          <span>Errori: <span className="text-destructive">{stats.failed}</span></span>
        </div>
        {avgTime > 0 && (
          <div className="text-[10px] font-mono text-muted-foreground">
            Velocità: ~{avgTime}s/sito | Stimato fine: {Math.round((stats.queued * avgTime) / 60)}min
          </div>
        )}

        {/* Pausing indicator */}
        {isPausing && (
          <div className="flex items-center gap-2 text-xs font-mono text-warning">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>In pausa... (job in corso in completamento)</span>
          </div>
        )}

        <div className="flex gap-2">
          {isPaused && onResume ? (
            <>
              <Button onClick={onResume} className="flex-1 font-mono text-xs" size="sm">
                <Play className="h-3 w-3 mr-1" /> RIPRENDI
              </Button>
              <Button onClick={onStop} variant="destructive" className="flex-1 font-mono text-xs" size="sm">
                <Square className="h-3 w-3 mr-1" /> STOP
              </Button>
            </>
          ) : isPausing ? (
            <>
              <Button disabled variant="outline" className="flex-1 font-mono text-xs" size="sm">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" /> IN PAUSA...
              </Button>
              <Button onClick={onStop} variant="destructive" className="flex-1 font-mono text-xs" size="sm">
                <Square className="h-3 w-3 mr-1" /> STOP
              </Button>
            </>
          ) : !isRunning ? (
            <Button onClick={onStart} className="flex-1 font-mono text-xs" size="sm" disabled={urls.length === 0 && jobs.length === 0}>
              <Play className="h-3 w-3 mr-1" /> AVVIA
            </Button>
          ) : (
            <>
              <Button onClick={onPause} variant="outline" className="flex-1 font-mono text-xs" size="sm">
                <Pause className="h-3 w-3 mr-1" /> PAUSA
              </Button>
              <Button onClick={onStop} variant="destructive" className="flex-1 font-mono text-xs" size="sm">
                <Square className="h-3 w-3 mr-1" /> STOP
              </Button>
            </>
          )}
          <Button onClick={onClearQueue} variant="ghost" size="sm" className="font-mono text-xs">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function JobItem({ item, onClick, onRetry }: { item: { type: "url" | "job"; url: string; job?: ScrapingJob }; onClick: () => void; onRetry?: () => void }) {
  const job = item.job;
  const domain = item.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];

  const statusIcon = !job ? (
    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
  ) : job.status === "completed" ? (
    <CheckCircle className="h-3.5 w-3.5 text-primary" />
  ) : job.status === "processing" ? (
    <Loader2 className="h-3.5 w-3.5 text-info animate-spin" />
  ) : job.status === "failed" ? (
    <XCircle className="h-3.5 w-3.5 text-destructive" />
  ) : (
    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
  );

  return (
    <div
      className={`rounded-md border border-border p-2 transition-colors cursor-pointer ${
        job?.status === "processing" ? "bg-info/5 border-info/30" : "bg-card hover:bg-accent"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {statusIcon}
        <span className="font-mono text-xs text-foreground truncate flex-1">{domain}</span>
        {job?.processing_time_ms && (
          <span className="font-mono text-[10px] text-muted-foreground">{(job.processing_time_ms / 1000).toFixed(1)}s</span>
        )}
      </div>

      {job?.status === "processing" && (
        <div className="mt-1 h-1 w-full rounded-full bg-muted overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-info shimmer" />
        </div>
      )}

      {job?.status === "completed" && (
        <div className="mt-1 flex gap-2 text-[10px] font-mono text-muted-foreground">
          {(job.emails_found?.length || 0) > 0 && (
            <span className="text-primary">📧 {job.emails_found!.length} email</span>
          )}
          {(job.phones_found?.length || 0) > 0 && (
            <span className="text-info">📞 {job.phones_found!.length} tel</span>
          )}
          {job.emails_found?.length === 0 && job.phones_found?.length === 0 && (
            <span className="text-muted-foreground">Nessun dato trovato</span>
          )}
        </div>
      )}

      {job?.status === "failed" && (
        <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-destructive">
          <span className="truncate">{job.error_message || "Errore"}</span>
          {onRetry && (
            <Button
              variant="ghost"
              size="sm"
              className="h-4 px-1 text-[10px]"
              onClick={(e) => { e.stopPropagation(); onRetry(); }}
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
