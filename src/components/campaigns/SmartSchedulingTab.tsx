import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface SchedulingData {
  timezone: string;
  ora_inizio_invio: string;
  ora_fine_invio: string;
  solo_lavorativi: boolean;
  stop_su_risposta: boolean;
  tracking_aperture: boolean;
}

interface Props {
  data: SchedulingData;
  onChange: (updates: Partial<SchedulingData>) => void;
}

export function SmartSchedulingTab({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="font-mono text-sm font-semibold">⏰ Finestra di Invio</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="font-mono text-xs">ORA INIZIO</Label>
          <Input
            type="time"
            value={data.ora_inizio_invio}
            onChange={(e) => onChange({ ora_inizio_invio: e.target.value })}
            className="font-mono mt-1"
          />
        </div>
        <div>
          <Label className="font-mono text-xs">ORA FINE</Label>
          <Input
            type="time"
            value={data.ora_fine_invio}
            onChange={(e) => onChange({ ora_fine_invio: e.target.value })}
            className="font-mono mt-1"
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="font-mono text-xs">SOLO GIORNI LAVORATIVI</Label>
          <p className="text-xs text-muted-foreground">Esclude sabato e domenica</p>
        </div>
        <Switch
          checked={data.solo_lavorativi}
          onCheckedChange={(v) => onChange({ solo_lavorativi: v })}
        />
      </div>

      <div>
        <Label className="font-mono text-xs">TIMEZONE</Label>
        <select
          className="w-full border border-border rounded px-3 py-2 text-sm font-mono mt-1 bg-background"
          value={data.timezone}
          onChange={(e) => onChange({ timezone: e.target.value })}
        >
          <option value="Europe/Rome">Europa/Roma (CET)</option>
          <option value="Europe/London">Europa/Londra (GMT)</option>
          <option value="America/New_York">America/New York (EST)</option>
          <option value="America/Los_Angeles">America/Los Angeles (PST)</option>
          <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
        </select>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="font-mono text-xs">STOP SE RISPONDE</Label>
          <p className="text-xs text-muted-foreground">Ferma la sequenza quando il lead risponde</p>
        </div>
        <Switch
          checked={data.stop_su_risposta}
          onCheckedChange={(v) => onChange({ stop_su_risposta: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label className="font-mono text-xs">TRACKING APERTURE</Label>
          <p className="text-xs text-muted-foreground">Pixel invisibile per rilevare quando apre</p>
        </div>
        <Switch
          checked={data.tracking_aperture}
          onCheckedChange={(v) => onChange({ tracking_aperture: v })}
        />
      </div>
    </div>
  );
}
