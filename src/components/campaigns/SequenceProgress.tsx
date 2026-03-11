import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Props {
  campaignId: string;
}

export function SequenceProgress({ campaignId }: Props) {
  const { data: steps } = useQuery({
    queryKey: ["campaign-steps", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_steps" as any)
        .select("*, campaign_step_executions(stato)")
        .eq("campaign_id", campaignId)
        .is("ab_padre_id", null)
        .order("step_number");
      return data || [];
    },
    refetchInterval: 10_000,
  });

  if (!steps || steps.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground text-center py-4">
        Nessuno step configurato
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {steps.map((step: any) => {
        const execs = step.campaign_step_executions || [];
        const total = execs.length;
        const inviati = execs.filter((e: any) => e.stato === "sent").length;
        const saltati = execs.filter((e: any) => e.stato === "skipped").length;
        const inAttesa = execs.filter((e: any) => e.stato === "scheduled").length;

        return (
          <div key={step.id} className="border border-border rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-mono text-sm font-semibold">
                Step {step.step_number}
                {step.soggetto && (
                  <span className="text-muted-foreground font-normal ml-2">— {step.soggetto.substring(0, 30)}</span>
                )}
              </span>
              <div className="flex gap-2 text-xs">
                <Badge variant="default">{inviati} inviati</Badge>
                <Badge variant="outline">{inAttesa} in attesa</Badge>
                <Badge variant="secondary">{saltati} saltati</Badge>
              </div>
            </div>
            <Progress value={total > 0 ? (inviati / total) * 100 : 0} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>
                Open: {step.stat_aperti || 0}/{step.stat_inviati || 0} (
                {step.stat_inviati > 0
                  ? Math.round(((step.stat_aperti || 0) / step.stat_inviati) * 100)
                  : 0}
                %)
              </span>
              <span>
                Reply: {step.stat_risposte || 0}/{step.stat_inviati || 0} (
                {step.stat_inviati > 0
                  ? Math.round(((step.stat_risposte || 0) / step.stat_inviati) * 100)
                  : 0}
                %)
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
