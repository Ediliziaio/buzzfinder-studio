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
      campaign_recipients: {
        Row: {
          campaign_id: string | null
          canale_id: string | null
          contact_id: string | null
          errore: string | null
          id: string
          inviato_at: string | null
          stato: string | null
        }
        Insert: {
          campaign_id?: string | null
          canale_id?: string | null
          contact_id?: string | null
          errore?: string | null
          id?: string
          inviato_at?: string | null
          stato?: string | null
        }
        Update: {
          campaign_id?: string | null
          canale_id?: string | null
          contact_id?: string | null
          errore?: string | null
          id?: string
          inviato_at?: string | null
          stato?: string | null
        }
        Relationships: [
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
        ]
      }
      campaigns: {
        Row: {
          ab_test_enabled: boolean | null
          ab_test_sample_size: number | null
          ab_test_split: number | null
          ab_winner: string | null
          ab_winner_selected_at: string | null
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
          errori: number | null
          id: string
          inviati: number | null
          inviati_a: number | null
          inviati_b: number | null
          n8n_webhook_id: string | null
          nome: string
          provider: string | null
          reply_to: string | null
          scheduled_at: string | null
          sender_email: string | null
          sender_name: string | null
          sending_rate_per_hour: number | null
          started_at: string | null
          stato: string | null
          subject: string | null
          subject_b: string | null
          template_whatsapp_id: string | null
          tipo: string
          totale_destinatari: number | null
          user_id: string | null
        }
        Insert: {
          ab_test_enabled?: boolean | null
          ab_test_sample_size?: number | null
          ab_test_split?: number | null
          ab_winner?: string | null
          ab_winner_selected_at?: string | null
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
          errori?: number | null
          id?: string
          inviati?: number | null
          inviati_a?: number | null
          inviati_b?: number | null
          n8n_webhook_id?: string | null
          nome: string
          provider?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sending_rate_per_hour?: number | null
          started_at?: string | null
          stato?: string | null
          subject?: string | null
          subject_b?: string | null
          template_whatsapp_id?: string | null
          tipo: string
          totale_destinatari?: number | null
          user_id?: string | null
        }
        Update: {
          ab_test_enabled?: boolean | null
          ab_test_sample_size?: number | null
          ab_test_split?: number | null
          ab_winner?: string | null
          ab_winner_selected_at?: string | null
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
          errori?: number | null
          id?: string
          inviati?: number | null
          inviati_a?: number | null
          inviati_b?: number | null
          n8n_webhook_id?: string | null
          nome?: string
          provider?: string | null
          reply_to?: string | null
          scheduled_at?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sending_rate_per_hour?: number | null
          started_at?: string | null
          stato?: string | null
          subject?: string | null
          subject_b?: string | null
          template_whatsapp_id?: string | null
          tipo?: string
          totale_destinatari?: number | null
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
          azienda: string
          cap: string | null
          citta: string | null
          cognome: string | null
          created_at: string | null
          email: string | null
          email_confidence: number | null
          email_valid: boolean | null
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
          telefono_normalizzato: string | null
          ultima_attivita: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          azienda: string
          cap?: string | null
          citta?: string | null
          cognome?: string | null
          created_at?: string | null
          email?: string | null
          email_confidence?: number | null
          email_valid?: boolean | null
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
          telefono_normalizzato?: string | null
          ultima_attivita?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          azienda?: string
          cap?: string | null
          citta?: string | null
          cognome?: string | null
          created_at?: string | null
          email?: string | null
          email_confidence?: number | null
          email_valid?: boolean | null
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
          telefono_normalizzato?: string | null
          ultima_attivita?: string | null
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
          progress_percent: number | null
          query: string | null
          raggio: number | null
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
          progress_percent?: number | null
          query?: string | null
          raggio?: number | null
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
          progress_percent?: number | null
          query?: string | null
          raggio?: number | null
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
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
