import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

interface SettingToggleProps {
  chiave: string;
  label: string;
  description?: string;
  categoria?: string;
  defaultValue?: boolean;
}

export function SettingToggle({ chiave, label, description, categoria = "general", defaultValue = false }: SettingToggleProps) {
  const [checked, setChecked] = useState(defaultValue);

  useEffect(() => {
    supabase.from("app_settings").select("valore").eq("chiave", chiave).maybeSingle().then(({ data }) => {
      if (data?.valore !== undefined && data.valore !== null) {
        setChecked(data.valore === "true");
      }
    });
  }, [chiave]);

  const toggle = async (val: boolean) => {
    setChecked(val);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("app_settings").upsert(
      { chiave, valore: String(val), categoria, user_id: user.id, updated_at: new Date().toISOString() } as any,
      { onConflict: "chiave,user_id" }
    );
  };

  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-accent px-4 py-3">
      <div>
        <Label className="font-mono text-xs">{label}</Label>
        {description && <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={toggle} />
    </div>
  );
}
