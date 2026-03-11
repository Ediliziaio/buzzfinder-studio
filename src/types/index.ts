// ── Enums / Union Types ──────────────────────────────────────────────
export type ContactStato = 'nuovo' | 'da_contattare' | 'contattato' | 'risposto' | 'non_interessato' | 'cliente';
export type ContactFonte = 'google_maps' | 'csv_import' | 'manuale' | 'web_scrape';
export type ScrapingSessionTipo = 'google_maps' | 'website';
export type ScrapingSessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';
export type ScrapingJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
export type CampaignTipo = 'email' | 'sms' | 'whatsapp';
export type CampaignStato = 'bozza' | 'schedulata' | 'in_corso' | 'completata' | 'pausa' | 'errore' | 'archiviata';
export type CampaignTipoCampagna = 'blast' | 'sequence' | 'drip';
export type CampaignRecipientStato = 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'failed' | 'bounced' | 'unsubscribed';
export type ActivityTipo = 'email_inviata' | 'email_aperta' | 'sms_inviato' | 'whatsapp_inviato' | 'nota' | 'stato_cambiato' | 'importato';
export type ListTipo = 'statica' | 'dinamica';
export type SettingCategoria = 'api_keys' | 'limiti' | 'scraping' | 'mittenti';
export type EmailEventTipo = 'open' | 'click' | 'bounce' | 'spam' | 'unsubscribe' | 'delivered';
export type PipelineStageType = 'interessato' | 'richiesta_info' | 'meeting_fissato' | 'proposta_inviata' | 'vinto' | 'perso';

