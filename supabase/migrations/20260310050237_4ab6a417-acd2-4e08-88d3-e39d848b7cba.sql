-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT,
  cognome TEXT,
  azienda TEXT NOT NULL,
  telefono TEXT,
  telefono_normalizzato TEXT,
  email TEXT,
  email_confidence INTEGER DEFAULT 0,
  email_valid BOOLEAN DEFAULT false,
  sito_web TEXT,
  indirizzo TEXT,
  citta TEXT,
  provincia TEXT,
  cap TEXT,
  regione TEXT,
  lat DECIMAL(10,8),
  lng DECIMAL(11,8),
  google_maps_place_id TEXT UNIQUE,
  google_rating DECIMAL(2,1),
  google_reviews_count INTEGER,
  google_categories TEXT[] DEFAULT '{}',
  linkedin_url TEXT,
  facebook_url TEXT,
  instagram_url TEXT,
  fonte TEXT DEFAULT 'manuale',
  stato TEXT DEFAULT 'nuovo',
  tags TEXT[] DEFAULT '{}',
  note TEXT,
  ultima_attivita TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scraping Sessions
CREATE TABLE public.scraping_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  query TEXT,
  citta TEXT,
  raggio INTEGER,
  max_results INTEGER,
  status TEXT DEFAULT 'pending',
  totale_trovati INTEGER DEFAULT 0,
  totale_importati INTEGER DEFAULT 0,
  totale_errori INTEGER DEFAULT 0,
  progress_percent INTEGER DEFAULT 0,
  n8n_webhook_id TEXT,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scraping Jobs
CREATE TABLE public.scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.scraping_sessions(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  emails_found TEXT[] DEFAULT '{}',
  phones_found TEXT[] DEFAULT '{}',
  social_found JSONB DEFAULT '{}',
  tentativo INTEGER DEFAULT 1,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaigns
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  stato TEXT DEFAULT 'bozza',
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  template_whatsapp_id TEXT,
  provider TEXT,
  sender_email TEXT,
  sender_name TEXT,
  reply_to TEXT,
  totale_destinatari INTEGER DEFAULT 0,
  inviati INTEGER DEFAULT 0,
  consegnati INTEGER DEFAULT 0,
  aperti INTEGER DEFAULT 0,
  cliccati INTEGER DEFAULT 0,
  errori INTEGER DEFAULT 0,
  costo_stimato_eur DECIMAL(10,4) DEFAULT 0,
  costo_reale_eur DECIMAL(10,4) DEFAULT 0,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  n8n_webhook_id TEXT,
  sending_rate_per_hour INTEGER DEFAULT 500,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Recipients
CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  stato TEXT DEFAULT 'pending',
  canale_id TEXT,
  inviato_at TIMESTAMP WITH TIME ZONE,
  errore TEXT,
  UNIQUE(campaign_id, contact_id)
);

-- Contact Activities
CREATE TABLE public.contact_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id),
  descrizione TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- App Settings
CREATE TABLE public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chiave TEXT UNIQUE NOT NULL,
  valore TEXT,
  tipo TEXT DEFAULT 'string',
  categoria TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage Log
CREATE TABLE public.usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  provider TEXT,
  campaign_id UUID REFERENCES public.campaigns(id),
  quantita INTEGER DEFAULT 1,
  costo_unitario_eur DECIMAL(10,6),
  costo_totale_eur DECIMAL(10,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lists
CREATE TABLE public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descrizione TEXT,
  filtri JSONB DEFAULT '{}',
  tipo TEXT DEFAULT 'statica',
  totale_contatti INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.list_contacts (
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  PRIMARY KEY (list_id, contact_id)
);

-- Performance indexes
CREATE INDEX idx_contacts_stato ON public.contacts(stato);
CREATE INDEX idx_contacts_fonte ON public.contacts(fonte);
CREATE INDEX idx_contacts_citta ON public.contacts(citta);
CREATE INDEX idx_contacts_tags ON public.contacts USING GIN(tags);
CREATE INDEX idx_contacts_email ON public.contacts(email) WHERE email IS NOT NULL;
CREATE INDEX idx_contacts_created ON public.contacts(created_at DESC);
CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_stato ON public.campaign_recipients(stato);
CREATE INDEX idx_contact_activities_contact ON public.contact_activities(contact_id, created_at DESC);
CREATE INDEX idx_usage_log_created ON public.usage_log(created_at DESC);
CREATE INDEX idx_usage_log_tipo ON public.usage_log(tipo, created_at DESC);

-- Enable RLS on all tables
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies: authenticated users have full access (single-tenant internal tool)
CREATE POLICY "Authenticated full access" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.scraping_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.scraping_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.campaigns FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.campaign_recipients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.contact_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.usage_log FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.lists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated full access" ON public.list_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.scraping_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scraping_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.campaigns;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scraping_jobs_updated_at BEFORE UPDATE ON public.scraping_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();