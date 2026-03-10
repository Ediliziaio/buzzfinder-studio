import { useState, useRef, useCallback } from "react";
import { Sparkles, Play, Square, RotateCcw, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TerminalProgress } from "@/components/shared/TerminalProgress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Campaign } from "@/types";

interface Props {
  campaign: Campaign;
  onUpdate: () => void;
}

interface PreviewMsg {
  contact: string;
  subject?: string;
  body: string;
}

export function AiPersonalizationPanel({ campaign, onUpdate }: Props) {
  const [running, setRunning] = useState(false);
  const [previews, setPreviews] = useState<PreviewMsg[]>([]);
  const isStopped = useRef(false);

  const processed = campaign.ai_personalization_processed || 0;
  const total = campaign.ai_personalization_total || campaign.totale_destinatari || 0;
  const status = campaign.ai_personalization_status || "none";
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  const runPersonalization = useCallback(async () => {
    isStopped.current = false;
    setRunning(true);
    setPreviews([]);

    // Set status to processing
    await supabase.from("campaigns").update({
      ai_personalization_status: "processing",
      ai_personalization_total: campaign.totale_destinatari,
      ai_personalization_processed: 0,
    } as any).eq("id", campaign.id);
    onUpdate();

    const BATCH_SIZE = 20;
    let offset = 0;
    let totalProcessed = 0;
    let totalCost = 0;

    try {
      while (!isStopped.current) {
        const { data, error } = await supabase.functions.invoke("personalize-messages", {
          body: {
            campaign_id: campaign.id,
            batch_size: BATCH_SIZE,
            offset,
            model: campaign.ai_model || "haiku",
            context: campaign.ai_context || "",
            objective: campaign.ai_objective || "",
            subject_template: campaign.subject || "",
            body_template: campaign.body_html || campaign.body_text || "",
            tipo: campaign.tipo,
          },
        });

        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        const batchProcessed = data?.processed || 0;
        const batchCost = data?.cost_eur || 0;
        totalProcessed += batchProcessed;
        totalCost += batchCost;

        // Collect previews from first batch
        if (offset === 0 && data?.previews) {
          setPreviews(data.previews.slice(0, 3));
        }

        // Update campaign progress
        await supabase.from("campaigns").update({
          ai_personalization_processed: totalProcessed,
          ai_cost_eur: totalCost,
        } as any).eq("id", campaign.id);
        onUpdate();

        if (data?.done || batchProcessed < BATCH_SIZE) {
          // All done
          await supabase.from("campaigns").update({
            ai_personalization_status: "completed",
            ai_personalization_processed: totalProcessed,
            ai_cost_eur: totalCost,
          } as any).eq("id", campaign.id);
          toast.success(`Personalizzazione completata: ${totalProcessed} messaggi generati`);
          break;
        }

        offset += BATCH_SIZE;
        await new Promise((r) => setTimeout(r, 200));
      }

      if (isStopped.current) {
        await supabase.from("campaigns").update({
          ai_personalization_status: "partial",
          ai_personalization_processed: totalProcessed,
          ai_cost_eur: totalCost,
        } as any).eq("id", campaign.id);
        toast.info("Personalizzazione interrotta — messaggi parziali salvati");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore sconosciuto";
      toast.error(`Errore AI: ${msg}`);
      await supabase.from("campaigns").update({
        ai_personalization_status: "failed",
      } as any).eq("id", campaign.id);
    } finally {
      setRunning(false);
      onUpdate();
    }
  }, [campaign, onUpdate]);

  const handleStop = () => {
    isStopped.current = true;
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="terminal-header text-primary">PERSONALIZZAZIONE AI</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "completed" && (
            <span className="font-mono text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded">
              ✅ Completata
            </span>
          )}
          {status === "partial" && (
            <span className="font-mono text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded">
              ⚠️ Parziale
            </span>
          )}
          {status === "failed" && (
            <span className="font-mono text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded">
              ❌ Errore
            </span>
          )}
        </div>
      </div>

      {/* Model + context info */}
      <div className="grid grid-cols-2 gap-3 font-mono text-xs">
        <div>
          <span className="text-muted-foreground">Modello:</span>
          <span className="ml-2 text-foreground">{campaign.ai_model === "sonnet" ? "Claude Sonnet" : "Claude Haiku"}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Costo AI:</span>
          <span className="ml-2 text-primary font-bold">€{Number(campaign.ai_cost_eur || 0).toFixed(2)}</span>
        </div>
      </div>

      {campaign.ai_context && (
        <div className="font-mono text-[10px] text-muted-foreground bg-accent rounded p-2 line-clamp-2">
          {campaign.ai_context}
        </div>
      )}

      {/* Progress */}
      {(running || status === "processing") && (
        <TerminalProgress
          percent={percent}
          current={processed}
          total={total}
          label="GENERAZIONE MESSAGGI"
        />
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!running && (status === "none" || status === "failed" || status === "partial") && (
          <Button size="sm" className="font-mono text-xs" onClick={runPersonalization}>
            <Play className="h-3 w-3 mr-1" />
            {status === "none" ? "Genera messaggi personalizzati" : "Riprendi generazione"}
          </Button>
        )}
        {running && (
          <Button variant="outline" size="sm" className="font-mono text-xs text-destructive" onClick={handleStop}>
            <Square className="h-3 w-3 mr-1" /> Ferma
          </Button>
        )}
        {status === "completed" && (
          <Button variant="outline" size="sm" className="font-mono text-xs" onClick={runPersonalization}>
            <RotateCcw className="h-3 w-3 mr-1" /> Rigenera tutti
          </Button>
        )}
      </div>

      {/* Previews */}
      {previews.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase">Anteprima messaggi generati</span>
          </div>
          {previews.map((p, i) => (
            <div key={i} className="rounded-md border border-border bg-accent p-3 space-y-1">
              <div className="font-mono text-[10px] text-primary font-bold">{p.contact}</div>
              {p.subject && (
                <div className="font-mono text-xs text-foreground">
                  <span className="text-muted-foreground">Ogg: </span>{p.subject}
                </div>
              )}
              <div className="font-mono text-[10px] text-muted-foreground line-clamp-3">{p.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
