import { Plus } from "lucide-react";
import { StepCard } from "./StepCard";
import { DelayConnector } from "./DelayConnector";
import type { SequenceStep } from "@/types";

interface Props {
  steps: SequenceStep[];
  onChange: (steps: SequenceStep[]) => void;
}

export function SequenceBuilder({ steps, onChange }: Props) {
  const addStep = () => {
    const newStep: SequenceStep = {
      step_number: steps.length + 1,
      tipo: "email",
      delay_giorni: steps.length === 0 ? 0 : 3,
      delay_ore: 0,
      condizione: "if_no_reply",
      soggetto: "",
      corpo_html: "",
      messaggio: "",
      ab_peso: 100,
    };
    onChange([...steps, newStep]);
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={index}>
          {index > 0 && (
            <DelayConnector
              giorni={step.delay_giorni}
              ore={step.delay_ore}
              condizione={step.condizione}
              onChange={(updates) => {
                const updated = [...steps];
                updated[index] = { ...updated[index], ...updates };
                onChange(updated);
              }}
            />
          )}
          <StepCard
            step={step}
            stepIndex={index + 1}
            onEdit={(updated) => {
              const newSteps = [...steps];
              newSteps[index] = updated;
              onChange(newSteps);
            }}
            onDelete={() => {
              onChange(
                steps
                  .filter((_, i) => i !== index)
                  .map((s, i) => ({ ...s, step_number: i + 1 }))
              );
            }}
          />
        </div>
      ))}

      <button
        onClick={addStep}
        className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-all font-mono"
      >
        <Plus className="h-4 w-4 inline mr-2" />
        Aggiungi step
      </button>

      {steps.length >= 2 && (
        <p className="text-xs text-muted-foreground text-center font-mono">
          💡 Sequenza stimata: {steps.reduce((sum, s) => sum + (s.delay_giorni || 0), 0)} giorni totali
        </p>
      )}
    </div>
  );
}
