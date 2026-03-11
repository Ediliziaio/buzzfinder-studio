import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Trophy } from "lucide-react";

interface Props {
  campaignId: string;
}

export function ABTestResults({ campaignId }: Props) {
  const { data: steps } = useQuery({
    queryKey: ["ab-steps", campaignId],
    queryFn: async () => {
      const { data } = await supabase
        .from("campaign_steps")
        .select("id, step_number, soggetto, ab_nome, ab_peso, stat_inviati, stat_aperti, stat_cliccati, stat_risposte")
        .eq("campaign_id", campaignId)
        .not("ab_nome", "is", null)
        .order("step_number")
        .order("ab_nome");
      return data || [];
    },
  });

  if (!steps?.length) return null;

  // Group by step_number
  const grouped: Record<number, typeof steps> = {};
  steps.forEach((s) => {
    const n = s.step_number;
    if (!grouped[n]) grouped[n] = [];
    grouped[n].push(s);
  });

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([stepNum, variants]) => (
        <div key={stepNum} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical className="h-4 w-4 text-primary" />
            <span className="terminal-header text-primary">A/B Test — Step {stepNum}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {variants.map((v) => {
              const openRate = v.stat_inviati > 0 ? (v.stat_aperti / v.stat_inviati) * 100 : 0;
              const replyRate = v.stat_inviati > 0 ? (v.stat_risposte / v.stat_inviati) * 100 : 0;
              const isWinner = v.stat_inviati > 10 && variants.every(
                (other) => other.id === v.id || (other.stat_aperti || 0) <= (v.stat_aperti || 0)
              );

              return (
                <div key={v.id} className={`rounded-lg border p-3 space-y-2 ${isWinner ? "border-success bg-success/5" : "border-border"}`}>
                  <div className="flex items-center gap-2">
                    <Badge variant={v.ab_nome === "A" ? "default" : "outline"} className="font-mono">
                      Variante {v.ab_nome}
                    </Badge>
                    {isWinner && (
                      <Badge className="bg-success text-success-foreground font-mono text-[10px]">
                        <Trophy className="h-3 w-3 mr-1" /> Winner
                      </Badge>
                    )}
                  </div>
                  <p className="font-mono text-xs text-muted-foreground italic line-clamp-1">
                    &ldquo;{v.soggetto?.substring(0, 50)}...&rdquo;
                  </p>
                  <div className="space-y-1">
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-muted-foreground">Inviati:</span>
                      <span className="text-foreground">{v.stat_inviati}</span>
                    </div>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-muted-foreground">Open rate:</span>
                      <span className={openRate > 30 ? "text-success" : "text-foreground"}>{openRate.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between font-mono text-xs">
                      <span className="text-muted-foreground">Reply rate:</span>
                      <span className={replyRate > 5 ? "text-success" : "text-foreground"}>{replyRate.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
