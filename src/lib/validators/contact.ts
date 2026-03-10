import { z } from "zod";

export const contactImportSchema = z.object({
  google_maps_place_id: z.string().min(1).nullable().optional(),
  azienda: z.string().min(1, "Nome azienda obbligatorio"),
  nome: z.string().nullable().optional(),
  cognome: z.string().nullable().optional(),

  telefono: z.string().nullable().optional(),
  telefono_normalizzato: z
    .string()
    .regex(/^\+\d{7,15}$/, "Formato telefono non valido")
    .nullable()
    .optional(),

  email: z
    .string()
    .email("Email non valida")
    .toLowerCase()
    .nullable()
    .optional(),

  sito_web: z
    .string()
    .nullable()
    .optional()
    .transform((url) => {
      if (!url) return null;
      try {
        const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
        return `${parsed.protocol}//${parsed.hostname}`;
      } catch {
        return null;
      }
    }),

  indirizzo: z.string().nullable().optional(),
  citta: z.string().nullable().optional(),
  provincia: z.string().nullable().optional(),
  cap: z.string().nullable().optional(),
  regione: z.string().nullable().optional(),
  note: z.string().nullable().optional(),

  google_rating: z.number().min(0).max(5).nullable().optional(),
  google_reviews_count: z.number().min(0).default(0).optional(),

  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),

  google_categories: z.array(z.string()).optional(),
  linkedin_url: z.string().nullable().optional(),
  facebook_url: z.string().nullable().optional(),
  instagram_url: z.string().nullable().optional(),

  fonte: z
    .enum(["google_maps", "csv_import", "manuale", "web_scrape"])
    .default("manuale"),
  stato: z
    .enum([
      "nuovo",
      "da_contattare",
      "contattato",
      "risposto",
      "non_interessato",
      "cliente",
    ])
    .default("nuovo"),
});

export type ContactImport = z.infer<typeof contactImportSchema>;

/**
 * Validate a batch of contacts, separating valid from invalid.
 */
export function validateContactBatch(
  rows: Record<string, unknown>[]
): { valid: ContactImport[]; invalid: { row: Record<string, unknown>; errors: string }[] } {
  const valid: ContactImport[] = [];
  const invalid: { row: Record<string, unknown>; errors: string }[] = [];

  for (const row of rows) {
    const result = contactImportSchema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
    } else {
      invalid.push({
        row,
        errors: result.error.issues.map((i) => i.message).join(", "),
      });
    }
  }

  return { valid, invalid };
}
