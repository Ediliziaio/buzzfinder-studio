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

type Step = "upload" | "mapping" | "options" | "importing" | "done";
type DuplicateHandling = "skip" | "update";

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
  const [invalidRows, setInvalidRows] = useState<{ row: Record<string, unknown>; errors: string }[]>([]);
  const [showInvalid, setShowInvalid] = useState(false);

  const handleFile = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setCsvData(results.data as Record<string, string>[]);
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
    const rawBatch: Record<string, unknown>[] = [];

    for (const row of csvData) {
      const contact: Record<string, unknown> = {};
      for (const [csvCol, field] of Object.entries(mapping)) {
        if (field !== "skip" && row[csvCol]) {
          contact[field] = row[csvCol];
        }
      }
      if (!contact.azienda) contact.azienda = "Senza nome";
      // Normalize before validation
      if (typeof contact.telefono === "string") {
        contact.telefono_normalizzato = normalizeItalianPhone(contact.telefono);
      }
      if (typeof contact.email === "string") {
        contact.email = contact.email.toLowerCase().trim();
      }
      if (typeof contact.sito_web === "string" && !(contact.sito_web as string).startsWith("http")) {
        contact.sito_web = `https://${contact.sito_web}`;
      }
      contact.fonte = "csv_import";
      contact.stato = "nuovo";
      rawBatch.push(contact);
    }

    // Validate with Zod
    const { valid, invalid } = validateContactBatch(rawBatch);
    setInvalidRows(invalid);

    if (valid.length === 0) {
      toast.error(`Nessuna riga valida su ${rawBatch.length}. Controlla i dati.`);
      setStep("done");
      return;
    }

    // Insert valid rows in chunks of 100
    const chunkSize = 100;
    let imported = 0;
    for (let i = 0; i < valid.length; i += chunkSize) {
      const chunk = valid.slice(i, i + chunkSize);
      const { error } = await supabase.from("contacts").insert(chunk as any);
      if (error) {
        console.error("Import error:", error);
      }
      imported += chunk.length;
      setImportedCount(imported);
      setImportProgress(Math.round((imported / valid.length) * 100));
    }

    const msg = invalid.length > 0
      ? `${imported} contatti importati, ${invalid.length} scartati per errori di validazione`
      : `${imported} contatti importati con successo`;
    toast.success(msg);
    onComplete();
    setStep("done");
  };

  const resetAndClose = () => {
    setStep("upload");
    setCsvHeaders([]);
    setCsvData([]);
    setMapping({});
    setImportProgress(0);
    setImportedCount(0);
    setInvalidRows([]);
    setShowInvalid(false);
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

        {step === "done" && (
          <div className="space-y-4 py-4">
            <p className="font-mono text-sm text-foreground text-center">
              ✅ {importedCount} contatti importati
              {invalidRows.length > 0 && (
                <span className="text-destructive"> — {invalidRows.length} scartati</span>
              )}
            </p>

            {invalidRows.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <button
                  onClick={() => setShowInvalid(!showInvalid)}
                  className="flex items-center gap-2 w-full text-left font-mono text-xs text-destructive"
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>{invalidRows.length} righe con errori di validazione</span>
                  {showInvalid ? <ChevronUp className="h-3.5 w-3.5 ml-auto" /> : <ChevronDown className="h-3.5 w-3.5 ml-auto" />}
                </button>
                {showInvalid && (
                  <div className="mt-2 max-h-[200px] overflow-y-auto space-y-1">
                    {invalidRows.slice(0, 10).map((inv, i) => (
                      <div key={i} className="font-mono text-xs text-muted-foreground border-t border-border pt-1">
                        <span className="text-foreground">{(inv.row as any).azienda || `Riga ${i + 1}`}</span>
                        {" — "}{inv.errors}
                      </div>
                    ))}
                    {invalidRows.length > 10 && (
                      <p className="text-xs text-muted-foreground pt-1">...e altre {invalidRows.length - 10} righe</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={resetAndClose}>CHIUDI</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
