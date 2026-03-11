import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Trash2, ShieldCheck } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  totalContacts: number;
}

export function EmailValidationPanel({ open, onClose, onComplete, totalContacts }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, valid: 0, risky: 0, invalid: 0 });
  const [done, setDone] = useState(false);
  const [removing, setRemoving] = useState(false);

  const runValidation = async () => {
    setIsRunning(true);
    setProgress({ processed: 0, valid: 0, risky: 0, invalid: 0 });
    setDone(false);
    let offset = 0;

    while (true) {
      const { data, error } = await supabase.functions.invoke("validate-emails", {
        body: { batch_size: 100, offset },
      });

      if (error || !data) {
        toast.error("Errore durante la verifica");
        break;
      }

      setProgress((prev) => ({
        processed: prev.processed + data.processed,
        valid: prev.valid + data.valid,
        risky: prev.risky + data.risky,
        invalid: prev.invalid + data.invalid,
      }));

      if (data.done) {
        setDone(true);
        break;
      }
      offset = data.next_offset;
      await new Promise((r) => setTimeout(r, 300));
    }

    setIsRunning(false);
    toast.success("Verifica completata");
    onComplete();
  };

  const removeInvalid = async () => {
    setRemoving(true);
    try {
      const { error } = await (supabase
        .from("contacts") as any)
        .update({ email: null, email_valid: false })
        .eq("email_quality", "invalid");
      if (error) throw error;
      toast.success("Email invalide rimosse");
      onComplete();
    } catch {
      toast.error("Errore rimozione email invalide");
    } finally {
      setRemoving(false);
    }
  };

  const pct = totalContacts > 0 ? Math.round((progress.processed / totalContacts) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verifica Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <p className="font-mono text-xs text-muted-foreground">
              🔍 Verifica sintassi e pattern per identificare email invalide o rischiose.
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              ⚡ ~500 email/secondo • Nessun costo
            </p>
          </div>

          {(isRunning || done) && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-border bg-card p-2">
                  <div className="font-mono text-lg font-bold text-primary">{progress.valid}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Valide ✓</div>
                </div>
                <div className="rounded-md border border-border bg-card p-2">
                  <div className="font-mono text-lg font-bold text-accent-foreground">{progress.risky}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Rischiose ⚠️</div>
                </div>
                <div className="rounded-md border border-border bg-card p-2">
                  <div className="font-mono text-lg font-bold text-destructive">{progress.invalid}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Invalide ✗</div>
                </div>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="font-mono text-[10px] text-muted-foreground text-center">
                {progress.processed} / {totalContacts} contatti elaborati
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <Button className="flex-1 font-mono text-xs" onClick={runValidation} disabled={isRunning}>
              {isRunning ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Verifica in corso...</>
              ) : (
                <><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Avvia Verifica</>
              )}
            </Button>
            {done && progress.invalid > 0 && (
              <Button variant="destructive" className="font-mono text-xs" onClick={removeInvalid} disabled={removing}>
                {removing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Rimuovi invalide ({progress.invalid})
              </Button>
            )}
          </div>

          {done && (
            <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-mono text-xs font-medium text-foreground">Verifica completata!</p>
                {progress.invalid > 0 && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Rimuovendo le {progress.invalid} email invalide ridurrai il bounce rate del ~{totalContacts > 0 ? Math.round((progress.invalid / totalContacts) * 100) : 0}%.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
