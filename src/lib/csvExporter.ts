import { supabase } from "@/integrations/supabase/client";

/**
 * Export contacts to CSV with streaming for large datasets.
 */
export async function exportContactsCsv(filters?: Record<string, unknown>): Promise<void> {
  const PAGE_SIZE = 1000;
  let offset = 0;
  let allRows: Record<string, unknown>[] = [];
  let hasMore = true;

  while (hasMore) {
    let query = supabase.from("contacts").select("*").range(offset, offset + PAGE_SIZE - 1).order("created_at", { ascending: false });

    // Apply basic filters if provided
    if (filters?.stato && Array.isArray(filters.stato)) {
      query = query.in("stato", filters.stato as string[]);
    }
    if (filters?.hasEmail) {
      query = query.not("email", "is", null);
    }
    if (filters?.scraping_session_id && typeof filters.scraping_session_id === "string") {
      query = query.eq("scraping_session_id", filters.scraping_session_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      offset += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  if (allRows.length === 0) throw new Error("Nessun contatto da esportare");

  const headers = [
    "azienda", "nome", "cognome", "email", "telefono", "telefono_normalizzato",
    "sito_web", "indirizzo", "citta", "provincia", "cap", "regione",
    "stato", "fonte", "tags", "google_rating", "google_reviews_count",
    "google_categories", "note", "created_at",
  ];

  const csvRows = [headers.join(",")];
  for (const row of allRows) {
    const values = headers.map((h) => {
      const val = (row as any)[h];
      if (val === null || val === undefined) return "";
      if (Array.isArray(val)) return `"${val.join("; ")}"`;
      const str = String(val);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvRows.push(values.join(","));
  }

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contatti_export_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportCampaignReport(): Promise<void> {
  const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Nessuna campagna da esportare");

  const headers = ["nome", "tipo", "stato", "totale_destinatari", "inviati", "consegnati", "aperti", "cliccati", "errori", "costo_stimato_eur", "costo_reale_eur", "created_at"];
  const csvRows = [headers.join(",")];
  for (const row of data) {
    const values = headers.map((h) => {
      const val = (row as any)[h];
      if (val === null || val === undefined) return "";
      const str = String(val);
      return str.includes(",") ? `"${str}"` : str;
    });
    csvRows.push(values.join(","));
  }

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campagne_report_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
