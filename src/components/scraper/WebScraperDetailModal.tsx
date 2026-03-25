import { Copy, Check, Star, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useRef, useEffect } from "react";
import type { ScrapingJob, Contact } from "@/types";

interface Props {
  job: ScrapingJob | null;
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WebScraperDetailModal({ job, contact, open, onOpenChange }: Props) {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current); };
  }, []);

  if (!job) return null;

  const domain = job.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  const emails = job.emails_found || [];
  const phones = job.phones_found || [];
  const social = (job.social_found || {}) as Record<string, string>;

  const handleCopy = (text: string, type: "email" | "phone") => {
    navigator.clipboard.writeText(text);
    if (type === "email") setCopiedEmail(text);
    else setCopiedPhone(text);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => { setCopiedEmail(null); setCopiedPhone(null); }, 2000);
  };

  const handleSetPrimaryEmail = async (email: string) => {
    if (!contact) return;
    const confidence = getEmailConfidence(email, emails);
    const { error } = await supabase
      .from("contacts")
      .update({ email, email_confidence: confidence, updated_at: new Date().toISOString() })
      .eq("id", contact.id);
    if (error) {
      toast.error("Errore aggiornamento contatto");
    } else {
      toast.success(`Email principale: ${email}`);
    }
  };

  const handleSaveToContact = async () => {
    if (!contact) return;
    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (emails.length > 0 && !contact.email) {
      updates.email = emails[0];
      updates.email_confidence = getEmailConfidence(emails[0], emails);
    }
    if (phones.length > 0 && !contact.telefono) {
      updates.telefono = phones[0];
      const normalized = phones[0].replace(/[\s\-\.\/]/g, "");
      updates.telefono_normalizzato = normalized.startsWith("+39") ? normalized : `+39${normalized.replace(/^0/, "")}`;
    }
    if (social.linkedin && !contact.linkedin_url) updates.linkedin_url = social.linkedin;
    if (social.facebook && !contact.facebook_url) updates.facebook_url = social.facebook;
    if (social.instagram && !contact.instagram_url) updates.instagram_url = social.instagram;

    const { error } = await supabase.from("contacts").update(updates).eq("id", contact.id);
    if (error) {
      toast.error("Errore salvataggio");
    } else {
      toast.success("Dati salvati nel contatto");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{domain}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Emails */}
          <div className="space-y-2">
            <div className="terminal-header text-primary">📧 EMAIL TROVATE</div>
            {emails.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">Nessuna email trovata</p>
            ) : (
              <div className="space-y-1">
                {emails.map((email) => {
                  const confidence = getEmailConfidence(email, emails);
                  const stars = Math.min(confidence, 3);
                  const color = stars >= 3 ? "text-primary" : stars >= 2 ? "text-warning" : "text-destructive";
                  const label = stars >= 3 ? "Pagina contatti" : stars >= 2 ? "Footer" : "Body";

                  return (
                    <div key={email} className="flex items-center justify-between rounded-md border border-border bg-accent p-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-foreground">{email}</span>
                        <div className="flex">
                          {[1, 2, 3].map((s) => (
                            <Star key={s} className={`h-2.5 w-2.5 ${s <= stars ? color : "text-muted"}`} fill={s <= stars ? "currentColor" : "none"} />
                          ))}
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] font-mono"
                          onClick={() => handleCopy(email, "email")}
                        >
                          {copiedEmail === email ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        {contact && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] font-mono"
                            onClick={() => handleSetPrimaryEmail(email)}
                          >
                            Imposta principale
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phones */}
          <div className="space-y-2">
            <div className="terminal-header text-primary">📞 TELEFONI TROVATI</div>
            {phones.length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">Nessun telefono trovato</p>
            ) : (
              <div className="space-y-1">
                {phones.map((phone) => {
                  const normalized = phone.replace(/[\s\-\.\/]/g, "");
                  const display = normalized.startsWith("+39") ? normalized : `+39 ${normalized.replace(/^0/, "")}`;
                  return (
                    <div key={phone} className="flex items-center justify-between rounded-md border border-border bg-accent p-2">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs text-foreground">{display}</span>
                        <span className="font-mono text-[10px] text-muted-foreground block">{phone} (originale)</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] font-mono"
                        onClick={() => handleCopy(display, "phone")}
                      >
                        {copiedPhone === display ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Social */}
          <div className="space-y-2">
            <div className="terminal-header text-primary">🔗 SOCIAL TROVATI</div>
            {Object.keys(social).length === 0 ? (
              <p className="font-mono text-xs text-muted-foreground">Nessun profilo social trovato</p>
            ) : (
              <div className="space-y-1">
                {Object.entries(social).map(([platform, url]) => (
                  <div key={platform} className="flex items-center justify-between rounded-md border border-border bg-accent p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground capitalize">{platform}</span>
                      <a
                        href={url as string}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-info hover:underline truncate max-w-[300px]"
                      >
                        {url as string}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Processing info */}
          {job.processing_time_ms && (
            <div className="text-[10px] font-mono text-muted-foreground">
              Processato in {(job.processing_time_ms / 1000).toFixed(1)}s | Tentativo #{job.tentativo}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {contact ? (
            <Button onClick={handleSaveToContact} className="flex-1 font-mono text-xs">
              <Save className="h-3 w-3 mr-1" /> SALVA NEL CONTATTO
            </Button>
          ) : (
            <Button disabled className="flex-1 font-mono text-xs" variant="outline">
              Nessun contatto associato
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function getEmailConfidence(email: string, allEmails: string[]): number {
  const lower = email.toLowerCase();
  if (lower.startsWith("info@") || lower.startsWith("contatti@") || lower.startsWith("contact@")) return 3;
  if (allEmails.indexOf(email) === 0) return 2;
  return 1;
}