// ── Contact ──────────────────────────────────────────────────────────
export interface Contact {
  id: string;
  nome: string | null;
  cognome: string | null;
  ruolo?: string | null;
  azienda: string;
  telefono: string | null;
  telefono_normalizzato: string | null;
  email: string | null;
  email_confidence: number;
  email_valid: boolean;
  email_quality: 'valid' | 'risky' | 'invalid' | null;
  email_validato?: boolean;
  email_validato_at?: string | null;
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
  fonte_dettaglio?: string | null;
  stato: ContactStato;
  tags: string[];
  note: string | null;
  ultima_attivita: string | null;
  scraping_session_id: string | null;
  ai_intro?: string | null;
  ai_personalizzato_at?: string | null;
  ai_modello?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Scraping ─────────────────────────────────────────────────────────
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
  paused_at: string | null;
  resumed_at: string | null;
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

// ── Campaign ─────────────────────────────────────────────────────────
export interface Campaign {
  id: string;
  nome: string;
  descrizione: string | null;
  tipo: CampaignTipo;
  tipo_campagna: CampaignTipoCampagna;
  stato: CampaignStato;
  subject: string | null;
  subject_b: string | null;
  body_html: string | null;
  body_text: string | null;
  template_whatsapp_id: string | null;
  template_whatsapp_language: string;
  template_whatsapp_variables: unknown[];
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
  paused_at: string | null;
  stopped_at: string | null;
  n8n_webhook_id: string | null;
  sending_rate_per_hour: number;
  // Scheduling
  timezone: string;
  ora_inizio_invio: string;
  ora_fine_invio: string;
  solo_lavorativi: boolean;
  stop_su_risposta: boolean;
  // Tracking
  tracking_aperture: boolean;
  // A/B test
  ab_test_enabled: boolean;
  ab_test_split: number;
  ab_test_sample_size: number;
  ab_winner: string | null;
  ab_winner_selected_at: string | null;
  aperti_a: number;
  aperti_b: number;
  inviati_a: number;
  inviati_b: number;
  // AI personalization
  ai_personalization_enabled: boolean;
  ai_model: string | null;
  ai_context: string | null;
  ai_objective: string | null;
  ai_personalization_status: string;
  ai_personalization_processed: number;
  ai_personalization_total: number;
  ai_cost_eur: number;
  created_at: string;
}

// ── Campaign Step ────────────────────────────────────────────────────
export interface SequenceStep {
  id?: string;
  step_number: number;
  tipo: 'email' | 'whatsapp' | 'sms';
  delay_giorni: number;
  delay_ore: number;
  condizione: 'always' | 'if_no_reply' | 'if_no_open' | 'if_opened';
  soggetto?: string;
  corpo_html?: string;
  messaggio?: string;
  ab_padre_id?: string;
  ab_nome?: string;
  ab_peso: number;
}

export interface CampaignStep extends SequenceStep {
  id: string;
  campaign_id: string;
  stat_inviati: number;
  stat_aperti: number;
  stat_cliccati: number;
  stat_risposte: number;
  created_at: string;
}

// ── Campaign Step Execution ──────────────────────────────────────────
export interface CampaignStepExecution {
  id: string;
  campaign_id: string;
  step_id: string;
  recipient_id: string;
  sender_id: string | null;
  stato: 'scheduled' | 'sent' | 'skipped' | 'failed';
  scheduled_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  error: string | null;
  created_at: string;
}

// ── Campaign Recipient ───────────────────────────────────────────────
export interface CampaignRecipient {
  id: string;
  campaign_id: string;
  contact_id: string;
  stato: CampaignRecipientStato;
  canale_id: string | null;
  sender_id: string | null;
  inviato_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  triggered_at: string | null;
  errore: string | null;
  messaggio_personalizzato: string | null;
  soggetto_personalizzato: string | null;
}

// ── Contact Activity ─────────────────────────────────────────────────
export interface ContactActivity {
  id: string;
  contact_id: string;
  tipo: ActivityTipo;
  campaign_id: string | null;
  descrizione: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Settings / Usage ─────────────────────────────────────────────────
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

// ── Lists ────────────────────────────────────────────────────────────
export interface ContactList {
  id: string;
  nome: string;
  descrizione: string | null;
  filtri: Record<string, unknown>;
  tipo: ListTipo;
  totale_contatti: number;
  created_at: string;
}

// ── Sender Pool ──────────────────────────────────────────────────────
export interface SenderPool {
  id: string;
  user_id: string;
  nome: string;
  tipo: 'email' | 'whatsapp' | 'sms';
  attivo: boolean;
  stato: 'active' | 'warming' | 'paused' | 'banned';
  note?: string;
  email_from?: string;
  email_nome?: string;
  reply_to?: string;
  dominio?: string;
  resend_api_key?: string;
  spf_ok: boolean;
  dkim_ok: boolean;
  dmarc_ok: boolean;
  wa_phone_number_id?: string;
  wa_access_token?: string;
  wa_numero?: string;
  wa_tier: string;
  wa_quality: string;
  sms_from?: string;
  sms_provider: string;
  sms_api_key?: string;
  sms_api_secret?: string;
  max_per_day: number;
  inviati_oggi: number;
  ultimo_reset: string;
  bounce_rate: number;
  spam_rate: number;
  health_score: number;
  warmup_attivo: boolean;
  warmup_giorno: number;
  warmup_iniziato?: string;
  totale_inviati: number;
  totale_bounce: number;
  totale_spam: number;
  created_at: string;
  updated_at: string;
}

// ── Pipeline ─────────────────────────────────────────────────────────
export interface PipelineLead {
  id: string;
  user_id: string;
  contact_id: string;
  campaign_id: string | null;
  inbox_message_id: string | null;
  pipeline_stage: PipelineStageType;
  pipeline_note: string | null;
  valore_stimato: number;
  pipeline_updated: string;
  created_at: string;
}

// ── Inbox Message ────────────────────────────────────────────────────
export interface InboxMessage {
  id: string;
  user_id: string;
  campaign_id: string | null;
  recipient_id: string | null;
  execution_id: string | null;
  canale: 'email' | 'whatsapp' | 'sms';
  da_nome: string | null;
  da_email: string | null;
  da_telefono: string | null;
  oggetto: string | null;
  corpo: string;
  corpo_html: string | null;
  data_ricezione: string;
  letto: boolean;
  archiviato: boolean;
  assegnato_a: string | null;
  etichetta: string;
  etichetta_ai: boolean;
  note: string | null;
  thread_id: string | null;
  created_at: string;
}

// ── Suppression / Unsubscribe ────────────────────────────────────────
export interface Unsubscribe {
  id: string;
  email: string;
  motivo: string | null;
  campaign_id: string | null;
  user_id: string | null;
  created_at: string;
}

// ── Blacklist Check ──────────────────────────────────────────────────
export interface BlacklistCheck {
  id: string;
  sender_id: string | null;
  user_id: string;
  dominio: string;
  in_blacklist: boolean;
  blacklists: string[];
  checked_at: string;
}

// ── Campaign Template ────────────────────────────────────────────────
export interface CampaignTemplate {
  id: string;
  user_id: string;
  nome: string;
  tipo: CampaignTipo;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  template_whatsapp_id: string | null;
  template_whatsapp_language: string;
  template_whatsapp_variables: unknown[];
  sender_email: string | null;
  sender_name: string | null;
  reply_to: string | null;
  sending_rate_per_hour: number;
  ai_personalization_enabled: boolean;
  ai_model: string | null;
  ai_context: string | null;
  ai_objective: string | null;
  utilizzi: number;
  created_at: string;
}

// ── Follow-Up Sequences ──────────────────────────────────────────────
export interface FollowUpSequence {
  id: string;
  campaign_id: string;
  user_id: string | null;
  nome: string;
  attiva: boolean;
  created_at: string;
}

export interface FollowUpStep {
  id: string;
  sequence_id: string;
  ordine: number;
  delay_giorni: number;
  condizione: string;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  created_at: string;
}

export interface FollowUpLog {
  id: string;
  step_id: string;
  recipient_id: string;
  stato: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
}

// ── Campaign Analytics (aggregated view) ─────────────────────────────
export interface CampaignAnalytics {
  id: string;
  nome: string;
  stato: string;
  inviati: number;
  aperti: number;
  cliccati: number;
  errori: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

// ── Filters ──────────────────────────────────────────────────────────
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
