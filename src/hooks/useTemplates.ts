import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { toast } from "sonner";
import type { CampaignTemplate } from "@/types";

export function useTemplates() {
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    const { data, error } = await supabase
      .from("campaign_templates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Errore caricamento template");
      console.error(error);
    }
    setTemplates((data as unknown as CampaignTemplate[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (template: Partial<CampaignTemplate>) => {
    const user_id = await getCurrentUserId();
    const { error } = await supabase.from("campaign_templates").insert({
      user_id,
      nome: template.nome || "Nuovo template",
      tipo: template.tipo || "email",
      subject: template.subject || null,
      body_html: template.body_html || null,
      body_text: template.body_text || null,
      sender_email: template.sender_email || null,
      sender_name: template.sender_name || null,
      reply_to: template.reply_to || null,
    } as any);
    if (error) { toast.error("Errore creazione: " + error.message); return false; }
    toast.success("Template creato");
    fetchTemplates();
    return true;
  };

  const updateTemplate = async (id: string, updates: Partial<CampaignTemplate>) => {
    const { error } = await supabase
      .from("campaign_templates")
      .update(updates as any)
      .eq("id", id);
    if (error) { toast.error("Errore aggiornamento: " + error.message); return false; }
    toast.success("Template aggiornato");
    fetchTemplates();
    return true;
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from("campaign_templates")
      .delete()
      .eq("id", id);
    if (error) { toast.error("Errore eliminazione: " + error.message); return false; }
    toast.success("Template eliminato");
    fetchTemplates();
    return true;
  };

  const duplicateTemplate = async (template: CampaignTemplate) => {
    const user_id = await getCurrentUserId();
    const { error } = await supabase.from("campaign_templates").insert({
      user_id,
      nome: `${template.nome} (copia)`,
      tipo: template.tipo,
      subject: template.subject,
      body_html: template.body_html,
      body_text: template.body_text,
      sender_email: template.sender_email,
      sender_name: template.sender_name,
      reply_to: template.reply_to,
      sending_rate_per_hour: template.sending_rate_per_hour,
      ai_personalization_enabled: template.ai_personalization_enabled,
      ai_model: template.ai_model,
      ai_context: template.ai_context,
      ai_objective: template.ai_objective,
    } as any);
    if (error) { toast.error("Errore duplicazione: " + error.message); return false; }
    toast.success("Template duplicato");
    fetchTemplates();
    return true;
  };

  return { templates, loading, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate, refetch: fetchTemplates };
}
