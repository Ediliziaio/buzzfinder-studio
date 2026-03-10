import { supabase } from "@/integrations/supabase/client";
import type { WizardData } from "@/components/campaigns/CampaignWizard";

/**
 * Filter contacts query by campaign channel type
 */
export function applyChannelFilter(query: any, tipo: string) {
  if (tipo === "email") {
    return query.not("email", "is", null);
  } else if (tipo === "sms" || tipo === "whatsapp") {
    return query.not("telefono", "is", null);
  }
  return query;
}

/**
 * Apply dynamic list filters to a contacts query
 */
export function applyDynamicFilters(query: any, filtri: Record<string, unknown>) {
  if (Array.isArray(filtri.stato) && filtri.stato.length > 0) {
    query = query.in("stato", filtri.stato);
  }
  if (Array.isArray(filtri.fonte) && filtri.fonte.length > 0) {
    query = query.in("fonte", filtri.fonte);
  }
  if (Array.isArray(filtri.citta) && filtri.citta.length > 0) {
    query = query.in("citta", filtri.citta);
  }
  if (typeof filtri.citta === "string" && filtri.citta) {
    query = query.eq("citta", filtri.citta);
  }
  if (filtri.hasEmail) {
    query = query.not("email", "is", null);
  }
  if (filtri.hasTelefono) {
    query = query.not("telefono", "is", null);
  }
  return query;
}

/**
 * Populate campaign_recipients after campaign creation.
 * Resolves contact IDs based on recipientSource and inserts in chunks.
 */
export async function populateCampaignRecipients(
  campaignId: string,
  wizardData: WizardData
): Promise<number> {
  let contactIds: string[] = [];

  if (wizardData.recipientSource === "list" && wizardData.selectedListId) {
    // Check if list is dynamic
    const { data: listData } = await supabase
      .from("lists")
      .select("tipo, filtri")
      .eq("id", wizardData.selectedListId)
      .single();

    if (listData?.tipo === "dinamica") {
      // Dynamic list: apply saved filters + channel filter
      let q = supabase.from("contacts").select("id");
      const filtri = (listData.filtri || {}) as Record<string, unknown>;
      q = applyDynamicFilters(q, filtri);
      q = applyChannelFilter(q, wizardData.tipo);
      const { data: contacts } = await q;
      contactIds = (contacts || []).map((c: any) => c.id);
    } else {
      // Static list: get contact IDs from join table
      const { data: lcData } = await supabase
        .from("list_contacts")
        .select("contact_id")
        .eq("list_id", wizardData.selectedListId);
      const ids = (lcData || []).map((r: any) => r.contact_id as string);

      if (ids.length > 0) {
        let q = supabase.from("contacts").select("id").in("id", ids);
        q = applyChannelFilter(q, wizardData.tipo);
        const { data: contacts } = await q;
        contactIds = (contacts || []).map((c: any) => c.id);
      }
    }
  } else if (wizardData.recipientSource === "filter") {
    let q = supabase.from("contacts").select("id");
    if (wizardData.filterStato.length > 0) {
      q = q.in("stato", wizardData.filterStato);
    }
    q = applyChannelFilter(q, wizardData.tipo);
    if (wizardData.filterHasEmail) q = q.not("email", "is", null);
    if (wizardData.filterHasTelefono) q = q.not("telefono", "is", null);
    const { data: contacts } = await q;
    contactIds = (contacts || []).map((c: any) => c.id);
  } else {
    // "all"
    let q = supabase.from("contacts").select("id");
    q = applyChannelFilter(q, wizardData.tipo);
    const { data: contacts } = await q;
    contactIds = (contacts || []).map((c: any) => c.id);
  }

  // Insert in chunks of 500
  const CHUNK = 500;
  for (let i = 0; i < contactIds.length; i += CHUNK) {
    const chunk = contactIds.slice(i, i + CHUNK);
    const rows = chunk.map((contactId) => ({
      campaign_id: campaignId,
      contact_id: contactId,
      stato: "pending",
    }));
    const { error } = await supabase.from("campaign_recipients").insert(rows);
    if (error) throw error;
  }

  return contactIds.length;
}

/**
 * Convert HTML to plain text for email body_text
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * GSM-7 character set check for SMS encoding detection
 */
const GSM7_CHARS = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ !\"#¤%&'()*+,-./:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "ÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà0123456789{}"
);

export function isGsm7Only(text: string): boolean {
  return [...text].every((ch) => GSM7_CHARS.has(ch));
}

export function getSmsInfo(text: string) {
  const isGsm7 = isGsm7Only(text);
  const maxSingle = isGsm7 ? 160 : 70;
  const maxConcat = isGsm7 ? 153 : 67;
  const len = text.length;
  const smsCount = len === 0 ? 0 : len <= maxSingle ? 1 : Math.ceil(len / maxConcat);
  return { isGsm7, maxSingle, maxConcat, smsCount, len };
}
