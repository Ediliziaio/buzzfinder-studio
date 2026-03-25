import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, Trash2, ShieldCheck, RefreshCw, Info } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  totalContacts: number;
}

export function EmailValidationPanel({ open, onClose, onComplete, totalContacts }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [reVerify, setReVerify] = useState(false);
  const [progress, setProgress] = useState({ processed: 0, valid: 0, risky: 0, invalid: 0 });
  const [done, setDone] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [stopRequested, setStopRequested] = useState(false);

  const reset = () => {
    setProgress({ processed: 0, valid: 0, risky: 0, invalid: 0 });
    setDone(false);
    setStopRequested(false);
  };

  const runValidation = async () => {
    setIsRunning(true);
    setStopRequested(false);
    reset();
    let offset = 0;

    while (true) {
      if (stopRequested) break;
      const { data, error } = await supabase.functions.invoke("validate-emails", {
        body: { batch_size: 100, offset, re_verify: reVerify },
      });

      if (error || !data) {
        toast.error("Errore durante la verifica: " + (error?.message ?? "unknown"));
        break;
      }

      setProgress((prev) => ({
        processed: prev.processed + (data.processed ?? 0),
        valid: prev.valid + (data.valid ?? 0),
        risky: prev.risky + (data.risky ?? 0),
        invalid: prev.invalid + (data.invalid ?? 0),
      }));

      if (data.done) {
        setDone(true);
        break;
      }
      offset = data.next_offset;
      await new Promise((r) => setTimeout(r, 200));
    }

    setIsRunning(false);
    if (!stopRequested) {
      toast.success("Verifica completata");
      onComplete();
    }
  };

  const handleStop = () => {
    setStopRequested(true);
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

  const handleClose = () => {
    if (isRunning) handleStop();
    onClose();
  };

  const pct = totalContacts > 0 ? Math.round((progress.processed / totalContacts) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verifica Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info */}
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
            <p className="font-mono text-xs text-muted-foreground">
              🔍 Verifica sintassi, pattern e record MX per identificare email invalide o rischiose.
            </p>
            <p className="font-mono text-xs text-muted-foreground">
              ⚡ ~500 email/secondo • Nessun costo aggiuntivo
            </p>
          </div>

          {/* Re-verify toggle */}
          {!isRunning && !done && (
            <label className="flex items-center gap-2 cursor-pointer group">
              <div
                className={`relative w-8 h-4 rounded-full transition-colors ${reVerify ? "bg-primary" : "bg-muted"}`}
                onClick={() => setReVerify((v) => !v)}
              >
                <div
                  className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${reVerify ? "translate-x-4" : "translate-x-0.5"}`}
                />
              </div>
              <span className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                Re-verifica anche contatti già verificati
              </span>
              {reVerify && (
                <span className="font-mono text-[10px] rounded px-1 bg-primary/10 text-primary">
                  Tutti i {totalContacts.toLocaleString()} contatti
                </span>
              )}
            </label>
          )}

          {/* Progress */}
          {(isRunning || done) && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-border bg-card p-2">
                  <div className="font-mono text-lg font-bold text-primary">{progress.valid}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Valide ✓</div>
                </div>
                <div className="rounded-md border border-border bg-card p-2">
                  <div className="font-mono text-lg font-bold text-yellow-500">{progress.risky}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Rischiose ⚠</div>
                </div>
                <div className="rounded-md border border-border bg-card p-2">
                  <div className="font-mono text-lg font-bold text-destructive">{progress.invalid}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">Invalide ✗</div>
                </div>
              </div>
              <Progress value={pct} className="h-2" />
              <p className="font-mono text-[10px] text-muted-foreground text-center">
                {progress.processed.toLocaleString()} contatti elaborati
                {isRunning && <span className="ml-1 animate-pulse">...</span>}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {isRunning ? (
              <Button variant="outline" className="flex-1 font-mono text-xs" onClick={handleStop}>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Verifica in corso... (Stop)
              </Button>
            ) : (
              <Button className="flex-1 font-mono text-xs" onClick={runValidation}>
                {done ? (
                  <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Ri-avvia verifica</>
                ) : (
                  <><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Avvia verifica</>
                )}
              </Button>
            )}
            {done && progress.invalid > 0 && (
              <Button variant="destructive" className="font-mono text-xs" onClick={removeInvalid} disabled={removing}>
                {removing ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                Rimuovi invalide ({progress.invalid})
              </Button>
            )}
          </div>

          {/* Summary */}
          {done && (
            <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-3">
              <CheckCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-mono text-xs font-medium text-foreground">
                  Verifica completata! {progress.processed} contatti processati.
                </p>
                {progress.invalid > 0 && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    ✗ {progress.invalid} email invalide — rimuoverle ridurrà il bounce rate del ~{totalContacts > 0 ? Math.round((progress.invalid / totalContacts) * 100) : 0}%.
                  </p>
                )}
                {progress.risky > 0 && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    ⚠ {progress.risky} email rischiose (info@, sales@, ecc.) — attenzione all'invio.
                  </p>
                )}
                {progress.invalid === 0 && progress.risky === 0 && (
                  <p className="font-mono text-[10px] text-muted-foreground">
                    🎉 Tutte le email sono valide!
                  </p>
                )}
                <div className="flex items-center gap-1 pt-1">
                  <Info className="h-3 w-3 text-muted-foreground shrink-0" />
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Usa il filtro "Qualità email" nella pagina Contatti per segmentare.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
