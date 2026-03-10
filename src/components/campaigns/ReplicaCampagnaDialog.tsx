import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { toast } from "sonner";
import { useLists } from "@/hooks/useLists";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Database, Users } from "lucide-react";
import { applyChannelFilter } from "@/lib/campaignHelpers";
import type { Campaign } from "@/types";

interface Props {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplicated: () => void;
}

const SPECIAL_TARGETS = [
  { id: "__all_with_email__", nome: "Tutti i contatti con email", forCanale: ["email"] },
  { id: "__all_with_phone__", nome: "Tutti i contatti con telefono", forCanale: ["sms", "whatsapp"] },
  { id: "__not_yet_contacted__", nome: "Non ancora contattati (nuovo / da_contattare)", forCanale: ["email", "sms", "whatsapp"] },
];

export function ReplicaCampagnaDialog({ campaign, open, onOpenChange, onReplicated }: Props) {
  const { lists } = useLists();
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const specialTargets = SPECIAL_TARGETS.filter(t => t.forCanale.includes(campaign.tipo));

  const toggleTarget = (id: string) => {
    setSelectedTargets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleReplicate = async () => {
    if (selectedTargets.length === 0) { toast.error("Seleziona almeno una lista"); return; }
    setIsCreating(true);
    let created = 0;

    try {
      const user_id = await getCurrentUserId();

      for (const targetId of selectedTargets) {
        let nomeSuffix = "";
        let recipientSource: "all" | "list" | "filter" = "all";
        let selectedListId: string | null = null;
        let filterStato: string[] = [];

        if (targetId === "__all_with_email__" || targetId === "__all_with_phone__") {
          nomeSuffix = targetId === "__all_with_email__" ? "— Tutti con email" : "— Tutti con telefono";
        } else if (targetId === "__not_yet_contacted__") {
          nomeSuffix = "— Non contattati";
          recipientSource = "filter";
          filterStato = ["nuovo", "da_contattare"];
        } else {
          const lista = lists.find(l => l.id === targetId);
          nomeSuffix = lista ? `— ${lista.nome}` : "";
          recipientSource = "list";
          selectedListId = targetId;
        }

        // Count recipients
        let recipientCount = 0;
        const channelField = campaign.tipo === "email" ? "email" : "telefono";

        if (recipientSource === "all") {
          const { count } = await supabase.from("contacts").select("id", { count: "exact", head: true }).not(channelField, "is", null);
          recipientCount = count || 0;
        } else if (recipientSource === "filter") {
          const { count } = await supabase.from("contacts").select("id", { count: "exact", head: true }).not(channelField, "is", null).in("stato", filterStato);
          recipientCount = count || 0;
        } else if (selectedListId) {
          const lista = lists.find(l => l.id === selectedListId);
          recipientCount = lista?.totale_contatti || 0;
        }

        // Create campaign copy
        const { data: newCampaign, error } = await supabase
          .from("campaigns")
          .insert({
            user_id,
            nome: `${campaign.nome} ${nomeSuffix}`.trim(),
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
            totale_destinatari: recipientCount,
            costo_stimato_eur: 0,
            ai_personalization_enabled: campaign.ai_personalization_enabled,
            ai_model: campaign.ai_model,
            ai_context: campaign.ai_context,
            ai_objective: campaign.ai_objective,
          } as any)
          .select("id")
          .single();

        if (error) throw error;

        // Populate recipients
        await populateRecipientsForReplica(newCampaign!.id, campaign.tipo, recipientSource, selectedListId, filterStato);
        created++;
      }

      toast.success(`${created} campagna${created > 1 ? "e" : ""} creata${created > 1 ? "e" : ""}!`);
      onReplicated();
      onOpenChange(false);
      setSelectedTargets([]);
    } catch (err: unknown) {
      toast.error(`Errore: ${err instanceof Error ? err.message : "Errore sconosciuto"}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">REPLICA — {campaign.nome}</DialogTitle>
        </DialogHeader>

        <p className="font-mono text-xs text-muted-foreground">
          Verrà creata una copia per ogni segmento selezionato, pronta come bozza.
        </p>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {specialTargets.length > 0 && (
            <div className="space-y-2">
              <span className="terminal-header text-[10px]">SEGMENTI RAPIDI</span>
              {specialTargets.map(t => (
                <label key={t.id} className="flex items-center gap-2 cursor-pointer py-1">
                  <Checkbox checked={selectedTargets.includes(t.id)} onCheckedChange={() => toggleTarget(t.id)} />
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">{t.nome}</span>
                </label>
              ))}
            </div>
          )}

          {lists.length > 0 && (
            <div className="space-y-2">
              <span className="terminal-header text-[10px]">LISTE SALVATE</span>
              {lists.map(lista => (
                <label key={lista.id} className="flex items-center gap-2 cursor-pointer py-1">
                  <Checkbox checked={selectedTargets.includes(lista.id)} onCheckedChange={() => toggleTarget(lista.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs font-medium truncate">{lista.nome}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {lista.tipo} · {lista.totale_contatti} contatti
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{lista.tipo}</Badge>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="font-mono text-xs">Annulla</Button>
          <Button size="sm" onClick={handleReplicate} disabled={isCreating || selectedTargets.length === 0} className="font-mono text-xs">
            {isCreating ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Creazione...</> : <><Copy className="h-3 w-3 mr-1" /> Crea {selectedTargets.length || ""} campagna{selectedTargets.length !== 1 ? "e" : ""}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function populateRecipientsForReplica(
  campaignId: string,
  tipo: string,
  recipientSource: "all" | "list" | "filter",
  selectedListId: string | null,
  filterStato: string[]
) {
  let contactIds: string[] = [];
  const channelField = tipo === "email" ? "email" : "telefono";

  if (recipientSource === "list" && selectedListId) {
    const { data: lc } = await supabase.from("list_contacts").select("contact_id").eq("list_id", selectedListId);
    const ids = (lc || []).map((r: any) => r.contact_id as string);
    if (ids.length > 0) {
      const { data: contacts } = await supabase.from("contacts").select("id").in("id", ids).not(channelField, "is", null);
      contactIds = (contacts || []).map((c: any) => c.id);
    }
  } else if (recipientSource === "filter") {
    let q = supabase.from("contacts").select("id").not(channelField, "is", null);
    if (filterStato.length > 0) q = q.in("stato", filterStato);
    const { data: contacts } = await q;
    contactIds = (contacts || []).map((c: any) => c.id);
  } else {
    const { data: contacts } = await supabase.from("contacts").select("id").not(channelField, "is", null);
    contactIds = (contacts || []).map((c: any) => c.id);
  }

  const CHUNK = 500;
  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const chunk = contactIds.slice(i, i + CHUNK);
    await supabase.from("campaign_recipients").insert(
      chunk.map(contactId => ({ campaign_id: campaignId, contact_id: contactId, stato: "pending" }))
    );
  }
}
