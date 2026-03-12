import { useState } from "react";
import { Copy, Check, ExternalLink, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";

export function OpenClawSetup() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copiato!");
  };

  const openclawSkill = `// BuzzFinder Studio Skill per OpenClaw
// Salva in: ~/.openclaw/skills/buzzfinder.js

const SUPABASE_URL = "${supabaseUrl}";
const SUPABASE_KEY = "${anonKey}";

const headers = {
  "apikey": SUPABASE_KEY,
  "Authorization": \`Bearer \${SUPABASE_KEY}\`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

export const tools = {
  async getUnreadMessages() {
    const res = await fetch(
      \`\${SUPABASE_URL}/rest/v1/inbox_messages?letto=eq.false&archiviato=eq.false&order=data_ricezione.desc&limit=20\`,
      { headers }
    );
    return await res.json();
  },

  async markAsRead(messageId) {
    await fetch(
      \`\${SUPABASE_URL}/rest/v1/inbox_messages?id=eq.\${messageId}\`,
      { method: "PATCH", headers, body: JSON.stringify({ letto: true }) }
    );
  },

  async updatePipelineStage(recipientId, stage, note = "") {
    await fetch(
      \`\${SUPABASE_URL}/rest/v1/campaign_recipients?id=eq.\${recipientId}\`,
      {
        method: "PATCH", headers,
        body: JSON.stringify({
          pipeline_stage: stage,
          pipeline_note: note,
          pipeline_updated: new Date().toISOString()
        })
      }
    );
  },

  async triggerSequenceEngine(campaignId = null) {
    await fetch(\`\${SUPABASE_URL}/functions/v1/process-sequence\`, {
      method: "POST", headers,
      body: JSON.stringify(campaignId ? { campaign_id: campaignId } : {})
    });
  },

  async searchContacts(query) {
    const res = await fetch(
      \`\${SUPABASE_URL}/rest/v1/contacts?or=(nome.ilike.*\${query}*,email.ilike.*\${query}*,azienda.ilike.*\${query}*)&limit=10\`,
      { headers }
    );
    return await res.json();
  }
};

export const schedule = {
  "avvia-sequenze-mattina": {
    cron: "0 9 * * 1-5",
    action: async () => {
      await tools.triggerSequenceEngine();
      console.log("[BuzzFinder] Sequenze avviate");
    }
  },
  "controlla-inbox-ora": {
    cron: "0 * * * *",
    action: async () => {
      const messages = await tools.getUnreadMessages();
      if (messages.length > 0) {
        console.log(\`[BuzzFinder] \${messages.length} nuove risposte\`);
      }
    }
  }
};`;

  const relayCode = `// OpenClaw WhatsApp/Gmail Relay → BuzzFinder Unibox
// Salva in: ~/.openclaw/skills/buzzfinder-relay.js

const HANDLE_REPLY_URL = "${supabaseUrl}/functions/v1/handle-reply";

export const onWhatsAppMessage = async (message) => {
  await fetch(HANDLE_REPLY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      canale: "whatsapp",
      da_telefono: message.from,
      da_nome: message.contact?.name || null,
      corpo: message.body,
      data_ricezione: new Date().toISOString()
    })
  });
};

export const onGmailMessage = async (email) => {
  await fetch(HANDLE_REPLY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      canale: "email",
      da_email: email.from.address,
      da_nome: email.from.name,
      oggetto: email.subject,
      corpo: email.text,
      corpo_html: email.html
    })
  });
};`;

  const webhookUrls = [
    { label: "Relay risposte (email/WA/SMS)", url: `${supabaseUrl}/functions/v1/handle-reply` },
    { label: "Avvia sequenze invio", url: `${supabaseUrl}/functions/v1/process-sequence` },
    { label: "Valida email", url: `${supabaseUrl}/functions/v1/validate-emails` },
    { label: "Personalizza messaggi", url: `${supabaseUrl}/functions/v1/personalize-messages` },
  ];

  return (
    <div className="space-y-5">
      <Alert className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30">
        <Info className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-emerald-800 dark:text-emerald-300">Cosa fa OpenClaw con BuzzFinder</AlertTitle>
        <AlertDescription className="text-emerald-700 dark:text-emerald-400 text-xs space-y-1 mt-1">
          <p>✅ <strong>WhatsApp relay:</strong> riceve le risposte WA e le invia all'Unibox</p>
          <p>✅ <strong>Gmail relay:</strong> intercetta le email di risposta e le invia all'Unibox</p>
          <p>✅ <strong>Cron jobs:</strong> avvia le sequenze di invio ogni mattina automaticamente</p>
          <p>✅ <strong>Notifiche:</strong> ti avvisa quando arriva un lead "interessato"</p>
        </AlertDescription>
      </Alert>

      {/* Step 1 */}
      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold text-foreground">Step 1 — Installa OpenClaw</p>
        <a
          href="https://openclaw.ai/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-xs text-primary hover:underline"
        >
          🦅 openclaw.ai <ExternalLink className="h-3 w-3" />
        </a>
        <div className="bg-muted rounded px-3 py-2 font-mono text-xs flex items-center justify-between">
          <span>npm install -g @openclaw/cli</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2"
            onClick={() => copyText("npm install -g @openclaw/cli", "install")}
          >
            {copied === "install" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {/* Step 2 */}
      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold text-foreground">Step 2 — Skill BuzzFinder</p>
        <p className="text-[10px] text-muted-foreground">
          Salva in: ~/.openclaw/skills/buzzfinder.js
        </p>
        <div className="relative">
          <pre className="rounded-lg bg-muted p-3 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
            {openclawSkill}
          </pre>
          <Button
            size="sm"
            variant="outline"
            className="absolute top-2 right-2 h-7 text-[10px] gap-1"
            onClick={() => copyText(openclawSkill, "skill")}
          >
            {copied === "skill" ? <><Check className="h-3 w-3" /> Copiato</> : <><Copy className="h-3 w-3" /> Copia</>}
          </Button>
        </div>
      </div>

      {/* Step 3 */}
      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold text-foreground">Step 3 — Relay WhatsApp & Gmail</p>
        <p className="text-[10px] text-muted-foreground">
          Salva in: ~/.openclaw/skills/buzzfinder-relay.js
        </p>
        <div className="relative">
          <pre className="rounded-lg bg-muted p-3 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
            {relayCode}
          </pre>
          <Button
            size="sm"
            variant="outline"
            className="absolute top-2 right-2 h-7 text-[10px] gap-1"
            onClick={() => copyText(relayCode, "relay")}
          >
            {copied === "relay" ? <><Check className="h-3 w-3" /> Copiato</> : <><Copy className="h-3 w-3" /> Copia</>}
          </Button>
        </div>
      </div>

      {/* Webhook URLs */}
      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold text-foreground">URL Webhook</p>
        <div className="space-y-2">
          {webhookUrls.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground whitespace-nowrap">{item.label}:</span>
              <code className="flex-1 truncate font-mono text-foreground bg-muted px-1.5 py-0.5 rounded">
                {item.url}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-5 w-5 p-0 shrink-0"
                onClick={() => copyText(item.url, item.label)}
              >
                {copied === item.label ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
