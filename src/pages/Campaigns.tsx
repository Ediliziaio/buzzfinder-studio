import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/KpiCard";
import { CampaignsList } from "@/components/campaigns/CampaignsList";
import { CampaignWizard } from "@/components/campaigns/CampaignWizard";
import { useCampaigns } from "@/hooks/useCampaigns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Campaign } from "@/types";

export default function CampaignsPage() {
  const { campaigns, isLoading, refetch } = useCampaigns();
  const [wizardOpen, setWizardOpen] = useState(false);
  const navigate = useNavigate();

  const totInviati = campaigns.reduce((a, c) => a + c.inviati, 0);
  const totAperti = campaigns.reduce((a, c) => a + c.aperti, 0);
  const totCliccati = campaigns.reduce((a, c) => a + c.cliccati, 0);
  const avgOpenRate = totInviati > 0 ? ((totAperti / totInviati) * 100).toFixed(1) : "0";
  const avgClickRate = totInviati > 0 ? ((totCliccati / totInviati) * 100).toFixed(1) : "0";
  const totCosto = campaigns.reduce((a, c) => a + Number(c.costo_reale_eur || 0), 0);

  const handleDuplicate = async (campaign: Campaign) => {
    try {
      const { error } = await supabase.from("campaigns").insert({
        nome: `${campaign.nome} (copia)`,
        tipo: campaign.tipo,
        stato: "bozza",
        subject: campaign.subject,
        body_html: campaign.body_html,
        body_text: campaign.body_text,
        template_whatsapp_id: campaign.template_whatsapp_id,
        sender_email: campaign.sender_email,
        sender_name: campaign.sender_name,
        reply_to: campaign.reply_to,
        sending_rate_per_hour: campaign.sending_rate_per_hour,
      });
      if (error) throw error;
      toast({ title: "Campagna duplicata" });
      refetch();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (campaign: Campaign) => {
    try {
      const { error } = await supabase.from("campaigns").delete().eq("id", campaign.id);
      if (error) throw error;
      toast({ title: "Campagna eliminata" });
      refetch();
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Send className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">CAMPAGNE</h1>
          <span className="font-mono text-xs text-muted-foreground">
            {campaigns.length} totali
          </span>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="font-mono text-xs">
          <Plus className="mr-1 h-4 w-4" /> Nuova campagna
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard label="Campagne" value={campaigns.length} />
        <KpiCard label="Inviati" value={totInviati.toLocaleString()} />
        <KpiCard label="Open rate" value={`${avgOpenRate}%`} />
        <KpiCard label="Click rate" value={`${avgClickRate}%`} />
        <KpiCard label="Costo totale" value={`€${totCosto.toFixed(2)}`} />
      </div>

      {/* List */}
      <CampaignsList
        campaigns={campaigns}
        isLoading={isLoading}
        onEdit={() => {}}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
      />

      {/* Wizard */}
      <CampaignWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={refetch}
      />
    </div>
  );
}
