import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { toast } from "sonner";
import { useEffect } from "react";
import type { PipelineLeadWithRelations } from "@/components/pipeline/LeadCard";

export function usePipeline() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["pipeline-leads"],
    queryFn: async (): Promise<PipelineLeadWithRelations[]> => {
      const { data, error } = await supabase
        .from("pipeline_leads")
        .select("*, contacts(nome, cognome, azienda, email), campaigns(nome)")
        .order("pipeline_updated", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        id: d.id,
        pipeline_stage: d.pipeline_stage,
        pipeline_note: d.pipeline_note,
        valore_stimato: Number(d.valore_stimato || 0),
        pipeline_updated: d.pipeline_updated,
        created_at: d.created_at,
        contact: d.contacts,
        campaign: d.campaigns,
      }));
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel("pipeline-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "pipeline_leads" }, () => {
        qc.invalidateQueries({ queryKey: ["pipeline-leads"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const moveStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const { error } = await supabase
        .from("pipeline_leads")
        .update({ pipeline_stage: stage, pipeline_updated: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-leads"] });
      toast.success("Stage aggiornato");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from("pipeline_leads")
        .update({ pipeline_note: note } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-leads"] }),
  });

  const updateValue = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: number }) => {
      const { error } = await supabase
        .from("pipeline_leads")
        .update({ valore_stimato: value, pipeline_updated: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-leads"] });
      toast.success("Valore aggiornato");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const addLead = useMutation({
    mutationFn: async (input: { contact_id: string; campaign_id?: string; inbox_message_id?: string; stage?: string }) => {
      const user_id = await getCurrentUserId();
      const { error } = await supabase.from("pipeline_leads").insert({
        user_id,
        contact_id: input.contact_id,
        campaign_id: input.campaign_id || null,
        inbox_message_id: input.inbox_message_id || null,
        pipeline_stage: input.stage || "interessato",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline-leads"] });
      toast.success("Lead aggiunto alla pipeline");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    leads: query.data || [],
    isLoading: query.isLoading,
    moveStage: (id: string, stage: string) => moveStage.mutate({ id, stage }),
    updateNote: (id: string, note: string) => updateNote.mutate({ id, note }),
    updateValue: (id: string, value: number) => updateValue.mutate({ id, value }),
    addLead: addLead.mutate,
  };
}
