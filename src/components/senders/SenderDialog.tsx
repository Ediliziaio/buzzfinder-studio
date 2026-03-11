import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserId } from "@/lib/auth";
import { toast } from "sonner";
import type { SenderPool } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sender?: SenderPool | null;
  onSaved: () => void;
}

type SenderTipo = "email" | "whatsapp" | "sms";

const defaultForm = {
  nome: "",
  tipo: "email" as SenderTipo,
  email_from: "",
  email_nome: "",
  reply_to: "",
  resend_api_key: "",
  spf_ok: false,
  dkim_ok: false,
  dmarc_ok: false,
  wa_numero: "",
  wa_phone_number_id: "",
  wa_access_token: "",
  wa_tier: "tier_1",
  sms_from: "",
  sms_provider: "twilio",
  sms_api_key: "",
  sms_api_secret: "",
  max_per_day: 50,
  warmup_attivo: true,
};

export function SenderDialog({ open, onOpenChange, sender, onSaved }: Props) {
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const isEdit = !!sender;

  useEffect(() => {
    if (sender) {
      setForm({
        nome: sender.nome,
        tipo: sender.tipo as SenderTipo,
        email_from: sender.email_from || "",
        email_nome: sender.email_nome || "",
        reply_to: sender.reply_to || "",
        resend_api_key: sender.resend_api_key || "",
        spf_ok: sender.spf_ok,
        dkim_ok: sender.dkim_ok,
        dmarc_ok: sender.dmarc_ok,
        wa_numero: sender.wa_numero || "",
        wa_phone_number_id: sender.wa_phone_number_id || "",
        wa_access_token: sender.wa_access_token || "",
        wa_tier: sender.wa_tier || "tier_1",
        sms_from: sender.sms_from || "",
        sms_provider: sender.sms_provider || "twilio",
        sms_api_key: sender.sms_api_key || "",
        sms_api_secret: sender.sms_api_secret || "",
        max_per_day: sender.max_per_day,
        warmup_attivo: sender.warmup_attivo,
      });
    } else {
      setForm(defaultForm);
    }
    setShowSecrets({});
  }, [sender, open]);

  const update = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast.error("Inserisci un nome");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        nome: form.nome,
        tipo: form.tipo,
        max_per_day: form.max_per_day,
        warmup_attivo: form.warmup_attivo,
      };

      if (form.tipo === "email") {
        Object.assign(payload, {
          email_from: form.email_from,
          email_nome: form.email_nome,
          reply_to: form.reply_to,
          resend_api_key: form.resend_api_key,
          dominio: form.email_from?.split("@")[1] || "",
          spf_ok: form.spf_ok,
          dkim_ok: form.dkim_ok,
          dmarc_ok: form.dmarc_ok,
        });
      } else if (form.tipo === "whatsapp") {
        Object.assign(payload, {
          wa_numero: form.wa_numero,
          wa_phone_number_id: form.wa_phone_number_id,
          wa_access_token: form.wa_access_token,
          wa_tier: form.wa_tier,
        });
      } else {
        Object.assign(payload, {
          sms_from: form.sms_from,
          sms_provider: form.sms_provider,
          sms_api_key: form.sms_api_key,
          sms_api_secret: form.sms_api_secret,
        });
      }

      if (isEdit && sender) {
        await supabase.from("sender_pool" as any).update(payload as any).eq("id", sender.id);
      } else {
        const user_id = await getCurrentUserId();
        await supabase.from("sender_pool" as any).insert({ ...payload, user_id } as any);
      }

      toast.success("Mittente salvato");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const secretInput = (label: string, key: string, placeholder: string) => (
    <div className="space-y-1">
      <Label className="font-mono text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input
          type={showSecrets[key] ? "text" : "password"}
          value={(form as any)[key] || ""}
          onChange={(e) => update(key, e.target.value)}
          placeholder={placeholder}
          className="font-mono text-xs bg-accent border-border"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => setShowSecrets((s) => ({ ...s, [key]: !s[key] }))}
        >
          {showSecrets[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">{isEdit ? "Modifica Mittente" : "Nuovo Mittente"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Nome */}
          <div className="space-y-1">
            <Label className="font-mono text-xs text-muted-foreground">Nome *</Label>
            <Input
              value={form.nome}
              onChange={(e) => update("nome", e.target.value)}
              placeholder="es. Dominio principale"
              className="font-mono text-xs bg-accent border-border"
            />
          </div>

          {/* Tipo (solo creazione) */}
          {!isEdit && (
            <div className="space-y-1">
              <Label className="font-mono text-xs text-muted-foreground">Tipo *</Label>
              <Select value={form.tipo} onValueChange={(v) => update("tipo", v)}>
                <SelectTrigger className="font-mono text-xs bg-accent border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Email fields */}
          {form.tipo === "email" && (
            <>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Email mittente *</Label>
                <Input value={form.email_from} onChange={(e) => update("email_from", e.target.value)} placeholder="info@tuodominio.com" className="font-mono text-xs bg-accent border-border" />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Nome visualizzato</Label>
                <Input value={form.email_nome} onChange={(e) => update("email_nome", e.target.value)} placeholder="Mario Rossi" className="font-mono text-xs bg-accent border-border" />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Reply-To</Label>
                <Input value={form.reply_to} onChange={(e) => update("reply_to", e.target.value)} placeholder="support@tuodominio.com" className="font-mono text-xs bg-accent border-border" />
              </div>
              {secretInput("Resend API Key", "resend_api_key", "re_xxxxxxxxxxxx")}
              <div className="space-y-2 rounded-lg border border-border p-3">
                <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">DNS Records</span>
                <div className="flex items-center justify-between">
                  <Label className="font-mono text-xs">SPF verificato</Label>
                  <Switch checked={form.spf_ok} onCheckedChange={(v) => update("spf_ok", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-mono text-xs">DKIM verificato</Label>
                  <Switch checked={form.dkim_ok} onCheckedChange={(v) => update("dkim_ok", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="font-mono text-xs">DMARC verificato</Label>
                  <Switch checked={form.dmarc_ok} onCheckedChange={(v) => update("dmarc_ok", v)} />
                </div>
              </div>
            </>
          )}

          {/* WhatsApp fields */}
          {form.tipo === "whatsapp" && (
            <>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Numero WhatsApp *</Label>
                <Input value={form.wa_numero} onChange={(e) => update("wa_numero", e.target.value)} placeholder="+39 333 1234567" className="font-mono text-xs bg-accent border-border" />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Phone Number ID</Label>
                <Input value={form.wa_phone_number_id} onChange={(e) => update("wa_phone_number_id", e.target.value)} placeholder="Da Meta Developer Console" className="font-mono text-xs bg-accent border-border" />
              </div>
              {secretInput("Access Token", "wa_access_token", "EAAa...")}
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Tier account</Label>
                <Select value={form.wa_tier} onValueChange={(v) => update("wa_tier", v)}>
                  <SelectTrigger className="font-mono text-xs bg-accent border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tier_1">Tier 1 (1k/giorno)</SelectItem>
                    <SelectItem value="tier_2">Tier 2 (10k/giorno)</SelectItem>
                    <SelectItem value="tier_3">Tier 3 (100k/giorno)</SelectItem>
                    <SelectItem value="unlimited">Illimitato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* SMS fields */}
          {form.tipo === "sms" && (
            <>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Numero/Sender *</Label>
                <Input value={form.sms_from} onChange={(e) => update("sms_from", e.target.value)} placeholder="+39 02 1234567" className="font-mono text-xs bg-accent border-border" />
              </div>
              <div className="space-y-1">
                <Label className="font-mono text-xs text-muted-foreground">Provider</Label>
                <Select value={form.sms_provider} onValueChange={(v) => update("sms_provider", v)}>
                  <SelectTrigger className="font-mono text-xs bg-accent border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="twilio">Twilio</SelectItem>
                    <SelectItem value="vonage">Vonage</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {secretInput("API Key", "sms_api_key", "Inserisci API Key")}
              {secretInput("API Secret", "sms_api_secret", "Inserisci API Secret")}
            </>
          )}

          {/* Common */}
          <div className="space-y-1">
            <Label className="font-mono text-xs text-muted-foreground">Max invii/giorno</Label>
            <Input type="number" value={form.max_per_day} onChange={(e) => update("max_per_day", Number(e.target.value))} className="font-mono text-xs bg-accent border-border" />
          </div>
          <div className="flex items-center justify-between">
            <Label className="font-mono text-xs">Warm-up attivo</Label>
            <Switch checked={form.warmup_attivo} onCheckedChange={(v) => update("warmup_attivo", v)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="font-mono text-xs">
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={saving} className="font-mono text-xs">
            {saving ? "Salvataggio..." : "Salva"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
