import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Check, Loader2, AlertCircle, Save } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SettingFieldProps {
  chiave: string;
  label: string;
  placeholder?: string;
  isSecret?: boolean;
  type?: string;
  categoria?: string;
  description?: string;
  validator?: (val: string) => Promise<string | null>;
}

export function SettingField({ chiave, label, placeholder, isSecret, type = "text", categoria = "general", description, validator }: SettingFieldProps) {
  const [value, setValue] = useState("");
  const [initialValue, setInitialValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("valore").eq("chiave", chiave).maybeSingle().then(({ data }) => {
      if (data?.valore) {
        setValue(data.valore);
        setInitialValue(data.valore);
      }
    });
  }, [chiave]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setDirty(e.target.value !== initialValue);
    if (status === "error") {
      setStatus("idle");
      setErrorMsg(null);
    }
  };

  const save = useCallback(async () => {
    if (!dirty && status !== "idle") return;
    setStatus("saving");
    setErrorMsg(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStatus("idle"); return; }

    // Validate if validator provided and value is not empty
    if (validator && value.trim()) {
      const validationError = await validator(value.trim());
      if (validationError) {
        setStatus("error");
        setErrorMsg(validationError);
        toast.error(`${label}: ${validationError}`);
        return;
      }
    }

    await supabase.from("app_settings").upsert(
      { chiave, valore: value, categoria, user_id: user.id, updated_at: new Date().toISOString() } as any,
      { onConflict: "chiave,user_id" }
    );
    setInitialValue(value);
    setDirty(false);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1500);
  }, [chiave, categoria, value, dirty, validator, label, status]);

  return (
    <div className="space-y-1">
      <Label className="font-mono text-xs text-muted-foreground">{label}</Label>
      {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
      <div className="flex gap-2">
        <Input
          type={isSecret && !visible ? "password" : type}
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className={`font-mono text-xs bg-accent border-border ${status === "error" ? "border-destructive" : ""}`}
        />
        {isSecret && (
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        <Button
          variant={dirty ? "default" : "ghost"}
          size="icon"
          className="shrink-0"
          onClick={save}
          disabled={!dirty || status === "saving"}
          title="Salva"
        >
          {status === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : status === "saved" ? (
            <Check className="h-4 w-4 text-primary" />
          ) : status === "error" ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : (
            <Save className="h-4 w-4" />
          )}
        </Button>
      </div>
      {errorMsg && (
        <p className="text-[10px] text-destructive font-mono">{errorMsg}</p>
      )}
    </div>
  );
}
