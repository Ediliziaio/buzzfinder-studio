import { useState } from "react";
import { Plus, Shield, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSenderPool } from "@/hooks/useSenderPool";
import { SenderCard } from "@/components/senders/SenderCard";
import { SenderDialog } from "@/components/senders/SenderDialog";
import { SenderHealthDashboard } from "@/components/senders/SenderHealthDashboard";
import type { SenderPool } from "@/types";

export default function SendersPage() {
  const [senderTipoFilter, setSenderTipoFilter] = useState<"email" | "whatsapp" | "sms" | undefined>(undefined);
  const { senders: poolSenders, loading: poolLoading, fetchSenders: refetchPool, toggleActive: togglePoolActive, deleteSender: deletePoolSender } = useSenderPool(senderTipoFilter);
  const [editingSender, setEditingSender] = useState<SenderPool | null>(null);
  const [senderDialogOpen, setSenderDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="font-display text-xl font-bold text-foreground">POOL MITTENTI</h1>
          </div>
          <p className="font-mono text-xs text-muted-foreground mt-1">Gestisci i tuoi domini email e numeri WhatsApp/SMS</p>
        </div>
        <Button size="sm" className="font-mono text-xs" onClick={() => { setEditingSender(null); setSenderDialogOpen(true); }}>
          <Plus className="h-3 w-3 mr-1" /> Aggiungi Mittente
        </Button>
      </div>

      <SenderHealthDashboard senders={poolSenders} />

      {/* Alerts */}
      {poolSenders.filter(s => s.bounce_rate > 0.05).map(s => (
        <Alert key={`bounce-${s.id}`} variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-mono text-xs">Bounce rate alto — {s.nome}</AlertTitle>
          <AlertDescription className="font-mono text-[10px]">
            Bounce rate: {(s.bounce_rate * 100).toFixed(1)}%. Soglia critica superata (&gt;5%).
          </AlertDescription>
        </Alert>
      ))}
      {poolSenders.filter(s => s.spam_rate > 0.003).map(s => (
        <Alert key={`spam-${s.id}`} variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-mono text-xs">Spam rate alto — {s.nome}</AlertTitle>
          <AlertDescription className="font-mono text-[10px]">
            Spam rate: {(s.spam_rate * 100).toFixed(2)}%. Soglia Google/Yahoo superata (&gt;0.3%).
          </AlertDescription>
        </Alert>
      ))}
      {poolSenders.filter(s => s.tipo === 'email' && s.attivo && (!s.spf_ok || !s.dkim_ok)).map(s => (
        <Alert key={`dns-${s.id}`}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="font-mono text-xs">DNS non verificati — {s.nome}</AlertTitle>
          <AlertDescription className="font-mono text-[10px]">
            {!s.spf_ok && 'SPF mancante. '}{!s.dkim_ok && 'DKIM mancante. '}
            Configura i record DNS per migliorare la deliverability.
          </AlertDescription>
        </Alert>
      ))}

      {/* Sub-tabs filter */}
      <div className="flex gap-2">
        {[
          { label: "Tutti", value: undefined },
          { label: "Email", value: "email" as const },
          { label: "WhatsApp", value: "whatsapp" as const },
          { label: "SMS", value: "sms" as const },
        ].map(f => (
          <Button
            key={f.label}
            variant={senderTipoFilter === f.value ? "default" : "outline"}
            size="sm"
            className="font-mono text-[10px]"
            onClick={() => setSenderTipoFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Cards grid */}
      {poolLoading ? (
        <p className="font-mono text-xs text-muted-foreground">Caricamento...</p>
      ) : poolSenders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-mono text-xs text-muted-foreground">Nessun mittente configurato</p>
          <Button variant="outline" size="sm" className="mt-3 font-mono text-xs" onClick={() => { setEditingSender(null); setSenderDialogOpen(true); }}>
            <Plus className="h-3 w-3 mr-1" /> Aggiungi il primo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {poolSenders.map(s => (
            <SenderCard
              key={s.id}
              sender={s}
              onEdit={(sender) => { setEditingSender(sender); setSenderDialogOpen(true); }}
              onToggleActive={togglePoolActive}
              onDelete={deletePoolSender}
            />
          ))}
        </div>
      )}

      <SenderDialog
        open={senderDialogOpen}
        onOpenChange={setSenderDialogOpen}
        sender={editingSender}
        onSaved={refetchPool}
      />
    </div>
  );
}
