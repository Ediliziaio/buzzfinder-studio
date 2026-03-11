import { useState, useEffect, useCallback } from "react";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface SettingFieldProps {
  chiave: string;
  label: string;
  placeholder?: string;
  isSecret?: boolean;
  type?: string;
  categoria?: string;
  description?: string;
}

export function SettingField({ chiave, label, placeholder, isSecret, type = "text", categoria = "general", description }: SettingFieldProps) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    supabase.from("app_settings").select("valore").eq("chiave", chiave).maybeSingle().then(({ data }) => {
      if (data?.valore) setValue(data.valore);
    });
  }, [chiave]);

  const save = useCallback(async (val: string) => {
    setStatus("saving");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("app_settings").upsert(
      { chiave, valore: val, categoria, user_id: user.id, updated_at: new Date().toISOString() } as any,
      { onConflict: "chiave" }
    );
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1500);
  }, [chiave, categoria]);

  return (
    <div className="space-y-1">
      <Label className="font-mono text-xs text-muted-foreground">{label}</Label>
      {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
      <div className="flex gap-2">
        <Input
          type={isSecret && !visible ? "password" : type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => save(value)}
          placeholder={placeholder}
          className="font-mono text-xs bg-accent border-border"
        />
        {isSecret && (
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        {status === "saving" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />}
        {status === "saved" && <Check className="h-4 w-4 text-primary self-center" />}
      </div>
    </div>
  );
}
