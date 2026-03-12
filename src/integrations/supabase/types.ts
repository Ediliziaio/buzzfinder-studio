export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          categoria: string | null
          chiave: string
          id: string
          tipo: string | null
          updated_at: string | null
          user_id: string | null
          valore: string | null
        }
        Insert: {
          categoria?: string | null
          chiave: string
          id?: string
          tipo?: string | null
          updated_at?: string | null
          user_id?: string | null
          valore?: string | null
        }
        Update: {
          categoria?: string | null
          chiave?: string
          id?: string
          tipo?: string | null
          updated_at?: string | null
          user_id?: string | null
          valore?: string | null
        }
        Relationships: []
      }
      automation_executions: {
        Row: {
          azione_risultato: Json | null
          campaign_id: string | null
          completato_at: string | null
          contact_id: string
          created_at: string
          error_message: string | null
          id: string
          rule_id: string
          stato: string
          trigger_contesto: Json | null
          user_id: string
        }
        Insert: {
          azione_risultato?: Json | null
          campaign_id?: string | null
          completato_at?: string | null
          contact_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          rule_id: string
          stato?: string
          trigger_contesto?: Json | null
          user_id: string
        }
        Update: {
          azione_risultato?: Json | null
          campaign_id?: string | null
          completato_at?: string | null
          contact_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          rule_id?: string
          stato?: string
          trigger_contesto?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "automation_executions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          attiva: boolean
          azione_params: Json
          azione_tipo: string
          campaign_id: string | null
          condizioni: Json
          cooldown_ore: number | null
          created_at: string
          descrizione: string | null
          id: string
          max_esecuzioni_per_contatto: number | null
          nome: string
          trigger_params: Json
          trigger_tipo: string
          ultima_esecuzione: string | null
          updated_at: string
          user_id: string
          volte_eseguita: number
        }
        Insert: {
          attiva?: boolean
          azione_params?: Json
          azione_tipo: string
          campaign_id?: string | null
          condizioni?: Json
          cooldown_ore?: number | null
          created_at?: string
          descrizione?: string | null
          id?: string
          max_esecuzioni_per_contatto?: number | null
          nome: string
          trigger_params?: Json
          trigger_tipo: string
          ultima_esecuzione?: string | null
          updated_at?: string
          user_id: string
          volte_eseguita?: number
        }
        Update: {
          attiva?: boolean
          azione_params?: Json
          azione_tipo?: string
          campaign_id?: string | null
          condizioni?: Json
          cooldown_ore?: number | null
          created_at?: string
          descrizione?: string | null
          id?: string
          max_esecuzioni_per_contatto?: number | null
          nome?: string
          trigger_params?: Json
          trigger_tipo?: string
          ultima_esecuzione?: string | null
          updated_at?: string
          user_id?: string
          volte_eseguita?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "automation_rules_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      blacklist_checks: {
        Row: {
          blacklists: string[]
          checked_at: string
          dominio: string
          id: string
          in_blacklist: boolean
          sender_id: string | null
          user_id: string
        }
        Insert: {
          blacklists?: string[]
          checked_at?: string
          dominio: string
          id?: string
          in_blacklist?: boolean
          sender_id?: string | null
          user_id: string
        }
        Update: {
          blacklists?: string[]
          checked_at?: string
          dominio?: string
          id?: string
          in_blacklist?: boolean
          sender_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blacklist_checks_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "sender_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          agent_id: string
          automation_rule_id: string | null
          campaign_id: string | null
          contact_id: string
          costo_eur: number | null
          created_at: string
          data_richiamo: string | null
          durata_secondi: number | null
          elevenlabs_call_id: string | null
          ended_at: string | null
          error_message: string | null
          esito: string | null
          execution_id: string | null
          id: string
          minuti_fatturati: number | null
          note_ai: string | null
          phone_number_from: string | null
          phone_number_to: string
          recipient_id: string | null
          recording_url: string | null
          riassunto_ai: string | null
          scheduled_at: string | null
          sentiment: string | null
          started_at: string | null
          stato: string
          trascrizione: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          automation_rule_id?: string | null
          campaign_id?: string | null
          contact_id: string
          costo_eur?: number | null
          created_at?: string
          data_richiamo?: string | null
          durata_secondi?: number | null
          elevenlabs_call_id?: string | null
          ended_at?: string | null
          error_message?: string | null
          esito?: string | null
          execution_id?: string | null
          id?: string
          minuti_fatturati?: number | null
          note_ai?: string | null
          phone_number_from?: string | null
          phone_number_to: string
          recipient_id?: string | null
          recording_url?: string | null
          riassunto_ai?: string | null
          scheduled_at?: string | null
          sentiment?: string | null
          started_at?: string | null
          stato?: string
          trascrizione?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          automation_rule_id?: string | null
          campaign_id?: string | null
          contact_id?: string
          costo_eur?: number | null
          created_at?: string
          data_richiamo?: string | null
          durata_secondi?: number | null
          elevenlabs_call_id?: string | null
          ended_at?: string | null
          error_message?: string | null
          esito?: string | null
          execution_id?: string | null
          id?: string
          minuti_fatturati?: number | null
          note_ai?: string | null
          phone_number_from?: string | null
          phone_number_to?: string
          recipient_id?: string | null
          recording_url?: string | null
          riassunto_ai?: string | null
          scheduled_at?: string | null
          sentiment?: string | null
          started_at?: string | null
          stato?: string
          trascrizione?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "call_sessions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "campaign_step_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_sessions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_call_sessions_automation"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string | null
          canale_id: string | null
          clicked_at: string | null
          contact_id: string | null
          errore: string | null
          id: string
          inviato_at: string | null
          messaggio_personalizzato: string | null
          opened_at: string | null
          pipeline_note: string | null
          pipeline_stage: string | null
          pipeline_updated: string | null
          risposta_at: string | null
          sender_id: string | null
          soggetto_personalizzato: string | null
          stato: string | null
          triggered_at: string | null
        }
        Insert: {
          campaign_id?: string | null
          canale_id?: string | null
          clicked_at?: string | null
          contact_id?: string | null
          errore?: string | null
          id?: string
          inviato_at?: string | null
          messaggio_personalizzato?: string | null
          opened_at?: string | null
          pipeline_note?: string | null
          pipeline_stage?: string | null
          pipeline_updated?: string | null
          risposta_at?: string | null
          sender_id?: string | null
          soggetto_personalizzato?: string | null
          stato?: string | null
          triggered_at?: string | null
        }
        Update: {
          campaign_id?: string | null
          canale_id?: string | null
          clicked_at?: string | null
          contact_id?: string | null
          errore?: string | null
          id?: string
          inviato_at?: string | null
          messaggio_personalizzato?: string | null
          opened_at?: string | null
          pipeline_note?: string | null
          pipeline_stage?: string | null
          pipeline_updated?: string | null
          risposta_at?: string | null
          sender_id?: string | null
          soggetto_personalizzato?: string | null
          stato?: string | null
          triggered_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "sender_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_step_executions: {
        Row: {
          campaign_id: string
          clicked_at: string | null
          created_at: string
          error: string | null
          id: string
          opened_at: string | null
          recipient_id: string
          replied_at: string | null
          scheduled_at: string | null
          sender_id: string | null
          sent_at: string | null
          stato: string
          step_id: string
        }
        Insert: {
          campaign_id: string
          clicked_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          opened_at?: string | null
          recipient_id: string
          replied_at?: string | null
          scheduled_at?: string | null
          sender_id?: string | null
          sent_at?: string | null
          stato?: string
          step_id: string
        }
        Update: {
          campaign_id?: string
          clicked_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          opened_at?: string | null
          recipient_id?: string
          replied_at?: string | null
          scheduled_at?: string | null
          sender_id?: string | null
          sent_at?: string | null
          stato?: string
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_step_executions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_step_executions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_step_executions_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_step_executions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "sender_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_step_executions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "campaign_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_steps: {
        Row: {
          ab_nome: string | null
          ab_padre_id: string | null
          ab_peso: number
          campaign_id: string
          chiamata_obiettivo: string | null
          chiamata_script: string | null
          condizione: string
          corpo_html: string | null
          created_at: string
          delay_giorni: number
          delay_ore: number
          elevenlabs_agent_id: string | null
          id: string
          max_tentativi_chiamata: number | null
          messaggio: string | null
          soggetto: string | null
          stat_aperti: number
          stat_cliccati: number
          stat_inviati: number
          stat_risposte: number
          step_number: number
          tipo: string
        }
        Insert: {
          ab_nome?: string | null
          ab_padre_id?: string | null
          ab_peso?: number
          campaign_id: string
          chiamata_obiettivo?: string | null
          chiamata_script?: string | null
          condizione?: string
          corpo_html?: string | null
          created_at?: string
          delay_giorni?: number
          delay_ore?: number
          elevenlabs_agent_id?: string | null
          id?: string
          max_tentativi_chiamata?: number | null
          messaggio?: string | null
          soggetto?: string | null
          stat_aperti?: number
          stat_cliccati?: number
          stat_inviati?: number
          stat_risposte?: number
          step_number?: number
          tipo?: string
        }
        Update: {
          ab_nome?: string | null
          ab_padre_id?: string | null
          ab_peso?: number
          campaign_id?: string
          chiamata_obiettivo?: string | null
          chiamata_script?: string | null
          condizione?: string
          corpo_html?: string | null
          created_at?: string
          delay_giorni?: number
          delay_ore?: number
          elevenlabs_agent_id?: string | null
          id?: string
          max_tentativi_chiamata?: number | null
          messaggio?: string | null
          soggetto?: string | null
          stat_aperti?: number
          stat_cliccati?: number
          stat_inviati?: number
          stat_risposte?: number
          step_number?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_steps_ab_padre_id_fkey"
            columns: ["ab_padre_id"]
            isOneToOne: false
            referencedRelation: "campaign_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_templates: {
        Row: {
          ai_context: string | null
          ai_model: string | null
          ai_objective: string | null
          ai_personalization_enabled: boolean | null
          body_html: string | null
          body_text: string | null
          created_at: string | null
          id: string
          nome: string
          reply_to: string | null
          sender_email: string | null
          sender_name: string | null
          sending_rate_per_hour: number | null
          subject: string | null
          template_whatsapp_id: string | null
          template_whatsapp_language: string | null
          template_whatsapp_variables: Json | null
          tipo: string
          user_id: string
          utilizzi: number | null
        }
        Insert: {
          ai_context?: string | null
          ai_model?: string | null
          ai_objective?: string | null
          ai_personalization_enabled?: boolean | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          id?: string
          nome: string
          reply_to?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sending_rate_per_hour?: number | null
          subject?: string | null
          template_whatsapp_id?: string | null
          template_whatsapp_language?: string | null
          template_whatsapp_variables?: Json | null
          tipo: string
          user_id: string
          utilizzi?: number | null
        }
        Update: {
          ai_context?: string | null
          ai_model?: string | null
          ai_objective?: string | null
          ai_personalization_enabled?: boolean | null
          body_html?: string | null
          body_text?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          reply_to?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sending_rate_per_hour?: number | null
          subject?: string | null
          template_whatsapp_id?: string | null
          template_whatsapp_language?: string | null
          template_whatsapp_variables?: Json | null
          tipo?: string
          user_id?: string
          utilizzi?: number | null
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          ab_test_enabled: boolean | null
          ab_test_sample_size: number | null
          ab_test_split: number | null
          ab_winner: string | null
          ab_winner_selected_at: string | null
          ai_context: string | null
          ai_cost_eur: number | null
          ai_model: string | null
          ai_objective: string | null
          ai_personalization_enabled: boolean | null
          ai_personalization_processed: number | null
          ai_personalization_status: string | null
          ai_personalization_total: number | null
          aperti: number | null
          aperti_a: number | null
          aperti_b: number | null
          body_html: string | null
          body_text: string | null
          cliccati: number | null
          completed_at: string | null
          consegnati: number | null
          costo_reale_eur: number | null
          costo_stimato_eur: number | null
          created_at: string | null
          custom_tracking_domain: string | null
          errori: number | null
          id: string
          inviati: number | null
          inviati_a: number | null
          inviati_b: number | null
          n8n_webhook_id: string | null
          nome: string
          ora_fine_invio: string
          ora_inizio_invio: string
          paused_at: string | null
          provider: string | null
          reply_to: string | null
          scheduled_at: string | null
          sender_email: string | null
          sender_name: string | null
          sending_rate_per_hour: number | null
          solo_lavorativi: boolean
          started_at: string | null
          stato: string | null
          stop_su_disiscrizione: boolean | null
          stop_su_risposta: boolean
          stopped_at: string | null
          subject: string | null
          subject_b: string | null
          template_whatsapp_id: string | null
          template_whatsapp_language: string | null
          template_whatsapp_variables: Json | null
          timezone: string
          tipo: string
          tipo_campagna: string
          totale_destinatari: number | null
          tracking_aperture: boolean
          tracking_click: boolean | null
          user_id: string | null
        }
        Insert: {
          ab_test_enabled?: boolean | null
          ab_test_sample_size?: number | null
          ab_test_split?: number | null
          ab_winner?: string | null
          ab_winner_selected_at?: string | null
          ai_context?: string | null
          ai_cost_eur?: number | null
          ai_model?: string | null
          ai_objective?: string | null
          ai_personalization_enabled?: boolean | null
          ai_personalization_processed?: number | null
          ai_personalization_status?: string | null
          ai_personalization_total?: number | null
          aperti?: number | null
          aperti_a?: number | null
          aperti_b?: number | null
          body_html?: string | null
          body_text?: string | null
          cliccati?: number | null
          completed_at?: string | null
          consegnati?: number | null
          costo_reale_eur?: number | null
          costo_stimato_eur?: number | null
          created_at?: string | null
          custom_tracking_domain?: string | null
          errori?: number | null
          id?: string
          inviati?: number | null
          inviati_a?: number | null
          inviati_b?: number | null
          n8n_webhook_id?: string | null
          nome: string
          ora_fine_invio?: string
          ora_inizio_invio?: string
          paused_at?: string | null
          provider?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sending_rate_per_hour?: number | null
          solo_lavorativi?: boolean
          started_at?: string | null
          stato?: string | null
          stop_su_disiscrizione?: boolean | null
          stop_su_risposta?: boolean
          stopped_at?: string | null
          subject?: string | null
          subject_b?: string | null
          template_whatsapp_id?: string | null
          template_whatsapp_language?: string | null
          template_whatsapp_variables?: Json | null
          timezone?: string
          tipo: string
          tipo_campagna?: string
          totale_destinatari?: number | null
          tracking_aperture?: boolean
          tracking_click?: boolean | null
          user_id?: string | null
        }
        Update: {
          ab_test_enabled?: boolean | null
          ab_test_sample_size?: number | null
          ab_test_split?: number | null
          ab_winner?: string | null
          ab_winner_selected_at?: string | null
          ai_context?: string | null
          ai_cost_eur?: number | null
          ai_model?: string | null
          ai_objective?: string | null
          ai_personalization_enabled?: boolean | null
          ai_personalization_processed?: number | null
          ai_personalization_status?: string | null
          ai_personalization_total?: number | null
          aperti?: number | null
          aperti_a?: number | null
          aperti_b?: number | null
          body_html?: string | null
          body_text?: string | null
          cliccati?: number | null
          completed_at?: string | null
          consegnati?: number | null
          costo_reale_eur?: number | null
          costo_stimato_eur?: number | null
          created_at?: string | null
          custom_tracking_domain?: string | null
          errori?: number | null
          id?: string
          inviati?: number | null
          inviati_a?: number | null
          inviati_b?: number | null
          n8n_webhook_id?: string | null
          nome?: string
          ora_fine_invio?: string
          ora_inizio_invio?: string
          paused_at?: string | null
          provider?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sending_rate_per_hour?: number | null
          solo_lavorativi?: boolean
          started_at?: string | null
          stato?: string | null
          stop_su_disiscrizione?: boolean | null
          stop_su_risposta?: boolean
          stopped_at?: string | null
          subject?: string | null
          subject_b?: string | null
          template_whatsapp_id?: string | null
          template_whatsapp_language?: string | null
          template_whatsapp_variables?: Json | null
          timezone?: string
          tipo?: string
          tipo_campagna?: string
          totale_destinatari?: number | null
          tracking_aperture?: boolean
          tracking_click?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      contact_activities: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          created_at: string | null
          descrizione: string | null
          id: string
          metadata: Json | null
          tipo: string
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          descrizione?: string | null
          id?: string
          metadata?: Json | null
          tipo: string
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string | null
          descrizione?: string | null
          id?: string
          metadata?: Json | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "contact_activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          ai_intro: string | null
          ai_modello: string | null
          ai_personalizzato_at: string | null
          azienda: string
          cap: string | null
          citta: string | null
          cognome: string | null
          created_at: string | null
          email: string | null
          email_confidence: number | null
          email_quality: string | null
          email_valid: boolean | null
          email_validato: boolean | null
          email_validato_at: string | null
          esito_ultima_chiamata: string | null
          facebook_url: string | null
          fonte: string | null
          google_categories: string[] | null
          google_maps_place_id: string | null
          google_rating: number | null
          google_reviews_count: number | null
          id: string
          indirizzo: string | null
          instagram_url: string | null
          lat: number | null
          linkedin_url: string | null
          lng: number | null
          nome: string | null
          note: string | null
          provincia: string | null
          regione: string | null
          scraping_session_id: string | null
          sito_web: string | null
          stato: string | null
          tags: string[] | null
          telefono: string | null
          telefono_chiamabile: boolean | null
          telefono_dnc: boolean | null
          telefono_normalizzato: string | null
          totale_chiamate: number | null
          ultima_attivita: string | null
          ultima_chiamata_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          ai_intro?: string | null
          ai_modello?: string | null
          ai_personalizzato_at?: string | null
          azienda: string
          cap?: string | null
          citta?: string | null
          cognome?: string | null
          created_at?: string | null
          email?: string | null
          email_confidence?: number | null
          email_quality?: string | null
          email_valid?: boolean | null
          email_validato?: boolean | null
          email_validato_at?: string | null
          esito_ultima_chiamata?: string | null
          facebook_url?: string | null
          fonte?: string | null
          google_categories?: string[] | null
          google_maps_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          id?: string
          indirizzo?: string | null
          instagram_url?: string | null
          lat?: number | null
          linkedin_url?: string | null
          lng?: number | null
          nome?: string | null
          note?: string | null
          provincia?: string | null
          regione?: string | null
          scraping_session_id?: string | null
          sito_web?: string | null
          stato?: string | null
          tags?: string[] | null
          telefono?: string | null
          telefono_chiamabile?: boolean | null
          telefono_dnc?: boolean | null
          telefono_normalizzato?: string | null
          totale_chiamate?: number | null
          ultima_attivita?: string | null
          ultima_chiamata_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          ai_intro?: string | null
          ai_modello?: string | null
          ai_personalizzato_at?: string | null
          azienda?: string
          cap?: string | null
          citta?: string | null
          cognome?: string | null
          created_at?: string | null
          email?: string | null
          email_confidence?: number | null
          email_quality?: string | null
          email_valid?: boolean | null
          email_validato?: boolean | null
          email_validato_at?: string | null
          esito_ultima_chiamata?: string | null
          facebook_url?: string | null
          fonte?: string | null
          google_categories?: string[] | null
          google_maps_place_id?: string | null
          google_rating?: number | null
          google_reviews_count?: number | null
          id?: string
          indirizzo?: string | null
          instagram_url?: string | null
          lat?: number | null
          linkedin_url?: string | null
          lng?: number | null
          nome?: string | null
          note?: string | null
          provincia?: string | null
          regione?: string | null
          scraping_session_id?: string | null
          sito_web?: string | null
          stato?: string | null
          tags?: string[] | null
          telefono?: string | null
          telefono_chiamabile?: boolean | null
          telefono_dnc?: boolean | null
          telefono_normalizzato?: string | null
          totale_chiamate?: number | null
          ultima_attivita?: string | null
          ultima_chiamata_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_scraping_session_id_fkey"
            columns: ["scraping_session_id"]
            isOneToOne: false
            referencedRelation: "scraping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          created_at: string | null
          execution_id: string
          id: string
          ip: string | null
          tipo: string
          url: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          execution_id: string
          id?: string
          ip?: string | null
          tipo: string
          url?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          execution_id?: string
          id?: string
          ip?: string | null
          tipo?: string
          url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_events_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "campaign_step_executions"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_log: {
        Row: {
          created_at: string | null
          id: string
          recipient_id: string
          scheduled_at: string | null
          sent_at: string | null
          stato: string | null
          step_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          recipient_id: string
          scheduled_at?: string | null
          sent_at?: string | null
          stato?: string | null
          step_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          recipient_id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          stato?: string | null
          step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_log_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_up_log_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "follow_up_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_sequences: {
        Row: {
          attiva: boolean | null
          campaign_id: string
          created_at: string | null
          id: string
          nome: string
          user_id: string | null
        }
        Insert: {
          attiva?: boolean | null
          campaign_id: string
          created_at?: string | null
          id?: string
          nome: string
          user_id?: string | null
        }
        Update: {
          attiva?: boolean | null
          campaign_id?: string
          created_at?: string | null
          id?: string
          nome?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "follow_up_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_up_steps: {
        Row: {
          body_html: string | null
          body_text: string | null
          condizione: string
          created_at: string | null
          delay_giorni: number
          id: string
          ordine: number
          sequence_id: string
          subject: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          condizione?: string
          created_at?: string | null
          delay_giorni?: number
          id?: string
          ordine?: number
          sequence_id: string
          subject?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          condizione?: string
          created_at?: string | null
          delay_giorni?: number
          id?: string
          ordine?: number
          sequence_id?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_up_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "follow_up_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          archiviato: boolean
          assegnato_a: string | null
          campaign_id: string | null
          canale: string
          corpo: string
          corpo_html: string | null
          created_at: string
          da_email: string | null
          da_nome: string | null
          da_telefono: string | null
          data_ricezione: string
          etichetta: string
          etichetta_ai: boolean
          execution_id: string | null
          id: string
          letto: boolean
          note: string | null
          oggetto: string | null
          recipient_id: string | null
          thread_id: string | null
          user_id: string
        }
        Insert: {
          archiviato?: boolean
          assegnato_a?: string | null
          campaign_id?: string | null
          canale?: string
          corpo?: string
          corpo_html?: string | null
          created_at?: string
          da_email?: string | null
          da_nome?: string | null
          da_telefono?: string | null
          data_ricezione?: string
          etichetta?: string
          etichetta_ai?: boolean
          execution_id?: string | null
          id?: string
          letto?: boolean
          note?: string | null
          oggetto?: string | null
          recipient_id?: string | null
          thread_id?: string | null
          user_id: string
        }
        Update: {
          archiviato?: boolean
          assegnato_a?: string | null
          campaign_id?: string | null
          canale?: string
          corpo?: string
          corpo_html?: string | null
          created_at?: string
          da_email?: string | null
          da_nome?: string | null
          da_telefono?: string | null
          data_ricezione?: string
          etichetta?: string
          etichetta_ai?: boolean
          execution_id?: string | null
          id?: string
          letto?: boolean
          note?: string | null
          oggetto?: string | null
          recipient_id?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "inbox_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "campaign_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      list_contacts: {
        Row: {
          contact_id: string
          list_id: string
        }
        Insert: {
          contact_id: string
          list_id: string
        }
        Update: {
          contact_id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string | null
          descrizione: string | null
          filtri: Json | null
          id: string
          nome: string
          tipo: string | null
          totale_contatti: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          descrizione?: string | null
          filtri?: Json | null
          id?: string
          nome: string
          tipo?: string | null
          totale_contatti?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          descrizione?: string | null
          filtri?: Json | null
          id?: string
          nome?: string
          tipo?: string | null
          totale_contatti?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      pipeline_leads: {
        Row: {
          campaign_id: string | null
          contact_id: string | null
          created_at: string
          id: string
          inbox_message_id: string | null
          pipeline_note: string | null
          pipeline_stage: string
          pipeline_updated: string
          user_id: string
          valore_stimato: number
        }
        Insert: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          inbox_message_id?: string | null
          pipeline_note?: string | null
          pipeline_stage?: string
          pipeline_updated?: string
          user_id: string
          valore_stimato?: number
        }
        Update: {
          campaign_id?: string | null
          contact_id?: string | null
          created_at?: string
          id?: string
          inbox_message_id?: string | null
          pipeline_note?: string | null
          pipeline_stage?: string
          pipeline_updated?: string
          user_id?: string
          valore_stimato?: number
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "pipeline_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_leads_inbox_message_id_fkey"
            columns: ["inbox_message_id"]
            isOneToOne: false
            referencedRelation: "inbox_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      scraping_jobs: {
        Row: {
          contact_id: string | null
          created_at: string | null
          emails_found: string[] | null
          error_message: string | null
          id: string
          phones_found: string[] | null
          processing_time_ms: number | null
          session_id: string | null
          social_found: Json | null
          status: string | null
          tentativo: number | null
          updated_at: string | null
          url: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string | null
          emails_found?: string[] | null
          error_message?: string | null
          id?: string
          phones_found?: string[] | null
          processing_time_ms?: number | null
          session_id?: string | null
          social_found?: Json | null
          status?: string | null
          tentativo?: number | null
          updated_at?: string | null
          url: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string | null
          emails_found?: string[] | null
          error_message?: string | null
          id?: string
          phones_found?: string[] | null
          processing_time_ms?: number | null
          session_id?: string | null
          social_found?: Json | null
          status?: string | null
          tentativo?: number | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraping_jobs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraping_jobs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "scraping_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      scraping_sessions: {
        Row: {
          citta: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          max_results: number | null
          n8n_webhook_id: string | null
          pausa_motivo: string | null
          paused_at: string | null
          progress_percent: number | null
          query: string | null
          raggio: number | null
          resumed_at: string | null
          started_at: string | null
          status: string | null
          tipo: string
          totale_errori: number | null
          totale_importati: number | null
          totale_trovati: number | null
          user_id: string | null
        }
        Insert: {
          citta?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_results?: number | null
          n8n_webhook_id?: string | null
          pausa_motivo?: string | null
          paused_at?: string | null
          progress_percent?: number | null
          query?: string | null
          raggio?: number | null
          resumed_at?: string | null
          started_at?: string | null
          status?: string | null
          tipo: string
          totale_errori?: number | null
          totale_importati?: number | null
          totale_trovati?: number | null
          user_id?: string | null
        }
        Update: {
          citta?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_results?: number | null
          n8n_webhook_id?: string | null
          pausa_motivo?: string | null
          paused_at?: string | null
          progress_percent?: number | null
          query?: string | null
          raggio?: number | null
          resumed_at?: string | null
          started_at?: string | null
          status?: string | null
          tipo?: string
          totale_errori?: number | null
          totale_importati?: number | null
          totale_trovati?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      sender_daily_stats: {
        Row: {
          aperti: number | null
          bounce: number | null
          cliccati: number | null
          giorno: string
          id: string
          inviati: number | null
          sender_id: string
          spam: number | null
        }
        Insert: {
          aperti?: number | null
          bounce?: number | null
          cliccati?: number | null
          giorno?: string
          id?: string
          inviati?: number | null
          sender_id: string
          spam?: number | null
        }
        Update: {
          aperti?: number | null
          bounce?: number | null
          cliccati?: number | null
          giorno?: string
          id?: string
          inviati?: number | null
          sender_id?: string
          spam?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sender_daily_stats_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "sender_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      sender_pool: {
        Row: {
          attivo: boolean | null
          bounce_rate: number | null
          chiamate_oggi: number
          created_at: string | null
          dkim_ok: boolean | null
          dmarc_ok: boolean | null
          dominio: string | null
          durata_media_sec: number | null
          elevenlabs_agent_id: string | null
          elevenlabs_phone_id: string | null
          email_from: string | null
          email_nome: string | null
          health_score: number | null
          id: string
          inviati_oggi: number | null
          max_chiamate_day: number
          max_per_day: number | null
          nome: string
          note: string | null
          phone_number: string | null
          reply_to: string | null
          resend_api_key: string | null
          sms_api_key: string | null
          sms_api_secret: string | null
          sms_from: string | null
          sms_provider: string | null
          spam_rate: number | null
          spf_ok: boolean | null
          stato: string | null
          tipo: string
          totale_bounce: number | null
          totale_inviati: number | null
          totale_spam: number | null
          ultimo_reset: string | null
          updated_at: string | null
          user_id: string
          wa_access_token: string | null
          wa_numero: string | null
          wa_phone_number_id: string | null
          wa_quality: string | null
          wa_tier: string | null
          warmup_attivo: boolean | null
          warmup_giorno: number | null
          warmup_iniziato: string | null
        }
        Insert: {
          attivo?: boolean | null
          bounce_rate?: number | null
          chiamate_oggi?: number
          created_at?: string | null
          dkim_ok?: boolean | null
          dmarc_ok?: boolean | null
          dominio?: string | null
          durata_media_sec?: number | null
          elevenlabs_agent_id?: string | null
          elevenlabs_phone_id?: string | null
          email_from?: string | null
          email_nome?: string | null
          health_score?: number | null
          id?: string
          inviati_oggi?: number | null
          max_chiamate_day?: number
          max_per_day?: number | null
          nome: string
          note?: string | null
          phone_number?: string | null
          reply_to?: string | null
          resend_api_key?: string | null
          sms_api_key?: string | null
          sms_api_secret?: string | null
          sms_from?: string | null
          sms_provider?: string | null
          spam_rate?: number | null
          spf_ok?: boolean | null
          stato?: string | null
          tipo: string
          totale_bounce?: number | null
          totale_inviati?: number | null
          totale_spam?: number | null
          ultimo_reset?: string | null
          updated_at?: string | null
          user_id: string
          wa_access_token?: string | null
          wa_numero?: string | null
          wa_phone_number_id?: string | null
          wa_quality?: string | null
          wa_tier?: string | null
          warmup_attivo?: boolean | null
          warmup_giorno?: number | null
          warmup_iniziato?: string | null
        }
        Update: {
          attivo?: boolean | null
          bounce_rate?: number | null
          chiamate_oggi?: number
          created_at?: string | null
          dkim_ok?: boolean | null
          dmarc_ok?: boolean | null
          dominio?: string | null
          durata_media_sec?: number | null
          elevenlabs_agent_id?: string | null
          elevenlabs_phone_id?: string | null
          email_from?: string | null
          email_nome?: string | null
          health_score?: number | null
          id?: string
          inviati_oggi?: number | null
          max_chiamate_day?: number
          max_per_day?: number | null
          nome?: string
          note?: string | null
          phone_number?: string | null
          reply_to?: string | null
          resend_api_key?: string | null
          sms_api_key?: string | null
          sms_api_secret?: string | null
          sms_from?: string | null
          sms_provider?: string | null
          spam_rate?: number | null
          spf_ok?: boolean | null
          stato?: string | null
          tipo?: string
          totale_bounce?: number | null
          totale_inviati?: number | null
          totale_spam?: number | null
          ultimo_reset?: string | null
          updated_at?: string | null
          user_id?: string
          wa_access_token?: string | null
          wa_numero?: string | null
          wa_phone_number_id?: string | null
          wa_quality?: string | null
          wa_tier?: string | null
          warmup_attivo?: boolean | null
          warmup_giorno?: number | null
          warmup_iniziato?: string | null
        }
        Relationships: []
      }
      suppression_list: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          email: string
          id: string
          motivo: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          motivo?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          motivo?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppression_list_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "suppression_list_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      unsubscribes: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          email: string | null
          id: string
          motivo: string | null
          telefono: string | null
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          motivo?: string | null
          telefono?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          motivo?: string | null
          telefono?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unsubscribes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "unsubscribes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_log: {
        Row: {
          campaign_id: string | null
          costo_totale_eur: number | null
          costo_unitario_eur: number | null
          created_at: string | null
          id: string
          provider: string | null
          quantita: number | null
          tipo: string
          user_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          costo_totale_eur?: number | null
          costo_unitario_eur?: number | null
          created_at?: string | null
          id?: string
          provider?: string | null
          quantita?: number | null
          tipo: string
          user_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          costo_totale_eur?: number | null
          costo_unitario_eur?: number | null
          created_at?: string | null
          id?: string
          provider?: string | null
          quantita?: number | null
          tipo?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "call_analytics"
            referencedColumns: ["campaign_id"]
          },
          {
            foreignKeyName: "usage_log_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      call_analytics: {
        Row: {
          appuntamenti: number | null
          campaign_id: string | null
          completate: number | null
          costo_totale_eur: number | null
          da_richiamare: number | null
          durata_media_sec: number | null
          interessati: number | null
          no_risposta: number | null
          nome: string | null
          tasso_interesse: number | null
          totale_chiamate: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_health_score: {
        Args: { p_bounce_rate: number; p_spam_rate: number }
        Returns: number
      }
      increment_step_stat: {
        Args: { p_amount?: number; p_column: string; p_step_id: string }
        Returns: undefined
      }
      user_owns_campaign: { Args: { _campaign_id: string }; Returns: boolean }
      user_owns_contact: { Args: { _contact_id: string }; Returns: boolean }
      user_owns_list: { Args: { _list_id: string }; Returns: boolean }
      user_owns_scraping_session: {
        Args: { _session_id: string }
        Returns: boolean
      }
      user_owns_sequence: { Args: { _sequence_id: string }; Returns: boolean }
      user_owns_step: { Args: { _step_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
