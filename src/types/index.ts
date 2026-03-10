export type ContactStato = 'nuovo' | 'da_contattare' | 'contattato' | 'risposto' | 'non_interessato' | 'cliente';
export type ContactFonte = 'google_maps' | 'csv_import' | 'manuale' | 'web_scrape';
export type ScrapingSessionTipo = 'google_maps' | 'website';
export type ScrapingSessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';
export type ScrapingJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
export type CampaignTipo = 'email' | 'sms' | 'whatsapp';
export type CampaignStato = 'bozza' | 'schedulata' | 'in_corso' | 'completata' | 'pausa' | 'errore';
export type CampaignRecipientStato = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'bounced' | 'unsubscribed';
export type ActivityTipo = 'email_inviata' | 'sms_inviato' | 'whatsapp_inviato' | 'nota' | 'stato_cambiato' | 'importato';
export type ListTipo = 'statica' | 'dinamica';
export type SettingCategoria = 'api_keys' | 'limiti' | 'scraping' | 'mittenti';

export interface Contact {
  id: string;
  nome: string | null;
  cognome: string | null;
  azienda: string;
  telefono: string | null;
  telefono_normalizzato: string | null;
  email: string | null;
  email_confidence: number;
  email_valid: boolean;
  sito_web: string | null;
  indirizzo: string | null;
  citta: string | null;
  provincia: string | null;
  cap: string | null;
  regione: string | null;
  lat: number | null;
  lng: number | null;
  google_maps_place_id: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  google_categories: string[];
  linkedin_url: string | null;
  facebook_url: string | null;
  instagram_url: string | null;
  fonte: ContactFonte;
  stato: ContactStato;
  tags: string[];
  note: string | null;
  ultima_attivita: string | null;
  scraping_session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScrapingSession {
  id: string;
  tipo: ScrapingSessionTipo;
  query: string | null;
  citta: string | null;
  raggio: number | null;
  max_results: number | null;
  status: ScrapingSessionStatus;
  totale_trovati: number;
  totale_importati: number;
  totale_errori: number;
  progress_percent: number;
  n8n_webhook_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ScrapingJob {
  id: string;
  session_id: string;
  contact_id: string;
  url: string;
  status: ScrapingJobStatus;
  emails_found: string[];
  phones_found: string[];
  social_found: Record<string, string>;
  tentativo: number;
  error_message: string | null;
  processing_time_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  nome: string;
  tipo: CampaignTipo;
  stato: CampaignStato;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  template_whatsapp_id: string | null;
  provider: string | null;
  sender_email: string | null;
  sender_name: string | null;
  reply_to: string | null;
  totale_destinatari: number;
  inviati: number;
  consegnati: number;
  aperti: number;
  cliccati: number;
  errori: number;
  costo_stimato_eur: number;
  costo_reale_eur: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  n8n_webhook_id: string | null;
  sending_rate_per_hour: number;
  created_at: string;
}

export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  contact_id: string;
  stato: CampaignRecipientStato;
  canale_id: string | null;
  inviato_at: string | null;
  errore: string | null;
}

export interface ContactActivity {
  id: string;
  contact_id: string;
  tipo: ActivityTipo;
  campaign_id: string | null;
  descrizione: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AppSetting {
  id: string;
  chiave: string;
  valore: string | null;
  tipo: string;
  categoria: SettingCategoria | null;
  updated_at: string;
}

export interface UsageLog {
  id: string;
  tipo: string;
  provider: string | null;
  campaign_id: string | null;
  quantita: number;
  costo_unitario_eur: number | null;
  costo_totale_eur: number | null;
  created_at: string;
}

export interface ContactList {
  id: string;
  nome: string;
  descrizione: string | null;
  filtri: Record<string, unknown>;
  tipo: ListTipo;
  totale_contatti: number;
  created_at: string;
}

export interface ContactFilters {
  search?: string;
  stato?: ContactStato[];
  fonte?: ContactFonte[];
  citta?: string[];
  tags?: string[];
  hasEmail?: boolean;
  hasTelefono?: boolean;
  dateFrom?: string;
  dateTo?: string;
}
