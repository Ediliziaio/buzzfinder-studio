import { useState, type DragEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { Euro, Trash2 } from "lucide-react";

export interface PipelineLeadWithRelations {
  id: string;
  pipeline_stage: string;
  pipeline_note: string | null;
  valore_stimato: number;
  pipeline_updated: string;
  created_at: string;
  contact_id?: string | null;
  campaign_id?: string | null;
  contact?: { nome: string | null; cognome: string | null; azienda: string; email: string | null } | null;
  campaign?: { id?: string; nome: string } | null;
}

const NEXT_STAGES: Record<string, string[]> = {
  interessato: ["richiesta_info", "meeting_fissato", "perso"],
  richiesta_info: ["meeting_fissato", "proposta_inviata", "perso"],
  meeting_fissato: ["proposta_inviata", "vinto", "perso"],
  proposta_inviata: ["vinto", "perso"],
  vinto: [],
  perso: ["interessato"],
};

const stageLabels: Record<string, string> = {
  interessato: "Interessato",
  richiesta_info: "Info",
  meeting_fissato: "Meeting",
  proposta_inviata: "Proposta",
  vinto: "Vinto",
  perso: "Perso",
};

interface Props {
  lead: PipelineLeadWithRelations;
  currentStage: string;
  onMoveStage: (leadId: string, newStage: string) => void;
  onUpdateNote: (leadId: string, note: string) => void;
  onUpdateValue: (leadId: string, value: number) => void;
  onDelete?: (leadId: string) => void;
}

export function LeadCard({ lead, currentStage, onMoveStage, onUpdateNote, onUpdateValue, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const nextStages = NEXT_STAGES[currentStage] || [];

  const handleDragStart = (e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };

  const handleDragEnd = () => setIsDragging(false);

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`bg-card border border-border rounded-lg p-3 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40 scale-95" : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="font-mono font-semibold text-sm text-foreground">
        {lead.contact?.nome || ""} {lead.contact?.cognome || ""}
      </div>
      <div className="font-mono text-xs text-muted-foreground">{lead.contact?.azienda}</div>
      {lead.campaign && (
        <div className="font-mono text-xs text-muted-foreground mt-0.5">📧 {lead.campaign.nome}</div>
      )}
      {lead.pipeline_note && (
        <p className="text-xs mt-1.5 italic text-muted-foreground line-clamp-2">{lead.pipeline_note}</p>
      )}

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
          {/* Editable value */}
          <div className="flex items-center gap-2">
            <Euro className="h-3 w-3 text-muted-foreground" />
            <Input
              type="number"
              placeholder="Valore stimato €"
              className="text-xs font-mono h-7"
              defaultValue={lead.valore_stimato || ""}
              onBlur={(e) => {
                const val = parseFloat(e.target.value) || 0;
                if (val !== lead.valore_stimato) onUpdateValue(lead.id, val);
              }}
            />
          </div>
          <Textarea
            placeholder="Aggiungi nota..."
            className="text-xs font-mono"
            rows={2}
            defaultValue={lead.pipeline_note || ""}
            onBlur={(e) => onUpdateNote(lead.id, e.target.value)}
          />
          {nextStages.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {nextStages.map((ns) => (
                <Button
                  key={ns}
                  size="sm"
                  variant="outline"
                  className="text-xs font-mono"
                  onClick={() => onMoveStage(lead.id, ns)}
                >
                  → {stageLabels[ns] || ns}
                </Button>
              ))}
            </div>
          )}
          {/* Delete button */}
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive text-xs font-mono w-full mt-1">
                  <Trash2 className="h-3 w-3 mr-1" /> Rimuovi lead
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rimuovere questo lead?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Il lead "{lead.contact?.nome || ""} {lead.contact?.cognome || ""} — {lead.contact?.azienda}" verrà rimosso dalla pipeline. Il contatto non verrà eliminato.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(lead.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Rimuovi</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-muted-foreground font-mono">
          {formatDistanceToNow(new Date(lead.pipeline_updated), { addSuffix: true, locale: it })}
        </span>
        {lead.valore_stimato > 0 && (
          <span className="font-mono text-xs text-success font-bold">€{lead.valore_stimato.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
