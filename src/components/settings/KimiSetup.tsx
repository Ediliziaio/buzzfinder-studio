import { useState } from "react";
import { Info, Loader2, Sparkles, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SettingField } from "./SettingField";

export function KimiSetup() {
  return (
    <div className="space-y-4">
      <Alert className="border-purple-200 bg-purple-50 dark:border-purple-900 dark:bg-purple-950/30">
        <Info className="h-4 w-4 text-purple-600" />
        <AlertTitle className="text-purple-800 dark:text-purple-300">Quando usare Kimi 2.5</AlertTitle>
        <AlertDescription className="text-purple-700 dark:text-purple-400 text-xs">
          Kimi 2.5 ha un contesto di 1 milione di token. Ideale per analizzare
          in un'unica chiamata centinaia di risposte email e trovare pattern,
          oppure per personalizzare messaggi in lingue asiatiche.
        </AlertDescription>
      </Alert>

      <SettingField
        chiave="kimi_api_key"
        label="Kimi (Moonshot AI) API Key"
        placeholder="sk-..."
        isSecret
        categoria="api_keys"
        description="Ottieni su platform.moonshot.cn — gratuiti i primi $5 di credito"
      />

      <KimiConnectionTest />

      <div className="rounded-lg bg-muted p-4 space-y-2 text-xs">
        <h4 className="font-mono font-medium text-foreground">Come viene usato Kimi in BuzzFinder:</h4>
        <ul className="space-y-1 text-muted-foreground">
          <li>• <strong>Personalizzazione messaggi:</strong> sostituisce Lovable AI se selezionato come modello attivo</li>
          <li>• <strong>Categorizzazione risposte:</strong> classifica le email in arrivo (interessato, obiezione, ecc.)</li>
          <li>• <strong>Analisi batch (128K):</strong> puoi inviare centinaia di risposte in una sola chiamata API</li>
        </ul>
      </div>

      <div className="rounded-lg border border-dashed border-border p-4 space-y-2">
        <h4 className="font-mono text-xs font-medium text-foreground">Analisi Batch con Kimi</h4>
        <p className="text-[10px] text-muted-foreground">
          Invia tutte le risposte degli ultimi 90 giorni a Kimi in una sola chiamata.
          Ottieni: pattern comuni, obiezioni frequenti, suggerimenti per migliorare i messaggi.
        </p>
        <KimiBatchAnalysis />
      </div>
    </div>
  );
}

function KimiConnectionTest() {
  const [status, setStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  const test = async () => {
    setStatus("testing");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Effettua il login"); setStatus("fail"); return; }

      const { data } = await supabase
        .from("app_settings")
        .select("valore")
        .eq("chiave", "kimi_api_key")
        .maybeSingle();

      if (!data?.valore) {
        toast.error("Configura prima la Kimi API Key");
        setStatus("fail");
        return;
      }

      // Quick models list call to verify key
      const res = await fetch("https://api.moonshot.cn/v1/models", {
        headers: { Authorization: `Bearer ${data.valore}` },
      });

      if (res.ok) {
        setStatus("ok");
        toast.success("Kimi API connessa!");
      } else {
        setStatus("fail");
        toast.error("Kimi API Key non valida");
      }
    } catch {
      setStatus("fail");
      toast.error("Errore di connessione a Kimi");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="font-mono text-xs gap-1.5 w-full"
      onClick={test}
      disabled={status === "testing"}
    >
      {status === "testing" ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : status === "ok" ? (
        <Wifi className="h-3 w-3 text-primary" />
      ) : status === "fail" ? (
        <WifiOff className="h-3 w-3 text-destructive" />
      ) : (
        <Wifi className="h-3 w-3" />
      )}
      {status === "testing"
        ? "Test..."
        : status === "ok"
          ? "Connesso"
          : status === "fail"
            ? "Non connesso"
            : "Test connessione Kimi"}
    </Button>
  );
}

function KimiBatchAnalysis() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const runAnalysis = async () => {
    setRunning(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Effettua il login"); setRunning(false); return; }

      const res = await supabase.functions.invoke("kimi-batch-analysis", {
        body: { days: 90 },
      });

      if (res.error) throw new Error(res.error.message);

      const data = res.data as { analysis?: string; error?: string; message_count?: number };
      if (data.error) throw new Error(data.error);

      setResult(data.analysis || "Nessun risultato");
      toast.success(`Analisi completata su ${data.message_count || 0} messaggi`);
    } catch (err: any) {
      toast.error(err.message || "Errore analisi batch");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button
        onClick={runAnalysis}
        disabled={running}
        size="sm"
        variant="outline"
        className="w-full font-mono text-xs gap-2"
      >
        {running ? (
          <><Loader2 className="h-3 w-3 animate-spin" /> Analisi in corso...</>
        ) : (
          <><Sparkles className="h-3 w-3" /> Analizza risposte con Kimi</>
        )}
      </Button>
      {result && (
        <div className="rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 p-3">
          <h4 className="text-xs font-mono font-medium text-purple-800 dark:text-purple-300 mb-2">
            Analisi Kimi 2.5:
          </h4>
          <p className="text-xs text-purple-700 dark:text-purple-400 whitespace-pre-wrap">{result}</p>
        </div>
      )}
    </div>
  );
}
