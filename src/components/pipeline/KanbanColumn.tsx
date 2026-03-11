import { useState, type DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { LeadCard, type PipelineLeadWithRelations } from "./LeadCard";

export interface PipelineStage {
  id: string;
  label: string;
  colorClass: string;
}

interface Props {
  stage: PipelineStage;
  leads: PipelineLeadWithRelations[];
  onMoveStage: (leadId: string, newStage: string) => void;
  onUpdateNote: (leadId: string, note: string) => void;
  onUpdateValue: (leadId: string, value: number) => void;
}

export function KanbanColumn({ stage, leads, onMoveStage, onUpdateNote, onUpdateValue }: Props) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId) onMoveStage(leadId, stage.id);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-shrink-0 w-72 border-t-2 ${stage.colorClass} rounded-xl transition-colors ${dragOver ? "bg-primary/10 ring-2 ring-primary/30" : "bg-muted/30"}`}
    >
      <div className="p-3 flex items-center justify-between">
        <span className="font-mono text-sm font-semibold text-foreground">{stage.label}</span>
        <Badge variant="outline" className="font-mono text-xs">{leads.length}</Badge>
      </div>
      <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto">
        {leads.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            currentStage={stage.id}
            onMoveStage={onMoveStage}
            onUpdateNote={onUpdateNote}
            onUpdateValue={onUpdateValue}
          />
        ))}
        {leads.length === 0 && (
          <p className="text-center font-mono text-xs text-muted-foreground py-6">Nessun lead</p>
        )}
      </div>
    </div>
  );
}
