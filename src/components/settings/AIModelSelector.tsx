import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

const AI_MODELS = [
  {
    id: "lovable-gemini-flash",
    name: "Gemini 2.5 Flash",
    provider: "Lovable AI",
    icon: "⚡",
    speed: "Velocissimo",
    cost: "~€0.001/msg",
    context: "1M token",
    best_for: "Uso quotidiano, volume alto — nessuna API key richiesta",
  },
  {
    id: "lovable-gemini-pro",
    name: "Gemini 2.5 Pro",
    provider: "Lovable AI",
    icon: "🧠",
    speed: "Medio",
    cost: "~€0.005/msg",
    context: "1M token",
    best_for: "Ragionamento complesso, massima qualità — nessuna API key richiesta",
  },
  {
    id: "lovable-gpt5-mini",
    name: "GPT-5 Mini",
    provider: "Lovable AI",
    icon: "🤖",
    speed: "Veloce",
    cost: "~€0.003/msg",
    context: "128K token",
    best_for: "Bilanciato costo/qualità — nessuna API key richiesta",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    icon: "🟠",
    speed: "Velocissimo",
    cost: "~€0.0002/msg",
    context: "200K token",
    best_for: "Volume altissimo, molto economico",
    requires: "anthropic_api_key",
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    icon: "🟠",
    speed: "Veloce",
    cost: "~€0.003/msg",
    context: "200K token",
    best_for: "Messaggi complessi, alta qualità",
    requires: "anthropic_api_key",
  },
  {
    id: "moonshot-v1-8k",
    name: "Kimi 2.5 (8K)",
    provider: "Moonshot AI",
    icon: "🌙",
    speed: "Veloce",
    cost: "~€0.001/msg",
    context: "8K token",
    best_for: "Alternativa economica",
    requires: "kimi_api_key",
  },
  {
    id: "moonshot-v1-128k",
    name: "Kimi 2.5 (128K)",
    provider: "Moonshot AI",
    icon: "🌙",
    speed: "Medio",
    cost: "~€0.008/msg",
    context: "128K token",
    best_for: "Analisi batch grandi volumi",
    requires: "kimi_api_key",
  },
];

export function AIModelSelector() {
  const [activeModel, setActiveModel] = useState("lovable-gemini-flash");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("valore")
      .eq("chiave", "ai_model_attivo")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.valore) setActiveModel(data.valore);
      });
  }, []);

  const saveModel = async (modelId: string) => {
    setSaving(true);
    setActiveModel(modelId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("app_settings").upsert(
      { chiave: "ai_model_attivo", valore: modelId, categoria: "ai", user_id: user.id, updated_at: new Date().toISOString() } as any,
      { onConflict: "chiave,user_id" }
    );
    setSaving(false);
    const model = AI_MODELS.find((m) => m.id === modelId);
    toast.success(`Modello aggiornato: ${model?.name}`);
  };

  return (
    <div className="grid gap-2">
      {AI_MODELS.map((model) => (
        <button
          key={model.id}
          onClick={() => saveModel(model.id)}
          disabled={saving}
          className={cn(
            "flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-all",
            activeModel === model.id
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/40 hover:bg-muted/30"
          )}
        >
          <span className="text-xl">{model.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold text-foreground">{model.name}</span>
              <span className="text-[10px] text-muted-foreground">{model.provider}</span>
              {activeModel === model.id && (
                <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-mono">
                  Attivo
                </span>
              )}
            </div>
            <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground">
              <span>⚡ {model.speed}</span>
              <span>💰 {model.cost}</span>
              <span>📄 {model.context}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">✓ {model.best_for}</p>
          </div>
          {activeModel === model.id && <Check className="h-4 w-4 text-primary shrink-0" />}
        </button>
      ))}
      {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />}
    </div>
  );
}
