import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import Papa from "papaparse";
import { TerminalProgress } from "@/components/shared/TerminalProgress";
import { validateContactBatch } from "@/lib/validators/contact";
import { normalizeItalianPhone } from "@/lib/phoneNormalizer";

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type Step = "upload" | "mapping" | "options" | "importing";

const contactFields = [
  { value: "skip", label: "— Salta —" },
  { value: "nome", label: "Nome" },
  { value: "cognome", label: "Cognome" },
  { value: "azienda", label: "Azienda" },
  { value: "telefono", label: "Telefono" },
  { value: "email", label: "Email" },
  { value: "sito_web", label: "Sito Web" },
  { value: "indirizzo", label: "Indirizzo" },
  { value: "citta", label: "Città" },
  { value: "provincia", label: "Provincia" },
  { value: "cap", label: "CAP" },
  { value: "regione", label: "Regione" },
  { value: "note", label: "Note" },
];

export function CsvImportDialog({ open, onClose, onComplete }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);

  const handleFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);
        // Auto-map by name similarity
        const autoMap: Record<string, string> = {};
        headers.forEach((h) => {
          const lower = h.toLowerCase().trim();
          if (lower.includes("azienda") || lower.includes("ragione")) autoMap[h] = "azienda";
          else if (lower.includes("nome") && !lower.includes("cognome")) autoMap[h] = "nome";
          else if (lower.includes("cognome")) autoMap[h] = "cognome";
          else if (lower.includes("telefono") || lower.includes("tel")) autoMap[h] = "telefono";
          else if (lower.includes("email") || lower.includes("mail")) autoMap[h] = "email";
          else if (lower.includes("sito") || lower.includes("web") || lower.includes("url")) autoMap[h] = "sito_web";
          else if (lower.includes("indirizzo") || lower.includes("via")) autoMap[h] = "indirizzo";
          else if (lower.includes("città") || lower.includes("citta") || lower.includes("city")) autoMap[h] = "citta";
          else if (lower.includes("provincia") || lower.includes("prov")) autoMap[h] = "provincia";
          else if (lower.includes("cap") || lower.includes("zip")) autoMap[h] = "cap";
          else if (lower.includes("note")) autoMap[h] = "note";
          else autoMap[h] = "skip";
        });
        setMapping(autoMap);
        setStep("mapping");
        toast.success(`${results.data.length} righe lette dal CSV`);
      },
      error: () => toast.error("Errore lettura CSV"),
    });
  };

  const handleImport = async () => {
    setStep("importing");
    const batch: any[] = [];

    for (const row of csvData) {
      const contact: Record<string, string> = {};
      for (const [csvCol, field] of Object.entries(mapping)) {
        if (field !== "skip" && row[csvCol]) {
          contact[field] = row[csvCol];
        }
      }
      if (!contact.azienda) contact.azienda = "Senza nome";
      contact.fonte = "csv_import";
      contact.stato = "nuovo";
      batch.push(contact);
    }

    // Insert in chunks of 100
    const chunkSize = 100;
    let imported = 0;
    for (let i = 0; i < batch.length; i += chunkSize) {
      const chunk = batch.slice(i, i + chunkSize);
      const { error } = await supabase.from("contacts").insert(chunk as any);
      if (error) {
        console.error("Import error:", error);
      }
      imported += chunk.length;
      setImportedCount(imported);
      setImportProgress(Math.round((imported / batch.length) * 100));
    }

    toast.success(`${imported} contatti importati con successo`);
    onComplete();
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep("upload");
    setCsvHeaders([]);
    setCsvData([]);
    setMapping({});
    setImportProgress(0);
    setImportedCount(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">IMPORTA CSV</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-12 hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => document.getElementById("csv-file")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <Upload className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-mono text-sm text-muted-foreground">Trascina il tuo CSV qui o clicca per selezionare</p>
            <p className="mt-1 text-xs text-muted-foreground">Formati: .csv — Max: 50.000 righe</p>
            <input
              id="csv-file"
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {step === "mapping" && (
          <div className="space-y-4">
            <p className="font-mono text-xs text-muted-foreground">{csvData.length} righe — Mappa le colonne:</p>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {csvHeaders.map((header) => (
                <div key={header} className="flex items-center gap-3">
                  <span className="w-[200px] truncate font-mono text-xs text-foreground">"{header}"</span>
                  <span className="text-muted-foreground">→</span>
                  <select
                    value={mapping[header] || "skip"}
                    onChange={(e) => setMapping({ ...mapping, [header]: e.target.value })}
                    className="flex-1 rounded-md border border-border bg-accent px-2 py-1 font-mono text-xs text-foreground"
                  >
                    {contactFields.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-border bg-accent p-3">
              <div className="terminal-header mb-2">ANTEPRIMA (prime 3 righe)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr>
                      {Object.entries(mapping).filter(([, v]) => v !== "skip").map(([, field]) => (
                        <th key={field} className="px-2 py-1 text-left text-muted-foreground">{field}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        {Object.entries(mapping).filter(([, v]) => v !== "skip").map(([csvCol, field]) => (
                          <td key={field} className="px-2 py-1 text-foreground">{row[csvCol] || "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetAndClose}>Annulla</Button>
              <Button onClick={handleImport}>CONFERMA IMPORT ({csvData.length} righe)</Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 py-4">
            <TerminalProgress
              percent={importProgress}
              current={importedCount}
              total={csvData.length}
              label="IMPORTAZIONE IN CORSO"
            />
            <p className="font-mono text-xs text-center text-muted-foreground">
              Non chiudere questa finestra...
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
