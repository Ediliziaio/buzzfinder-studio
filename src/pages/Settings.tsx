import { useState, useEffect } from "react";
import { Settings, Loader2, Download, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { exportContactsCsv, exportCampaignReport } from "@/lib/csvExporter";
import { SettingField } from "@/components/settings/SettingField";
import { SettingToggle } from "@/components/settings/SettingToggle";
import { WebhookGuideTab } from "@/components/settings/WebhookGuideTab";
import { AIModelSelector } from "@/components/settings/AIModelSelector";
import { ClaudeCoworkSetup } from "@/components/settings/ClaudeCoworkSetup";
import { KimiSetup } from "@/components/settings/KimiSetup";
import { OpenClawSetup } from "@/components/settings/OpenClawSetup";

export default function SettingsPage() {
  const [n8nStatus, setN8nStatus] = useState<"idle" | "testing" | "online" | "offline">("idle");
  const [exporting, setExporting] = useState<string | null>(null);

  const testN8n = async () => {
    setN8nStatus("testing");
    try {
      const { data } = await supabase.from("app_settings").select("valore").eq("chiave", "n8n_instance_url").maybeSingle();
      const url = data?.valore;
      if (!url) { setN8nStatus("offline"); toast.error("URL n8n non configurato"); return; }
      const start = Date.now();
      await fetch(`${url.replace(/\/$/, "")}/healthz`, { mode: "no-cors", signal: AbortSignal.timeout(5000) });
      setN8nStatus("online");
      toast.success(`n8n raggiungibile (${Date.now() - start}ms)`);
    } catch {
      setN8nStatus("offline");
      toast.error("n8n non raggiungibile");
    }
  };

  const handleExport = async (type: string) => {
    setExporting(type);
    try {
      if (type === "contacts") await exportContactsCsv();
      else if (type === "campaigns") await exportCampaignReport();
      else if (type === "activities") {
        const { data, error } = await supabase.from("contact_activities").select("*").order("created_at", { ascending: false }).limit(10000);
        if (error) throw error;
        if (!data?.length) throw new Error("Nessuna attività da esportare");
        const headers = ["tipo", "contact_id", "campaign_id", "descrizione", "created_at"];
        const rows = [headers.join(","), ...data.map(r => headers.map(h => { const v = (r as any)[h]; return v == null ? "" : String(v).includes(",") ? `"${v}"` : String(v); }).join(","))];
        downloadCsv(rows.join("\n"), `attivita_export_${new Date().toISOString().slice(0, 10)}.csv`);
      } else if (type === "backup") {
        const tables = ["contacts", "campaigns", "campaign_recipients", "campaign_steps", "campaign_step_executions", "campaign_templates", "lists", "list_contacts", "contact_activities", "usage_log", "app_settings", "scraping_sessions", "scraping_jobs", "sender_pool", "sender_daily_stats", "inbox_messages", "email_events", "unsubscribes", "suppression_list", "blacklist_checks", "follow_up_sequences", "follow_up_steps", "follow_up_log", "pipeline_leads", "call_sessions", "automation_rules", "automation_executions"] as const;
        const backup: Record<string, unknown[]> = {};
        for (const table of tables) { const { data } = await supabase.from(table).select("*"); backup[table] = data || []; }
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `buzzfinder_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      }
      toast.success("Esportazione completata");
    } catch (err: any) { toast.error(err.message || "Errore esportazione"); }
    finally { setExporting(null); }
  };

  const downloadCsv = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="font-display text-xl font-bold text-foreground">IMPOSTAZIONI</h1>
      </div>

      <Tabs defaultValue="api_keys">
        <TabsList className="bg-accent border border-border flex-wrap">
          <TabsTrigger value="api_keys" className="font-mono text-xs">API Keys</TabsTrigger>
          <TabsTrigger value="webhook" className="font-mono text-xs">Webhook n8n</TabsTrigger>
          <TabsTrigger value="orari" className="font-mono text-xs">Orari Invio</TabsTrigger>
          <TabsTrigger value="tracking" className="font-mono text-xs">Tracking</TabsTrigger>
          <TabsTrigger value="ai" className="font-mono text-xs">AI</TabsTrigger>
          <TabsTrigger value="ai_calls" className="font-mono text-xs">📞 AI & Chiamate</TabsTrigger>
          <TabsTrigger value="ricezione" className="font-mono text-xs">Ricezione</TabsTrigger>
          <TabsTrigger value="agenti" className="font-mono text-xs">🤖 Agenti AI</TabsTrigger>
          <TabsTrigger value="export" className="font-mono text-xs">Import/Export</TabsTrigger>
        </TabsList>

        {/* API Keys */}
        <TabsContent value="api_keys" className="space-y-4">
          <Section title="RESEND (Email)">
            <SettingField chiave="resend_api_key" label="Resend API Key" placeholder="re_..." isSecret categoria="api_keys" />
          </Section>
          <Section title="ANTHROPIC (AI)">
            <SettingField chiave="anthropic_api_key" label="Anthropic API Key" placeholder="sk-ant-..." isSecret categoria="api_keys" />
          </Section>
          <Section title="EMAIL VALIDATION">
            <SettingField chiave="millionverifier_api_key" label="MillionVerifier API Key" placeholder="Inserisci API key..." isSecret categoria="api_keys" />
            <SettingField chiave="zerobounce_api_key" label="ZeroBounce API Key" placeholder="Inserisci API key..." isSecret categoria="api_keys" />
          </Section>
          <Section title="GOOGLE MAPS">
            <SettingField chiave="google_maps_api_key" label="Google Maps Places API Key" placeholder="AIza..." isSecret categoria="api_keys" />
          </Section>
          <Section title="SCRAPINGBEE">
            <SettingField chiave="scrapingbee_api_key" label="ScrapingBee API Key" placeholder="Inserisci API key..." isSecret categoria="api_keys" />
          </Section>
          <Section title="META WHATSAPP BUSINESS">
            <SettingField chiave="meta_access_token" label="Meta Access Token" placeholder="EAAa..." isSecret categoria="api_keys" />
            <SettingField chiave="meta_phone_number_id" label="Phone Number ID" placeholder="1234567890123456" categoria="api_keys" />
            <SettingField chiave="meta_waba_id" label="WhatsApp Business Account ID" placeholder="9876543210987654" categoria="api_keys" />
          </Section>
          <Section title="TELNYX (SMS)">
            <SettingField chiave="telnyx_api_key" label="Telnyx API Key v2" placeholder="KEY01..." isSecret categoria="api_keys" />
          </Section>
        </TabsContent>

        {/* Webhook n8n */}
        <TabsContent value="webhook" className="space-y-4">
          <Section title="CONNESSIONE n8n" extra={
            <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5" onClick={testN8n} disabled={n8nStatus === "testing"}>
              {n8nStatus === "testing" ? <Loader2 className="h-3 w-3 animate-spin" /> : n8nStatus === "online" ? <Wifi className="h-3 w-3 text-primary" /> : n8nStatus === "offline" ? <WifiOff className="h-3 w-3 text-destructive" /> : <Wifi className="h-3 w-3" />}
              {n8nStatus === "testing" ? "Test..." : n8nStatus === "online" ? "Online" : n8nStatus === "offline" ? "Offline" : "Test connessione"}
            </Button>
          }>
            <SettingField chiave="n8n_instance_url" label="n8n Instance URL" placeholder="https://n8n.tuodominio.com" categoria="webhook" />
            <SettingField chiave="n8n_api_key" label="n8n API Key" placeholder="Inserisci API key..." isSecret categoria="webhook" />
          </Section>
          <Section title="WEBHOOK PATHS">
            <SettingField chiave="n8n_webhook_scrape_maps" label="Scraping Maps" placeholder="/webhook/scrape-maps" categoria="webhook" />
            <SettingField chiave="n8n_webhook_scrape_websites" label="Scraping Web" placeholder="/webhook/scrape-websites" categoria="webhook" />
            <SettingField chiave="n8n_webhook_send_emails" label="Invia Email" placeholder="/webhook/send-emails" categoria="webhook" />
            <SettingField chiave="n8n_webhook_send_sms" label="Invia SMS" placeholder="/webhook/send-sms" categoria="webhook" />
            <SettingField chiave="n8n_webhook_send_whatsapp" label="Invia WhatsApp" placeholder="/webhook/send-whatsapp" categoria="webhook" />
            <SettingField chiave="n8n_webhook_campaign_control" label="Controllo Campagna" placeholder="/webhook/campaign-control" categoria="webhook" />
          </Section>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="font-mono text-[10px] text-muted-foreground">
              Ogni webhook riceve un payload JSON con i dati necessari per l'esecuzione. Configura i workflow n8n in modo che accettino richieste POST sugli endpoint indicati sopra.
            </p>
          </div>
        </TabsContent>

        {/* Orari Invio */}
        <TabsContent value="orari" className="space-y-4">
          <Section title="ORARI DEFAULT">
            <div className="grid grid-cols-2 gap-4">
              <SettingField chiave="default_ora_inizio" label="Ora inizio invio" placeholder="08:00" type="time" categoria="orari" />
              <SettingField chiave="default_ora_fine" label="Ora fine invio" placeholder="19:00" type="time" categoria="orari" />
            </div>
            <SettingField chiave="default_timezone" label="Timezone" placeholder="Europe/Rome" categoria="orari" />
            <SettingToggle chiave="default_solo_lavorativi" label="Solo giorni lavorativi" description="Non inviare nei weekend" categoria="orari" defaultValue />
          </Section>
          <Section title="LIMITI INVIO">
            <div className="grid grid-cols-2 gap-4">
              <SettingField chiave="limit_email_day" label="Email / giorno" placeholder="1000" type="number" categoria="limiti" />
              <SettingField chiave="limit_sms_day" label="SMS / giorno" placeholder="500" type="number" categoria="limiti" />
              <SettingField chiave="limit_whatsapp_day" label="WhatsApp / giorno" placeholder="250" type="number" categoria="limiti" />
              <SettingField chiave="delay_sms_ms" label="Delay tra SMS (ms)" placeholder="1200" type="number" categoria="limiti" />
              <SettingField chiave="max_contacts_campaign" label="Max contatti / campagna" placeholder="5000" type="number" categoria="limiti" />
              <SettingField chiave="delay_scraping_ms" label="Delay scraping web (ms)" placeholder="1500" type="number" categoria="limiti" />
            </div>
          </Section>
          <Section title="BUDGET & ALERT">
            <SettingField chiave="budget_mensile" label="Budget mensile (€)" placeholder="500" type="number" categoria="limiti" />
            <div className="grid grid-cols-3 gap-4">
              <SettingField chiave="alert_email_eur" label="Alert Email (€/mese)" placeholder="5.00" type="number" categoria="limiti" />
              <SettingField chiave="alert_sms_eur" label="Alert SMS (€/mese)" placeholder="100.00" type="number" categoria="limiti" />
              <SettingField chiave="alert_whatsapp_eur" label="Alert WhatsApp (€/mese)" placeholder="200.00" type="number" categoria="limiti" />
            </div>
          </Section>
        </TabsContent>

        {/* Tracking */}
        <TabsContent value="tracking" className="space-y-4">
          <Section title="TRACKING EMAIL">
            <SettingToggle chiave="tracking_aperture_default" label="Tracking aperture (open pixel)" description="Inserisce un pixel 1×1 per tracciare le aperture email" categoria="tracking" defaultValue />
            <SettingToggle chiave="tracking_click_default" label="Tracking click" description="Riscrive i link per tracciare i click" categoria="tracking" defaultValue />
          </Section>
          <Section title="DOMINIO TRACKING PERSONALIZZATO">
            <SettingField chiave="custom_tracking_domain" label="Custom Tracking Domain" placeholder="track.miodominio.it" categoria="tracking" description="Configura un CNAME DNS che punti al server di tracking per migliorare la deliverability" />
          </Section>
          <Section title="BLOCKLIST EMAIL">
            <BlocklistEditor />
          </Section>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="font-mono text-[10px] text-muted-foreground">
              ⚠️ GDPR: Assicurati che i tuoi contatti abbiano dato consenso al trattamento dati. L'app non gestisce automaticamente il consenso GDPR.
            </p>
          </div>
        </TabsContent>

        {/* AI */}
        <TabsContent value="ai" className="space-y-4">
          <Section title="MODELLO AI">
            <AiModelSelector />
            <SettingField chiave="ai_budget_max_campagna" label="Budget max AI per campagna (€)" placeholder="10.00" type="number" categoria="ai" description="Limite di spesa AI per singola campagna" />
          </Section>
          <Section title="STIMA COSTI">
            <div className="rounded-md border border-border bg-accent p-3 space-y-1">
              <p className="font-mono text-xs text-muted-foreground">Gemini Flash: ~€0.001 / contatto personalizzato</p>
              <p className="font-mono text-xs text-muted-foreground">GPT-5 Mini: ~€0.003 / contatto personalizzato</p>
              <p className="font-mono text-xs text-muted-foreground">Gemini Pro: ~€0.005 / contatto personalizzato</p>
              <p className="font-mono text-xs text-muted-foreground">1000 contatti × Flash ≈ €1.00</p>
            </div>
          </Section>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="font-mono text-[10px] text-muted-foreground">
              L'AI è integrata nativamente tramite Lovable Cloud. Personalizza oggetto e corpo email per ogni contatto usando dati aziendali.
            </p>
          </div>
        </TabsContent>

        {/* AI & Chiamate */}
        <TabsContent value="ai_calls" className="space-y-4">
          <Section title="ANTHROPIC (CLAUDE AI)">
            <SettingField chiave="anthropic_api_key" label="Anthropic API Key" placeholder="sk-ant-..." isSecret categoria="api_keys" />
            <div className="space-y-1">
              <Label className="font-mono text-xs text-muted-foreground">Modello AI attivo</Label>
              <AnthropicModelSelect />
            </div>
          </Section>
          <Section title="ELEVENLABS CONVERSATIONAL AI" extra={<ElevenLabsTestButton />}>
            <SettingField chiave="elevenlabs_api_key" label="ElevenLabs API Key" placeholder="sk_..." isSecret categoria="api_keys" />
            <SettingField chiave="elevenlabs_agent_id_default" label="ID Agente Default" placeholder="agent_..." categoria="ai_calls" />
            <SettingField chiave="elevenlabs_phone_number_id" label="Phone Number ID" placeholder="pn_..." categoria="ai_calls" />
            <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-primary hover:underline mt-1">
              → Gestisci agenti su ElevenLabs Dashboard
            </a>
          </Section>
          <Section title="IMPOSTAZIONI CHIAMATE AI">
            <div className="grid grid-cols-2 gap-4">
              <SettingField chiave="chiamate_orario_inizio" label="Orario inizio chiamate" placeholder="09:00" type="time" categoria="ai_calls" />
              <SettingField chiave="chiamate_orario_fine" label="Orario fine chiamate" placeholder="18:00" type="time" categoria="ai_calls" />
            </div>
            <SettingToggle chiave="chiamate_solo_lavorativi" label="Solo giorni lavorativi" description="Non effettuare chiamate nei weekend" categoria="ai_calls" defaultValue />
            <div className="grid grid-cols-2 gap-4">
              <SettingField chiave="chiamate_max_tentativi" label="Max tentativi per lead" placeholder="3" type="number" categoria="ai_calls" />
              <SettingField chiave="chiamate_intervallo_min" label="Minuti tra tentativi" placeholder="60" type="number" categoria="ai_calls" />
            </div>
          </Section>
        </TabsContent>

        {/* Ricezione Risposte */}
        <TabsContent value="ricezione">
          <WebhookGuideTab />
        </TabsContent>

        {/* Agenti AI */}
        <TabsContent value="agenti" className="space-y-4">
          <Section title="MODELLO AI ATTIVO">
            <p className="text-[10px] text-muted-foreground mb-2">
              Scegli quale AI usa BuzzFinder per personalizzare i messaggi e categorizzare le risposte
            </p>
            <AIModelSelector />
          </Section>
          <Section title="🟠 CLAUDE COWORK">
            <ClaudeCoworkSetup />
          </Section>
          <Section title="🌙 KIMI 2.5 (MOONSHOT AI)">
            <KimiSetup />
          </Section>
          <Section title="🦅 OPENCLAW (AGENTE LOCALE)">
            <OpenClawSetup />
          </Section>
        </TabsContent>

        {/* Import/Export */}
        <TabsContent value="export" className="space-y-4">
          <Section title="IMPORT">
            <Button variant="outline" size="sm" className="font-mono text-xs w-full justify-start" onClick={() => window.location.href = "/contacts"}>
              ↑ Importa CSV contatti → vai alla pagina Contatti
            </Button>
          </Section>
          <Section title="EXPORT">
            {[
              { key: "contacts", label: "↓ Esporta tutti i contatti CSV" },
              { key: "campaigns", label: "↓ Esporta report campagne" },
              { key: "activities", label: "↓ Esporta log attività" },
              { key: "backup", label: "↓ Backup completo database JSON" },
            ].map(({ key, label }) => (
              <Button key={key} variant="outline" size="sm" className="font-mono text-xs w-full justify-start gap-2" onClick={() => handleExport(key)} disabled={exporting === key}>
                {exporting === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                {exporting === key ? "Esportazione..." : label}
              </Button>
            ))}
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Section({ title, children, extra }: { title: string; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="terminal-header text-primary">{title}</div>
        {extra}
      </div>
      {children}
    </div>
  );
}

function BlocklistEditor() {
  const [value, setValue] = useState("");

  useEffect(() => {
    supabase.from("app_settings").select("valore").eq("chiave", "email_blocklist").maybeSingle().then(({ data }) => {
      if (data?.valore) setValue(data.valore);
    });
  }, []);

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("app_settings").upsert(
      { chiave: "email_blocklist", valore: value, categoria: "tracking", user_id: user.id, updated_at: new Date().toISOString() } as any,
      { onConflict: "chiave,user_id" }
    );
    toast.success("Blocklist salvata");
  };

  return (
    <div className="space-y-2">
      <Label className="font-mono text-xs text-muted-foreground">Domini e pattern da escludere (uno per riga)</Label>
      <Textarea value={value} onChange={(e) => setValue(e.target.value)} onBlur={save} placeholder={"@spam.com\nnoreply@*\ndonotreply@*"} className="min-h-[100px] font-mono text-xs bg-accent border-border" />
    </div>
  );
}

function AiModelSelector() {
  const [model, setModel] = useState("gemini-flash");

  useEffect(() => {
    supabase.from("app_settings").select("valore").eq("chiave", "ai_model_default").maybeSingle().then(({ data }) => {
      if (data?.valore) setModel(data.valore);
    });
  }, []);

  const save = async (val: string) => {
    setModel(val);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("app_settings").upsert(
      { chiave: "ai_model_default", valore: val, categoria: "ai", user_id: user.id, updated_at: new Date().toISOString() } as any,
      { onConflict: "chiave,user_id" }
    );
  };

  return (
    <div className="space-y-1">
      <Label className="font-mono text-xs text-muted-foreground">Modello AI default</Label>
      <Select value={model} onValueChange={save}>
        <SelectTrigger className="font-mono text-xs bg-accent border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="gemini-flash">Gemini 2.5 Flash (veloce, economico)</SelectItem>
          <SelectItem value="gemini-pro">Gemini 2.5 Pro (preciso, potente)</SelectItem>
          <SelectItem value="gpt-5-mini">GPT-5 Mini (bilanciato)</SelectItem>
          <SelectItem value="gpt-5">GPT-5 (massima qualità)</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
