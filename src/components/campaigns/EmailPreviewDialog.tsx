import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  bodyHtml: string;
  senderName: string;
  senderEmail: string;
}

const sampleVars: Record<string, string> = {
  "{{nome}}": "Mario",
  "{{azienda}}": "Bianchi S.r.l.",
  "{{citta}}": "Milano",
  "{{sito_web}}": "www.bianchisrl.it",
};

function replaceVariables(html: string): string {
  let result = html;
  for (const [key, val] of Object.entries(sampleVars)) {
    result = result.replaceAll(key, val);
  }
  return result;
}

export function EmailPreviewDialog({ open, onOpenChange, subject, bodyHtml, senderName, senderEmail }: Props) {
  const [testEmail, setTestEmail] = useState("");
  const [sending, setSending] = useState(false);

  const previewSubject = replaceVariables(subject);
  const previewHtml = replaceVariables(bodyHtml);

  const handleTestSend = async () => {
    if (!testEmail.trim()) { toast.error("Inserisci un'email di test"); return; }
    setSending(true);
    // Simulated — in production this would call an edge function
    await new Promise(r => setTimeout(r, 1500));
    setSending(false);
    toast.success(`Email di test inviata a ${testEmail}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center gap-2">
            <Eye className="h-4 w-4" /> Preview Email
          </DialogTitle>
        </DialogHeader>

        {/* Email metadata */}
        <div className="rounded-lg border border-border bg-accent p-3 space-y-1 font-mono text-xs">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-12">Da:</span>
            <span className="text-foreground">{senderName || "LeadHunter"} &lt;{senderEmail || "noreply@dominio.it"}&gt;</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-12">A:</span>
            <span className="text-foreground">mario@bianchisrl.it</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-12">Ogg:</span>
            <span className="text-foreground font-semibold">{previewSubject || "(nessun oggetto)"}</span>
          </div>
        </div>

        {/* Email body preview */}
        <div className="rounded-lg border border-border bg-white p-4 min-h-[200px]">
          {previewHtml ? (
            <div
              className="prose prose-sm max-w-none text-black"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <p className="text-gray-400 text-sm font-mono">Nessun contenuto da visualizzare</p>
          )}
        </div>

        {/* Variable legend */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(sampleVars).map(([k, v]) => (
            <span key={k} className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {k} → {v}
            </span>
          ))}
        </div>

        {/* Test send */}
        <div className="border-t border-border pt-4 space-y-3">
          <Label className="font-mono text-xs text-muted-foreground">Invia email di test a:</Label>
          <div className="flex gap-2">
            <Input
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="tuaemail@dominio.it"
              type="email"
              className="font-mono text-xs"
            />
            <Button onClick={handleTestSend} disabled={sending} size="sm" className="font-mono text-xs shrink-0">
              {sending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
              Invia test
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
