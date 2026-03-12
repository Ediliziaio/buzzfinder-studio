import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Plus, Rocket, Loader2, X, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/shared/KpiCard";
import { CampaignsList } from "@/components/campaigns/CampaignsList";
import { CampaignWizard } from "@/components/campaigns/CampaignWizard";
import { ActiveCampaignCard } from "@/components/campaigns/ActiveCampaignCard";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useActiveCampaigns } from "@/hooks/useActiveCampaigns";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { toast } from "sonner";
import type { Campaign } from "@/types";

export default function CampaignsPage() {
  const { campaigns, isLoading, refetch } = useCampaigns();
  const { activeCampaigns } = useActiveCampaigns();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedCampaignIds, setSelectedCampaignIds] = useState<Set<string>>(new Set());
  const [bulkLaunching, setBulkLaunching] = useState(false);
  const navigate = useNavigate();

  const totInviati = campaigns.reduce((a, c) => a + c.inviati, 0);
  const totAperti = campaigns.reduce((a, c) => a + c.aperti, 0);
  const totCliccati = campaigns.reduce((a, c) => a + c.cliccati, 0);
  const avgOpenRate = totInviati > 0 ? ((totAperti / totInviati) * 100).toFixed(1) : "0";
  const avgClickRate = totInviati > 0 ? ((totCliccati / totInviati) * 100).toFixed(1) : "0";
  const totCosto = campaigns.reduce((a, c) => a + Number(c.costo_reale_eur || 0), 0);
  const schedCount = campaigns.filter(c => c.stato === "schedulata").length;

  const handleDuplicate = async (campaign: Campaign) => {
    try {
      const user_id = await getCurrentUserId();
      const { error } = await supabase.from("campaigns").insert({
        user_id,
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
        totale_destinatari: campaign.totale_destinatari,
        costo_stimato_eur: campaign.costo_stimato_eur,
      } as any);
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

  const handleBulkLaunch = async () => {
    setBulkLaunching(true);
    let launched = 0;
    for (const id of selectedCampaignIds) {
      try {
        await supabase.from("campaigns")
          .update({ stato: "in_corso", started_at: new Date().toISOString() } as any)
          .eq("id", id);
        launched++;
      } catch (err) {
        console.error(`Errore lancio campagna ${id}:`, err);
      }
    }
    toast({ title: `${launched} campagna${launched > 1 ? "e" : ""} avviat${launched > 1 ? "e" : "a"}` });
    setSelectedCampaignIds(new Set());
    refetch();
    setBulkLaunching(false);
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
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Campagne" value={campaigns.length} />
        <KpiCard label="Inviati" value={totInviati.toLocaleString()} />
        <KpiCard label="Open rate" value={`${avgOpenRate}%`} />
        <KpiCard label="Click rate" value={`${avgClickRate}%`} />
        <KpiCard label="Costo totale" value={`€${totCosto.toFixed(2)}`} />
        {schedCount > 0 && <KpiCard label="Schedulate" value={schedCount} />}
      </div>

      {/* Active Campaigns Live Dashboard */}
      {activeCampaigns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            <span className="terminal-header text-primary">
              {activeCampaigns.length} campagna{activeCampaigns.length !== 1 ? "e" : ""} attiva{activeCampaigns.length !== 1 ? "e" : ""}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeCampaigns.map(c => (
              <ActiveCampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedCampaignIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="font-mono text-xs text-foreground">
            {selectedCampaignIds.size} campagna{selectedCampaignIds.size !== 1 ? "e" : ""} selezionata{selectedCampaignIds.size !== 1 ? "e" : ""}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleBulkLaunch} disabled={bulkLaunching} className="font-mono text-xs">
              {bulkLaunching
                ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Avvio...</>
                : <><Rocket className="h-3 w-3 mr-1" /> Lancia {selectedCampaignIds.size} campagne</>}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedCampaignIds(new Set())} className="font-mono text-xs">
              <X className="h-3 w-3 mr-1" /> Deseleziona
            </Button>
          </div>
        </div>
      )}

      {/* List */}
      <CampaignsList
        campaigns={campaigns}
        isLoading={isLoading}
        onEdit={(c) => navigate(`/campaigns/${c.id}`)}
        onDuplicate={handleDuplicate}
        onDelete={handleDelete}
        selectedIds={selectedCampaignIds}
        onSelectionChange={setSelectedCampaignIds}
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
