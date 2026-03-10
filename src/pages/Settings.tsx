import { useState, useEffect } from "react";
import { Settings, Eye, EyeOff, CheckCircle, XCircle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SettingField {
  chiave: string;
  label: string;
  placeholder: string;
  isSecret?: boolean;
  categoria: string;
}

const apiKeyFields: SettingField[] = [
  { chiave: "google_maps_api_key", label: "Google Maps Places API Key", placeholder: "AIza...", isSecret: true, categoria: "api_keys" },
  { chiave: "scrapingbee_api_key", label: "ScrapingBee API Key", placeholder: "Inserisci API key...", isSecret: true, categoria: "api_keys" },
  { chiave: "n8n_instance_url", label: "n8n Instance URL", placeholder: "https://n8n.tuodominio.com", isSecret: false, categoria: "api_keys" },
  { chiave: "n8n_api_key", label: "n8n API Key", placeholder: "Inserisci API key...", isSecret: true, categoria: "api_keys" },
  { chiave: "n8n_webhook_scrape_maps", label: "n8n Webhook — Scraping Maps", placeholder: "/webhook/scrape-maps", isSecret: false, categoria: "api_keys" },
  { chiave: "n8n_webhook_scrape_websites", label: "n8n Webhook — Scraping Web", placeholder: "/webhook/scrape-websites", isSecret: false, categoria: "api_keys" },
  { chiave: "n8n_webhook_send_emails", label: "n8n Webhook — Invia Email", placeholder: "/webhook/send-emails", isSecret: false, categoria: "api_keys" },
  { chiave: "n8n_webhook_send_sms", label: "n8n Webhook — Invia SMS", placeholder: "/webhook/send-sms", isSecret: false, categoria: "api_keys" },
  { chiave: "n8n_webhook_send_whatsapp", label: "n8n Webhook — Invia WhatsApp", placeholder: "/webhook/send-whatsapp", isSecret: false, categoria: "api_keys" },
  { chiave: "resend_api_key", label: "Resend API Key", placeholder: "re_...", isSecret: true, categoria: "api_keys" },
  { chiave: "telnyx_api_key", label: "Telnyx API Key v2", placeholder: "KEY01...", isSecret: true, categoria: "api_keys" },
  { chiave: "meta_access_token", label: "Meta WhatsApp Access Token", placeholder: "EAAa...", isSecret: true, categoria: "api_keys" },
  { chiave: "meta_phone_number_id", label: "Meta Phone Number ID", placeholder: "1234567890123456", isSecret: false, categoria: "api_keys" },
  { chiave: "meta_waba_id", label: "WhatsApp Business Account ID", placeholder: "9876543210987654", isSecret: false, categoria: "api_keys" },
];

const limitFields: SettingField[] = [
  { chiave: "limit_email_day", label: "Invio Email / giorno", placeholder: "1000", categoria: "limiti" },
  { chiave: "limit_sms_day", label: "Invio SMS / giorno", placeholder: "500", categoria: "limiti" },
  { chiave: "limit_whatsapp_day", label: "Invio WhatsApp / giorno", placeholder: "250", categoria: "limiti" },
  { chiave: "delay_sms_ms", label: "Delay tra SMS (ms)", placeholder: "1200", categoria: "limiti" },
  { chiave: "max_contacts_campaign", label: "Max contatti per campagna", placeholder: "5000", categoria: "limiti" },
  { chiave: "delay_scraping_ms", label: "Delay scraping web (ms)", placeholder: "1500", categoria: "limiti" },
  { chiave: "budget_mensile", label: "Budget mensile (€)", placeholder: "500", categoria: "limiti" },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [blocklist, setBlocklist] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from("app_settings").select("*") as any;
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((s: any) => {
        map[s.chiave] = s.valore || "";
      });
      setValues(map);
      setBlocklist(map["email_blocklist"] || "");
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allFields = [...apiKeyFields, ...limitFields];
      for (const field of allFields) {
        const val = values[field.chiave];
        if (val !== undefined) {
          await supabase.from("app_settings").upsert(
            { chiave: field.chiave, valore: val, categoria: field.categoria, updated_at: new Date().toISOString() } as any,
            { onConflict: "chiave" }
          );
        }
      }
      // Save blocklist
      await supabase.from("app_settings").upsert(
        { chiave: "email_blocklist", valore: blocklist, categoria: "limiti", updated_at: new Date().toISOString() } as any,
        { onConflict: "chiave" }
      );
      toast.success("Impostazioni salvate");
    } catch (err) {
      toast.error("Errore salvataggio impostazioni");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-primary" />
          <h1 className="font-display text-xl font-bold text-foreground">IMPOSTAZIONI</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          SALVA TUTTO
        </Button>
      </div>

      <Tabs defaultValue="api_keys">
        <TabsList className="bg-accent border border-border">
          <TabsTrigger value="api_keys" className="font-mono text-xs">API Keys</TabsTrigger>
          <TabsTrigger value="mittenti" className="font-mono text-xs">Mittenti</TabsTrigger>
          <TabsTrigger value="limiti" className="font-mono text-xs">Limiti</TabsTrigger>
          <TabsTrigger value="import_export" className="font-mono text-xs">Import/Export</TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="api_keys" className="space-y-4">
          {/* Group by provider */}
          {[
            { title: "GOOGLE MAPS", keys: apiKeyFields.filter(f => f.chiave.startsWith("google")) },
            { title: "SCRAPINGBEE", keys: apiKeyFields.filter(f => f.chiave.startsWith("scrapingbee")) },
            { title: "n8n", keys: apiKeyFields.filter(f => f.chiave.startsWith("n8n")) },
            { title: "RESEND", keys: apiKeyFields.filter(f => f.chiave.startsWith("resend")) },
            { title: "TELNYX", keys: apiKeyFields.filter(f => f.chiave.startsWith("telnyx")) },
            { title: "META WHATSAPP BUSINESS", keys: apiKeyFields.filter(f => f.chiave.startsWith("meta")) },
          ].map((group) => (
            <div key={group.title} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="terminal-header text-primary">{group.title}</div>
              {group.keys.map((field) => (
                <div key={field.chiave} className="space-y-1">
                  <Label className="font-mono text-xs text-muted-foreground">{field.label}</Label>
                  <div className="flex gap-2">
                    <Input
                      type={field.isSecret && !visibility[field.chiave] ? "password" : "text"}
                      value={values[field.chiave] || ""}
                      onChange={(e) => setValues({ ...values, [field.chiave]: e.target.value })}
                      placeholder={field.placeholder}
                      className="font-mono text-xs bg-accent border-border"
                    />
                    {field.isSecret && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={() => setVisibility({ ...visibility, [field.chiave]: !visibility[field.chiave] })}
                      >
                        {visibility[field.chiave] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </TabsContent>

        {/* Mittenti Tab */}
        <TabsContent value="mittenti" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="font-mono text-sm text-muted-foreground">Gestione mittenti email verificati — Verrà implementato con integrazione Resend</p>
          </div>
        </TabsContent>

        {/* Limiti Tab */}
        <TabsContent value="limiti" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="terminal-header text-primary">LIMITI INVIO</div>
            <div className="grid grid-cols-2 gap-4">
              {limitFields.map((field) => (
                <div key={field.chiave} className="space-y-1">
                  <Label className="font-mono text-xs text-muted-foreground">{field.label}</Label>
                  <Input
                    type="number"
                    value={values[field.chiave] || ""}
                    onChange={(e) => setValues({ ...values, [field.chiave]: e.target.value })}
                    placeholder={field.placeholder}
                    className="font-mono text-xs bg-accent border-border"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="terminal-header text-primary">BLOCKLIST EMAIL</div>
            <p className="text-xs text-muted-foreground">Domini e pattern da escludere (uno per riga)</p>
            <Textarea
              value={blocklist}
              onChange={(e) => setBlocklist(e.target.value)}
              placeholder={"@spam.com\nnoreply@*\ndonotreply@*"}
              className="min-h-[120px] font-mono text-xs bg-accent border-border"
            />
          </div>
        </TabsContent>

        {/* Import/Export Tab */}
        <TabsContent value="import_export" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="terminal-header text-primary">IMPORT</div>
            <Button variant="outline" size="sm" className="font-mono text-xs w-full justify-start">↑ Importa CSV contatti → vai alla pagina Contatti</Button>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="terminal-header text-primary">EXPORT</div>
            <Button variant="outline" size="sm" className="font-mono text-xs w-full justify-start">↓ Esporta tutti i contatti CSV</Button>
            <Button variant="outline" size="sm" className="font-mono text-xs w-full justify-start">↓ Esporta contatti filtrati</Button>
            <Button variant="outline" size="sm" className="font-mono text-xs w-full justify-start">↓ Esporta log attività</Button>
            <Button variant="outline" size="sm" className="font-mono text-xs w-full justify-start">↓ Esporta report campagne</Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
