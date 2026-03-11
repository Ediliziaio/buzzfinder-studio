import { useState } from "react";
import { SettingField } from "./SettingField";
import { Copy, Check, Webhook, Mail, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const ENDPOINT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-reply`;

const PAYLOAD_EXAMPLE = JSON.stringify({
  canale: "email",
  da_email: "cliente@esempio.it",
  da_nome: "Mario Rossi",
  oggetto: "Re: La nostra proposta",
  corpo: "Sono interessato, parliamone!",
  corpo_html: "<p>Sono interessato, parliamone!</p>",
  thread_id: "msg-abc-123",
  campaign_id: "uuid-della-campagna",
  recipient_id: "uuid-del-destinatario"
}, null, 2);

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copiato!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5" onClick={copy}>
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {label || (copied ? "Copiato" : "Copia")}
    </Button>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-mono text-xs font-bold">{n}</span>
      <div className="font-mono text-xs text-muted-foreground leading-relaxed">{children}</div>
    </div>
  );
}

export function WebhookGuideTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="terminal-header text-primary">ENDPOINT RICEZIONE RISPOSTE</div>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-accent border border-border rounded px-3 py-2 font-mono text-xs break-all select-all">
            {ENDPOINT_URL}
          </code>
          <CopyButton text={ENDPOINT_URL} />
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          Metodo: <strong>POST</strong> • Content-Type: <strong>application/json</strong> • Autenticazione non richiesta (endpoint pubblico)
        </p>
      </div>

      <Tabs defaultValue="resend">
        <TabsList className="bg-accent border border-border">
          <TabsTrigger value="resend" className="font-mono text-xs gap-1"><Mail className="h-3 w-3" /> Resend Inbound</TabsTrigger>
          <TabsTrigger value="n8n" className="font-mono text-xs gap-1"><Workflow className="h-3 w-3" /> n8n + IMAP</TabsTrigger>
          <TabsTrigger value="manual" className="font-mono text-xs gap-1"><Webhook className="h-3 w-3" /> Webhook Manuale</TabsTrigger>
        </TabsList>

        <TabsContent value="resend" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="terminal-header text-primary">METODO 1: RESEND INBOUND WEBHOOK</div>
            <p className="font-mono text-xs text-muted-foreground">
              Usa Resend Inbound per ricevere automaticamente le risposte email. Resend inoltra ogni risposta al tuo endpoint.
            </p>
            <div className="space-y-3">
              <Step n={1}>Vai su <strong>resend.com → Inbound Emails</strong> e aggiungi il tuo dominio di ricezione (es. <code>reply.tuodominio.it</code>)</Step>
              <Step n={2}>Configura un record <strong>MX DNS</strong> per il sottodominio: <code>reply.tuodominio.it → inbound.resend.com</code> (Priority: 10)</Step>
              <Step n={3}>In Resend, crea un <strong>Webhook Endpoint</strong> con l'URL del tuo endpoint (vedi sopra) e seleziona l'evento <code>email.received</code></Step>
              <Step n={4}>Configura i tuoi sender email con <strong>reply-to</strong> che punta al sottodominio (es. <code>reply+campaign123@reply.tuodominio.it</code>)</Step>
              <Step n={5}>Testa inviando un'email al tuo indirizzo di ricezione. La risposta apparirà nella Unibox.</Step>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="n8n" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="terminal-header text-primary">METODO 2: n8n + IMAP POLLING</div>
            <p className="font-mono text-xs text-muted-foreground">
              Usa n8n con un trigger IMAP per controllare periodicamente una casella email e inoltrare i nuovi messaggi al tuo endpoint.
            </p>
            <div className="space-y-3">
              <Step n={1}>In n8n, crea un nuovo workflow e aggiungi il nodo <strong>IMAP Email Trigger</strong></Step>
              <Step n={2}>Configura le credenziali IMAP della casella email (host, porta, utente, password)</Step>
              <Step n={3}>Aggiungi un nodo <strong>HTTP Request</strong> con metodo POST verso l'endpoint (vedi sopra)</Step>
              <Step n={4}>
                Mappa i campi nel body JSON:
                <pre className="mt-1 bg-accent rounded p-2 text-[10px] overflow-x-auto">{`{
  "canale": "email",
  "da_email": "{{ $json.from }}",
  "da_nome": "{{ $json.fromName }}",
  "oggetto": "{{ $json.subject }}",
  "corpo": "{{ $json.textPlain }}",
  "corpo_html": "{{ $json.html }}",
  "thread_id": "{{ $json.messageId }}"
}`}</pre>
              </Step>
              <Step n={5}>Attiva il workflow. n8n controllerà la casella ogni 1-5 minuti e inoltrerà le risposte.</Step>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div className="terminal-header text-primary">METODO 3: WEBHOOK MANUALE / CUSTOM</div>
            <p className="font-mono text-xs text-muted-foreground">
              Invia una richiesta POST al tuo endpoint da qualsiasi sistema esterno (CRM, automazione, script custom).
            </p>
            <div className="space-y-3">
              <Step n={1}>Configura il tuo sistema per inviare richieste <strong>POST</strong> all'endpoint sopra</Step>
              <Step n={2}>
                Usa il seguente payload JSON:
                <div className="mt-2 relative">
                  <pre className="bg-accent rounded p-3 text-[10px] overflow-x-auto">{PAYLOAD_EXAMPLE}</pre>
                  <div className="absolute top-1 right-1">
                    <CopyButton text={PAYLOAD_EXAMPLE} label="Copia JSON" />
                  </div>
                </div>
              </Step>
              <Step n={3}>
                Campi obbligatori: <code>canale</code>, <code>da_email</code> (o <code>da_telefono</code>), <code>corpo</code>.
                Tutti gli altri sono opzionali.
              </Step>
              <Step n={4}>La risposta apparirà nella Unibox. Se <code>thread_id</code> o <code>campaign_id</code> sono presenti, il messaggio verrà collegato alla conversazione esistente.</Step>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="terminal-header text-primary mb-2">CAMPI PAYLOAD</div>
            <div className="overflow-x-auto">
              <table className="w-full font-mono text-[10px]">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 px-2 text-muted-foreground">Campo</th>
                    <th className="text-left py-1 px-2 text-muted-foreground">Tipo</th>
                    <th className="text-left py-1 px-2 text-muted-foreground">Obbligatorio</th>
                    <th className="text-left py-1 px-2 text-muted-foreground">Descrizione</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {[
                    ["canale", "string", "Sì", "email | whatsapp | sms"],
                    ["da_email", "string", "Sì*", "Email del mittente"],
                    ["da_telefono", "string", "Sì*", "Telefono (per WA/SMS)"],
                    ["da_nome", "string", "No", "Nome del mittente"],
                    ["oggetto", "string", "No", "Oggetto email"],
                    ["corpo", "string", "Sì", "Corpo testo"],
                    ["corpo_html", "string", "No", "Corpo HTML"],
                    ["thread_id", "string", "No", "ID thread per raggruppamento"],
                    ["campaign_id", "uuid", "No", "ID campagna collegata"],
                    ["recipient_id", "uuid", "No", "ID destinatario"],
                  ].map(([campo, tipo, req, desc]) => (
                    <tr key={campo} className="border-b border-border/50">
                      <td className="py-1 px-2 font-bold">{campo}</td>
                      <td className="py-1 px-2">{tipo}</td>
                      <td className="py-1 px-2">{req}</td>
                      <td className="py-1 px-2 text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-2">* Almeno uno tra da_email e da_telefono è obbligatorio</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
