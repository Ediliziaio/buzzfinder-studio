import { useState, useMemo } from "react";
import { Trophy, Filter, X, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KanbanColumn, type PipelineStage } from "@/components/pipeline/KanbanColumn";
import { usePipeline } from "@/hooks/usePipeline";
import { useCampaigns } from "@/hooks/useCampaigns";
import { CreateLeadDialog } from "@/components/pipeline/CreateLeadDialog";

const STAGES: PipelineStage[] = [
  { id: "interessato", label: "Interessati 🔥", colorClass: "border-destructive" },
  { id: "richiesta_info", label: "Richiedono info 📋", colorClass: "border-info" },
  { id: "meeting_fissato", label: "Meeting 📅", colorClass: "border-[hsl(262,80%,70%)]" },
  { id: "proposta_inviata", label: "Proposta inviata 📄", colorClass: "border-warning" },
  { id: "vinto", label: "Vinti ✅", colorClass: "border-success" },
  { id: "perso", label: "Persi ❌", colorClass: "border-muted-foreground" },
];

export default function PipelinePage() {
  const { leads, isLoading, moveStage, updateNote, updateValue, addLead, deleteLead } = usePipeline();
  const { campaigns } = useCampaigns();

  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [filterCampaign, setFilterCampaign] = useState<string>("all");
  const [filterMinValue, setFilterMinValue] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");

  const hasActiveFilters = filterCampaign !== "all" || filterMinValue !== "" || filterDateFrom !== "";

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (filterCampaign !== "all") {
        if (filterCampaign === "none") {
          if (l.campaign_id) return false;
        } else {
          if (l.campaign_id !== filterCampaign) return false;
        }
      }
      if (filterMinValue && l.valore_stimato < parseFloat(filterMinValue)) return false;
      if (filterDateFrom && new Date(l.created_at) < new Date(filterDateFrom)) return false;
      return true;
    });
  }, [leads, filterCampaign, filterMinValue, filterDateFrom]);

  const totaleValore = filteredLeads
    .filter((l) => l.pipeline_stage !== "perso")
    .reduce((s, l) => s + (l.valore_stimato || 0), 0);

  const clearFilters = () => {
    setFilterCampaign("all");
    setFilterMinValue("");
    setFilterDateFrom("");
  };

  // Funnel conversion: % of first stage (interessato) count
  const firstStageCount = filteredLeads.filter(l => l.pipeline_stage === "interessato").length;
  const totalActive = filteredLeads.filter(l => l.pipeline_stage !== "perso").length;

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">PIPELINE</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button size="sm" className="font-mono text-xs" onClick={() => setShowCreate(true)}>
            <Plus className="h-3 w-3 mr-1" /> Nuovo Lead
          </Button>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="font-mono text-xs"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3 w-3 mr-1" />
            Filtri
            {hasActiveFilters && (
              <span className="ml-1 bg-primary-foreground text-primary rounded-full px-1.5 text-[10px]">ON</span>
            )}
          </Button>
          <div className="flex gap-2 font-mono text-sm">
            <span className="text-muted-foreground">Valore:</span>
            <span className="font-bold text-success">€{totaleValore.toLocaleString()}</span>
            <span className="text-muted-foreground ml-2">Lead:</span>
            <span className="font-bold text-foreground">{filteredLeads.length}</span>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-border bg-card">
          <div className="space-y-1">
            <label className="font-mono text-[10px] text-muted-foreground uppercase">Campagna</label>
            <Select value={filterCampaign} onValueChange={setFilterCampaign}>
              <SelectTrigger className="w-48 h-8 text-xs font-mono">
                <SelectValue placeholder="Tutte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le campagne</SelectItem>
                <SelectItem value="none">Senza campagna</SelectItem>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] text-muted-foreground uppercase">Valore minimo €</label>
            <Input
              type="number"
              placeholder="0"
              value={filterMinValue}
              onChange={(e) => setFilterMinValue(e.target.value)}
              className="w-28 h-8 text-xs font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="font-mono text-[10px] text-muted-foreground uppercase">Creati dal</label>
            <Input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-40 h-8 text-xs font-mono"
            />
          </div>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs font-mono h-8">
              <X className="h-3 w-3 mr-1" /> Reset
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => {
          const stageLeads = filteredLeads.filter((l) => l.pipeline_stage === stage.id);
          const stageValue = stageLeads.reduce((s, l) => s + (l.valore_stimato || 0), 0);
          // Funnel: % relative to total active leads (excluding perso)
          const conversionRate = totalActive > 0 && stage.id !== "perso"
            ? Math.round((stageLeads.length / totalActive) * 100)
            : undefined;

          return (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              leads={stageLeads}
              totalValue={stageValue}
              conversionRate={conversionRate}
              onMoveStage={moveStage}
              onUpdateNote={updateNote}
              onUpdateValue={updateValue}
              onDelete={deleteLead}
            />
          );
        })}
      </div>
      <CreateLeadDialog open={showCreate} onOpenChange={setShowCreate} onAdd={addLead} />
    </div>
  );
}
