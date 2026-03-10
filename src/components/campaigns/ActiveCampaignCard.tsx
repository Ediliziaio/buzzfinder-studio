import { useNavigate } from "react-router-dom";
import { Mail, MessageSquare, Phone, Pause, Play } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Campaign } from "@/types";

const tipoIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
};

interface Props {
  campaign: Campaign;
}

export function ActiveCampaignCard({ campaign }: Props) {
  const navigate = useNavigate();
  const Icon = tipoIcons[campaign.tipo] || Mail;
  const progress = campaign.totale_destinatari > 0
    ? Math.round((campaign.inviati / campaign.totale_destinatari) * 100)
    : 0;
  const openRate = campaign.inviati > 0
    ? ((campaign.aperti / campaign.inviati) * 100).toFixed(1)
    : null;

  return (
    <div
      onClick={() => navigate(`/campaigns/${campaign.id}`)}
      className="rounded-lg border border-border bg-card p-4 cursor-pointer hover:border-primary/40 transition-all space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-mono text-sm font-medium truncate">{campaign.nome}</span>
        </div>
        <span className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
          {campaign.stato === "pausa" ? (
            <><Pause className="h-3 w-3" /> PAUSA</>
          ) : (
            <><Play className="h-3 w-3 text-primary" /> IN CORSO</>
          )}
        </span>
      </div>

      <Progress value={progress} className="h-2" />

      <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>{campaign.inviati.toLocaleString()} / {campaign.totale_destinatari.toLocaleString()} inviati</span>
        <div className="flex items-center gap-3">
          {openRate && <span>{openRate}% aperti</span>}
          <span className="font-bold text-foreground">{progress}%</span>
        </div>
      </div>
    </div>
  );
}
