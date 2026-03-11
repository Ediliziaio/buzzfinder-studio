import { useState, useEffect } from "react";
import { Settings, Eye, EyeOff, Loader2, Save, Plus, Trash2, Wifi, WifiOff, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportContactsCsv, exportCampaignReport } from "@/lib/csvExporter";
import { useSenderPool } from "@/hooks/useSenderPool";
import { SenderCard } from "@/components/senders/SenderCard";
import { SenderDialog } from "@/components/senders/SenderDialog";
import { SenderHealthDashboard } from "@/components/senders/SenderHealthDashboard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Shield } from "lucide-react";
import type { SenderPool } from "@/types";

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
  { chiave: "n8n_webhook_campaign_control", label: "n8n Webhook — Controllo Campagna", placeholder: "/webhook/campaign-control", isSecret: false, categoria: "api_keys" },
  { chiave: "resend_api_key", label: "Resend API Key", placeholder: "re_...", isSecret: true, categoria: "api_keys" },
  { chiave: "telnyx_api_key", label: "Telnyx API Key v2", placeholder: "KEY01...", isSecret: true, categoria: "api_keys" },
  { chiave: "meta_access_token", label: "Meta WhatsApp Access Token", placeholder: "EAAa...", isSecret: true, categoria: "api_keys" },
  { chiave: "meta_phone_number_id", label: "Meta Phone Number ID", placeholder: "1234567890123456", isSecret: false, categoria: "api_keys" },
  { chiave: "meta_waba_id", label: "WhatsApp Business Account ID", placeholder: "9876543210987654", isSecret: false, categoria: "api_keys" },
  { chiave: "anthropic_api_key", label: "Anthropic API Key (AI Personalization)", placeholder: "sk-ant-...", isSecret: true, categoria: "api_keys" },
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

const alertFields: SettingField[] = [
  { chiave: "alert_email_eur", label: "Alert soglia Email (€/mese)", placeholder: "5.00", categoria: "limiti" },
  { chiave: "alert_sms_eur", label: "Alert soglia SMS (€/mese)", placeholder: "100.00", categoria: "limiti" },
  { chiave: "alert_whatsapp_eur", label: "Alert soglia WhatsApp (€/mese)", placeholder: "200.00", categoria: "limiti" },
];

