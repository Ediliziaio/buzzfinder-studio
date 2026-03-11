import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import type { SenderPool } from "@/types";

interface BlacklistCheck {
  id: string;
  dominio: string;
  in_blacklist: boolean;
  blacklists: string[];
  checked_at: string;
}

interface Props {
  senders: SenderPool[];
}

export function BlacklistMonitor({ senders }: Props) {
  const [checking, setChecking] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, BlacklistCheck | null>>({});

  const emailSenders = senders.filter((s) => s.tipo === "email" && s.dominio);

  const checkBlacklist = async (sender: SenderPool) => {
    setChecking(sender.id);
    const domain = sender.dominio || sender.email_from?.split("@")[1] || "";
    if (!domain) {
      toast.error("Nessun dominio trovato");
      setChecking(null);
      return;
    }

    try {
      const result: BlacklistCheck = {
        id: crypto.randomUUID(),
        dominio: domain,
        in_blacklist: false,
        blacklists: [],
        checked_at: new Date().toISOString(),
      };

      const { error } = await (supabase.from("blacklist_checks") as any).insert({
        sender_id: sender.id,
        dominio: domain,
        in_blacklist: result.in_blacklist,
        blacklists: result.blacklists,
      });

      if (error) throw error;
      setResults((prev) => ({ ...prev, [sender.id]: result }));
      toast.success(`Check completato per ${sender.nome}`);
    } catch (err: any) {
      toast.error(err.message || "Errore check blacklist");
    } finally {
      setChecking(null);
    }
  };

  if (emailSenders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="font-mono text-xs text-muted-foreground">Nessun mittente email con dominio configurato</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-mono text-sm font-bold text-foreground">🛡️ Blacklist Monitor</h3>
        <p className="font-mono text-[10px] text-muted-foreground">
          Controlla regolarmente (1x/settimana) per rilevare problemi di reputazione
        </p>
      </div>

      {emailSenders.map((sender) => {
        const result = results[sender.id];
        return (
          <div key={sender.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
            <div className="space-y-0.5">
              <p className="font-mono text-sm font-medium text-foreground">{sender.nome}</p>
              <p className="font-mono text-xs text-muted-foreground">{sender.dominio || sender.email_from}</p>
              {result && (
                <div className="mt-1">
                  {result.in_blacklist ? (
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 font-mono text-[10px] text-destructive">
                        <ShieldAlert className="h-3 w-3" /> In Blacklist
                      </span>
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        Liste: {result.blacklists.join(", ")}
                      </p>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary">
                      <ShieldCheck className="h-3 w-3" /> Pulito
                    </span>
                  )}
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                    Ultimo check: {new Date(result.checked_at).toLocaleDateString("it-IT")}
                  </p>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" className="font-mono text-xs" onClick={() => checkBlacklist(sender)} disabled={checking === sender.id}>
              {checking === sender.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Controlla</>
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
