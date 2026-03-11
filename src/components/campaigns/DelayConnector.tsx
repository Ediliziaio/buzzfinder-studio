import { Clock, GitBranch } from "lucide-react";

interface Props {
  giorni: number;
  ore: number;
  condizione: string;
  onChange: (updates: { delay_giorni?: number; delay_ore?: number; condizione?: 'always' | 'if_no_reply' | 'if_no_open' | 'if_opened' }) => void;
}

export function DelayConnector({ giorni, ore, condizione, onChange }: Props) {
  return (
    <div className="flex justify-center py-1">
      <div className="border border-border rounded-lg px-4 py-2 bg-muted text-xs font-mono space-y-2 w-64">
        <div className="flex items-center gap-2">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span>Attendi</span>
          <input
            type="number"
            min={0}
            max={30}
            value={giorni}
            onChange={(e) => onChange({ delay_giorni: parseInt(e.target.value) || 0 })}
            className="w-10 bg-background border border-border rounded px-1 text-center"
          />
          <span>giorni</span>
          <input
            type="number"
            min={0}
            max={23}
            value={ore}
            onChange={(e) => onChange({ delay_ore: parseInt(e.target.value) || 0 })}
            className="w-10 bg-background border border-border rounded px-1 text-center"
          />
          <span>ore</span>
        </div>
        <div className="flex items-center gap-2">
          <GitBranch className="h-3 w-3 text-muted-foreground" />
          <select
            value={condizione}
            onChange={(e) => onChange({ condizione: e.target.value as 'always' | 'if_no_reply' | 'if_no_open' | 'if_opened' })}
            className="bg-background border border-border rounded px-1 text-xs flex-1"
          >
            <option value="if_no_reply">Solo se non ha risposto</option>
            <option value="if_no_open">Solo se non ha aperto</option>
            <option value="if_opened">Solo se ha aperto (ma non risposto)</option>
            <option value="always">Invia sempre</option>
          </select>
        </div>
      </div>
    </div>
  );
}