export default function SettingsPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [blocklist, setBlocklist] = useState("");
  const [n8nStatus, setN8nStatus] = useState<"idle" | "testing" | "online" | "offline">("idle");
  const [senders, setSenders] = useState<{ email: string; name: string }[]>([]);
  const [newSender, setNewSender] = useState({ email: "", name: "" });
  const [exporting, setExporting] = useState<string | null>(null);
  const [senderTipoFilter, setSenderTipoFilter] = useState<"email" | "whatsapp" | "sms" | undefined>(undefined);
  const { senders: poolSenders, loading: poolLoading, fetchSenders: refetchPool, toggleActive: togglePoolActive, deleteSender: deletePoolSender } = useSenderPool(senderTipoFilter);
  const [editingSender, setEditingSender] = useState<SenderPool | null>(null);
  const [senderDialogOpen, setSenderDialogOpen] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    const { data } = await supabase.from("app_settings").select("*") as any;
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((s: any) => { map[s.chiave] = s.valore || ""; });
      setValues(map);
      setBlocklist(map["email_blocklist"] || "");
      try {
        const sendersJson = map["email_senders"];
        if (sendersJson) setSenders(JSON.parse(sendersJson));
      } catch {}
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allFields = [...apiKeyFields, ...limitFields, ...alertFields];
      for (const field of allFields) {
        const val = values[field.chiave];
        if (val !== undefined) {
          await supabase.from("app_settings").upsert(
            { chiave: field.chiave, valore: val, categoria: field.categoria, updated_at: new Date().toISOString() } as any,
            { onConflict: "chiave" }
          );
        }
      }
      await supabase.from("app_settings").upsert(
        { chiave: "email_blocklist", valore: blocklist, categoria: "limiti", updated_at: new Date().toISOString() } as any,
        { onConflict: "chiave" }
      );
      await supabase.from("app_settings").upsert(
        { chiave: "email_senders", valore: JSON.stringify(senders), categoria: "mittenti", updated_at: new Date().toISOString() } as any,
        { onConflict: "chiave" }
      );
      // Save sender defaults
      for (const key of ["sender_name_default", "sender_email_default", "reply_to_default"]) {
        const val = values[key];
        if (val !== undefined) {
          await supabase.from("app_settings").upsert(
            { chiave: key, valore: val, categoria: "mittenti", updated_at: new Date().toISOString() } as any,
            { onConflict: "chiave" }
          );
        }
      }
      toast.success("Impostazioni salvate");
    } catch {
      toast.error("Errore salvataggio impostazioni");
    } finally {
      setSaving(false);
    }
  };

  const testN8n = async () => {
    setN8nStatus("testing");
    try {
      const url = values["n8n_instance_url"];
      if (!url) { setN8nStatus("offline"); toast.error("URL n8n non configurato"); return; }
      const start = Date.now();
      await fetch(`${url.replace(/\/$/, "")}/healthz`, { mode: "no-cors", signal: AbortSignal.timeout(5000) });
      const ping = Date.now() - start;
      setN8nStatus("online");
      toast.success(`n8n raggiungibile (${ping}ms)`);
    } catch {
      setN8nStatus("offline");
      toast.error("n8n non raggiungibile");
    }
  };

  const addSender = () => {
    if (!newSender.email.trim()) return;
    setSenders([...senders, { email: newSender.email.trim(), name: newSender.name.trim() }]);
    setNewSender({ email: "", name: "" });
  };

  const removeSender = (i: number) => setSenders(senders.filter((_, idx) => idx !== i));

  const handleExport = async (type: string) => {
    setExporting(type);
    try {
      if (type === "contacts") await exportContactsCsv();
      else if (type === "campaigns") await exportCampaignReport();
      else if (type === "activities") await exportActivityLog();
      else if (type === "backup") await exportFullBackup();
      toast.success("Esportazione completata");
    } catch (err: any) {
      toast.error(err.message || "Errore esportazione");
    } finally {
      setExporting(null);
    }
  };

  const exportActivityLog = async () => {
    const { data, error } = await supabase.from("contact_activities").select("*").order("created_at", { ascending: false }).limit(10000);
    if (error) throw error;
    if (!data?.length) throw new Error("Nessuna attività da esportare");
    const headers = ["tipo", "contact_id", "campaign_id", "descrizione", "created_at"];
    const rows = [headers.join(","), ...data.map(r => headers.map(h => {
      const v = (r as any)[h];
      return v == null ? "" : String(v).includes(",") ? `"${v}"` : String(v);
    }).join(","))];
    downloadCsv(rows.join("\n"), `attivita_export_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  const exportFullBackup = async () => {
    const tables = ["contacts", "campaigns", "campaign_recipients", "lists", "list_contacts", "contact_activities", "usage_log", "app_settings", "scraping_sessions", "scraping_jobs"] as const;
    const backup: Record<string, unknown[]> = {};
    for (const table of tables) {
      const { data } = await supabase.from(table).select("*");
      backup[table] = data || [];
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leadhunter_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadCsv = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          <TabsTrigger value="sender_pool" className="font-mono text-xs">
            <Shield className="h-3 w-3 mr-1" /> Pool Mittenti
          </TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="api_keys" className="space-y-4">
          {[
            { title: "GOOGLE MAPS", keys: apiKeyFields.filter(f => f.chiave.startsWith("google")) },
            { title: "SCRAPINGBEE", keys: apiKeyFields.filter(f => f.chiave.startsWith("scrapingbee")) },
            {
              title: "n8n", keys: apiKeyFields.filter(f => f.chiave.startsWith("n8n")),
              extra: (
                <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5" onClick={testN8n} disabled={n8nStatus === "testing"}>
                  {n8nStatus === "testing" ? <Loader2 className="h-3 w-3 animate-spin" /> : n8nStatus === "online" ? <Wifi className="h-3 w-3 text-primary" /> : n8nStatus === "offline" ? <WifiOff className="h-3 w-3 text-destructive" /> : <Wifi className="h-3 w-3" />}
                  {n8nStatus === "testing" ? "Test..." : n8nStatus === "online" ? "Online" : n8nStatus === "offline" ? "Offline" : "Test connessione"}
                </Button>
              )
            },
            { title: "RESEND", keys: apiKeyFields.filter(f => f.chiave.startsWith("resend")) },
            { title: "TELNYX", keys: apiKeyFields.filter(f => f.chiave.startsWith("telnyx")) },
            { title: "META WHATSAPP BUSINESS", keys: apiKeyFields.filter(f => f.chiave.startsWith("meta")) },
            { title: "AI PERSONALIZATION", keys: apiKeyFields.filter(f => f.chiave.startsWith("anthropic")) },
          ].map((group) => (
            <div key={group.title} className="rounded-lg border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="terminal-header text-primary">{group.title}</div>
                {(group as any).extra}
              </div>
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
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setVisibility({ ...visibility, [field.chiave]: !visibility[field.chiave] })}>
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
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="terminal-header text-primary">EMAIL MITTENTI</div>
            {senders.length === 0 && (
              <p className="font-mono text-xs text-muted-foreground">Nessun mittente configurato. Aggiungi il primo.</p>
            )}
            {senders.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-md border border-border bg-accent px-3 py-2">
                <div>
                  <span className="font-mono text-sm text-foreground">{s.email}</span>
                  {s.name && <span className="font-mono text-xs text-muted-foreground ml-2">"{s.name}"</span>}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeSender(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={newSender.email} onChange={(e) => setNewSender({ ...newSender, email: e.target.value })} placeholder="email@dominio.it" className="font-mono text-xs bg-accent border-border flex-1" />
              <Input value={newSender.name} onChange={(e) => setNewSender({ ...newSender, name: e.target.value })} placeholder="Nome mittente" className="font-mono text-xs bg-accent border-border flex-1" />
              <Button variant="outline" size="sm" onClick={addSender} className="font-mono text-xs shrink-0">
                <Plus className="h-3 w-3 mr-1" /> Aggiungi
              </Button>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">I mittenti saranno disponibili come opzione nel wizard campagne email. Ricorda di verificare il dominio su Resend.</p>
          </div>

          {/* Sender Defaults (Bug M3) */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="terminal-header text-primary">DEFAULTS MITTENTE</div>
            <p className="text-xs text-muted-foreground">Valori pre-compilati nel wizard campagne email</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Nome mittente default</Label>
                <Input
                  value={values["sender_name_default"] || ""}
                  onChange={(e) => setValues({ ...values, sender_name_default: e.target.value })}
                  placeholder="La mia azienda"
                  className="font-mono text-xs bg-accent border-border"
                />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Email mittente default</Label>
                <Input
                  value={values["sender_email_default"] || ""}
                  onChange={(e) => setValues({ ...values, sender_email_default: e.target.value })}
                  placeholder="outreach@miodominio.it"
                  className="font-mono text-xs bg-accent border-border"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="font-mono text-xs text-muted-foreground">Reply-to default</Label>
              <Input
                value={values["reply_to_default"] || ""}
                onChange={(e) => setValues({ ...values, reply_to_default: e.target.value })}
                placeholder="info@miodominio.it"
                className="font-mono text-xs bg-accent border-border"
              />
            </div>
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
            <div className="terminal-header text-primary">ALERT SOGLIE COSTI</div>
            <p className="text-xs text-muted-foreground">Ricevi una notifica se il costo mensile supera queste soglie</p>
            <div className="grid grid-cols-3 gap-4">
              {alertFields.map((field) => (
                <div key={field.chiave} className="space-y-1">
                  <Label className="font-mono text-xs text-muted-foreground">{field.label}</Label>
                  <Input
                    type="number"
                    step="0.01"
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
            <Button variant="outline" size="sm" className="font-mono text-xs w-full justify-start" onClick={() => window.location.href = "/contacts"}>
              ↑ Importa CSV contatti → vai alla pagina Contatti
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="terminal-header text-primary">EXPORT</div>
            {[
              { key: "contacts", label: "↓ Esporta tutti i contatti CSV" },
              { key: "campaigns", label: "↓ Esporta report campagne" },
              { key: "activities", label: "↓ Esporta log attività" },
              { key: "backup", label: "↓ Backup completo database JSON" },
            ].map(({ key, label }) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                className="font-mono text-xs w-full justify-start gap-2"
                onClick={() => handleExport(key)}
                disabled={exporting === key}
              >
                {exporting === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                {exporting === key ? "Esportazione..." : label}
              </Button>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
