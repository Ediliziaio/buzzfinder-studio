import { useState, useEffect } from "react";
import { ShieldCheck, Eye, EyeOff, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSenderPool } from "@/hooks/useSenderPool";
import { BlacklistMonitor } from "@/components/senders/BlacklistMonitor";

export default function DeliverabilityPage() {
  const { senders } = useSenderPool();
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from("app_settings").select("chiave, valore").in("chiave", ["email_validator_provider", "email_validator_key"]);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((s) => { map[s.chiave] = s.valore || ""; });
      setValues(map);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Non autenticato"); setSaving(false); return; }
      for (const key of ["email_validator_provider", "email_validator_key"]) {
        const val = values[key];
        if (val !== undefined) {
          await supabase.from("app_settings").upsert(
            { chiave: key, valore: val, categoria: "deliverability", user_id: user.id, updated_at: new Date().toISOString() } as any,
            { onConflict: "chiave,user_id" }
          );
        }
      }
      toast.success("Impostazioni deliverability salvate");
    } catch {
      toast.error("Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">DELIVERABILITY</h1>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Salva
        </Button>
      </div>

      <BlacklistMonitor senders={senders} />

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="terminal-header text-primary">SOGLIE DI ALLERTA DELIVERABILITY</div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3">
            <div>
              <p className="font-mono text-xs font-medium text-foreground">Bounce rate</p>
              <p className="font-mono text-[10px] text-muted-foreground">Avviso: &gt;2% • Critico: &gt;5%</p>
            </div>
            <p className="font-mono text-[10px] text-destructive">Google/Yahoo bloccano a &gt;10%</p>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 p-3">
            <div>
              <p className="font-mono text-xs font-medium text-foreground">Spam rate</p>
              <p className="font-mono text-[10px] text-muted-foreground">Avviso: &gt;0.1% • Critico: &gt;0.3%</p>
            </div>
            <p className="font-mono text-[10px] text-destructive">Gmail blocca a &gt;0.3%</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="terminal-header text-primary">API VALIDATORE EMAIL</div>
        <p className="text-xs text-muted-foreground">Configura un validatore esterno per verifiche avanzate (MX, SMTP)</p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="font-mono text-xs text-muted-foreground">Provider di validazione</Label>
            <select
              value={values["email_validator_provider"] || "mx"}
              onChange={(e) => setValues({ ...values, email_validator_provider: e.target.value })}
              className="flex h-10 w-full rounded-md border border-input bg-accent px-3 py-2 text-sm font-mono ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="mx">Solo MX (gratuito)</option>
              <option value="millionverifier">MillionVerifier</option>
              <option value="zerobounce">ZeroBounce</option>
            </select>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">
              {(values["email_validator_provider"] || "mx") === "mx"
                ? "Verifica record MX del dominio — gratuito, senza API key"
                : "Verifica SMTP avanzata — richiede API key"}
            </p>
          </div>
          {(values["email_validator_provider"] === "millionverifier" || values["email_validator_provider"] === "zerobounce") && (
            <div className="space-y-1">
              <Label className="font-mono text-xs text-muted-foreground">
                {values["email_validator_provider"] === "millionverifier" ? "MillionVerifier" : "ZeroBounce"} API Key
              </Label>
              <div className="flex gap-2">
                <Input
                  type={visibility["email_validator_key"] ? "text" : "password"}
                  value={values["email_validator_key"] || ""}
                  onChange={(e) => setValues({ ...values, email_validator_key: e.target.value })}
                  placeholder="Inserisci API key..."
                  className="font-mono text-xs bg-accent border-border"
                />
                <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setVisibility({ ...visibility, email_validator_key: !visibility["email_validator_key"] })}>
                  {visibility["email_validator_key"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
