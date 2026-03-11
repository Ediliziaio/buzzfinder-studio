import { Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { KanbanColumn, type PipelineStage } from "@/components/pipeline/KanbanColumn";
import { usePipeline } from "@/hooks/usePipeline";


const STAGES: PipelineStage[] = [
  { id: "interessato", label: "Interessati 🔥", colorClass: "border-destructive" },
  { id: "richiesta_info", label: "Richiedono info 📋", colorClass: "border-info" },
  { id: "meeting_fissato", label: "Meeting 📅", colorClass: "border-[hsl(262,80%,70%)]" },
  { id: "proposta_inviata", label: "Proposta inviata 📄", colorClass: "border-warning" },
  { id: "vinto", label: "Vinti ✅", colorClass: "border-success" },
  { id: "perso", label: "Persi ❌", colorClass: "border-muted-foreground" },
];

export default function PipelinePage() {
  const { leads, isLoading, moveStage, updateNote } = usePipeline();

  const totaleValore = leads
    .filter((l) => l.pipeline_stage !== "perso")
    .reduce((s, l) => s + (l.valore_stimato || 0), 0);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">PIPELINE</h1>
        </div>
        <div className="flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="w-72 h-96 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">PIPELINE</h1>
        </div>
        <div className="flex gap-2 font-mono text-sm">
          <span className="text-muted-foreground">Valore stimato:</span>
          <span className="font-bold text-success">€{totaleValore.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            leads={leads.filter((l) => l.pipeline_stage === stage.id)}
            onMoveStage={moveStage}
            onUpdateNote={updateNote}
          />
        ))}
      </div>
    </div>
  );
}
