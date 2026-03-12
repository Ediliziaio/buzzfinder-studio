import { useState } from "react";
import { Copy, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { SettingField } from "./SettingField";

export function ClaudeCoworkSetup() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const [copied, setCopied] = useState<string | null>(null);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Copiato!");
  };

  const skillConfig = `# BuzzFinder Studio Integration

## Descrizione
Hai accesso a BuzzFinder Studio, un CRM per email outreach.

## Supabase REST API
Base URL: ${supabaseUrl}/rest/v1/
Headers richiesti:
  apikey: ${anonKey}
  Authorization: Bearer ${anonKey}

## Tabelle principali
- inbox_messages (letto, archiviato, etichetta, corpo, da_email, da_nome)
- campaign_recipients (pipeline_stage, contact_id, risposta_at)
- contacts (nome, cognome, email, azienda, sito_web, ai_intro)
- campaigns (nome, stato, tipo)

## Azioni disponibili
GET  /inbox_messages?letto=eq.false&archiviato=eq.false  → Leggi risposte non lette
PATCH /inbox_messages?id=eq.{id}                          → Aggiorna messaggio
PATCH /campaign_recipients?id=eq.{id}                     → Aggiorna pipeline stage
POST  ${supabaseUrl}/functions/v1/process-sequence        → Avvia invio sequenze

## Pipeline stages validi
interessato | meeting_fissato | proposta_inviata | vinto | perso`;

  const systemPrompt = `Sei l'assistente AI di BuzzFinder Studio. Il tuo compito è:

1. Ogni ora controlla l'Unibox per nuove risposte non lette
2. Categorizza le risposte: interessato, non_interessato, richiesta_info, fuori_ufficio, obiezione
3. Se un lead è "interessato" → sposta il pipeline_stage a "meeting_fissato"
4. Se un lead è "non_interessato" → sposta a "perso"
5. Riassumi le risposte importanti per l'utente

Usa SOLO la REST API di BuzzFinder per leggere e scrivere dati.
Non inventare dati. Se non trovi informazioni, dillo.`;

  return (
    <div className="space-y-4">
      <Alert className="border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/30">
        <Info className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-800 dark:text-orange-300">Come funziona</AlertTitle>
        <AlertDescription className="text-orange-700 dark:text-orange-400 text-xs">
          Claude Cowork è l'agente AI desktop di Anthropic. Con questa configurazione,
          Claude può leggere l'Unibox, spostare i lead nel CRM e avviare le sequenze
          autonomamente — usando la REST API come "strumenti".
        </AlertDescription>
      </Alert>

      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold text-foreground">Step 1 — Anthropic API Key</p>
        <SettingField
          chiave="anthropic_api_key"
          label="Anthropic API Key"
          placeholder="sk-ant-..."
          isSecret
          categoria="api_keys"
        />
      </div>

      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold text-foreground">Step 2 — Configurazione Skill</p>
        <p className="text-[10px] text-muted-foreground">
          Copia e incolla in un file .md nella cartella Skills di Claude Cowork
          (es: ~/Documents/Claude/Skills/buzzfinder.md)
        </p>
        <div className="relative">
          <pre className="rounded-lg bg-muted p-3 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
            {skillConfig}
          </pre>
          <Button
            size="sm"
            variant="outline"
            className="absolute top-2 right-2 h-7 text-[10px] gap-1"
            onClick={() => copyText(skillConfig, "skill")}
          >
            {copied === "skill" ? <><Check className="h-3 w-3" /> Copiato</> : <><Copy className="h-3 w-3" /> Copia</>}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="font-mono text-xs font-semibold text-foreground">Step 3 — System Prompt</p>
        <p className="text-[10px] text-muted-foreground">
          Usa questo prompt per istruire l'agente Claude su cosa fare con BuzzFinder:
        </p>
        <div className="relative">
          <pre className="rounded-lg bg-muted p-3 text-[10px] font-mono text-muted-foreground overflow-x-auto max-h-36 overflow-y-auto whitespace-pre-wrap">
            {systemPrompt}
          </pre>
          <Button
            size="sm"
            variant="outline"
            className="absolute top-2 right-2 h-7 text-[10px] gap-1"
            onClick={() => copyText(systemPrompt, "prompt")}
          >
            {copied === "prompt" ? <><Check className="h-3 w-3" /> Copiato</> : <><Copy className="h-3 w-3" /> Copia</>}
          </Button>
        </div>
      </div>
    </div>
  );
}
