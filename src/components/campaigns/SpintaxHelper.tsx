import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Plus, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onInsert: (text: string) => void;
}

const spintaxTemplates = [
  {
    category: "Saluti",
    templates: [
      "{Ciao|Salve|Buongiorno} {{nome}},",
      "{Ciao|Hey|Salve},",
      "Buon{giorno|a giornata},",
    ],
  },
  {
    category: "Apertura",
    templates: [
      "Ti {scrivo|contatto|raggiungo} per presentarti i nostri servizi.",
      "Ho {visto|trovato|scoperto} {{azienda}} e volevo {presentarmi|contattarti}.",
      "{Spero tu stia bene|Spero questa email ti trovi bene}.",
    ],
  },
  {
    category: "CTA",
    templates: [
      "{Sarebbe possibile|Potresti} fissare una {chiamata|videochiamata|call} di 15 minuti?",
      "{Hai|Avresti} 15 minuti questa {settimana|week} per una {chiamata|call} veloce?",
      "{Ti interessa|Sei interessato a} saperne di più?",
    ],
  },
  {
    category: "Chiusura",
    templates: [
      "{A presto|In attesa di un tuo riscontro},",
      "{Grazie mille|Grazie} per il tuo {tempo|interesse},",
      "{Resto disponibile|Sono disponibile} per qualsiasi {domanda|chiarimento},",
    ],
  },
];

function SpintaxBuilder({ onInsert }: { onInsert: (text: string) => void }) {
  const [options, setOptions] = useState(["", ""]);

  const addOption = () => setOptions([...options, ""]);
  const result = `{${options.filter(Boolean).join("|")}}`;

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <Input
          key={i}
          value={opt}
          onChange={(e) => {
            const updated = [...options];
            updated[i] = e.target.value;
            setOptions(updated);
          }}
          placeholder={`Opzione ${i + 1}`}
          className="font-mono text-xs bg-background border-border h-7"
        />
      ))}
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" className="text-[10px] font-mono" onClick={addOption}>
          <Plus className="h-3 w-3 mr-1" /> Opzione
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-[10px] font-mono flex-1"
          onClick={() => onInsert(result)}
          disabled={options.filter(Boolean).length < 2}
        >
          Inserisci: {result}
        </Button>
      </div>
    </div>
  );
}

export function SpintaxHelper({ onInsert }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-2 py-1.5 font-mono text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-primary" /> Spintax Helper — variazioni anti-spam
        </span>
        {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {isOpen && (
        <div className="px-2 pb-2 space-y-3">
          <p className="font-mono text-[10px] text-muted-foreground">
            Usa <code className="text-primary">{"{opzione1|opzione2}"}</code> per variazioni uniche. Clicca per inserire.
          </p>

          {spintaxTemplates.map((cat) => (
            <div key={cat.category}>
              <p className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                {cat.category}
              </p>
              <div className="flex flex-wrap gap-1">
                {cat.templates.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onInsert(t)}
                    className="rounded bg-muted/50 border border-border px-1.5 py-0.5 font-mono text-[10px] text-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/20 transition-colors text-left"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div>
            <p className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
              Costruttore Custom
            </p>
            <SpintaxBuilder onInsert={onInsert} />
          </div>
        </div>
      )}
    </div>
  );
}
