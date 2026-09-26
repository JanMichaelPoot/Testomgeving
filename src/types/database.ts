// Hand-written to match supabase/migrations/*.sql (0001 through 0011).
// Once the project is linked to a real Supabase instance, regenerate with:
//   npx supabase gen types typescript --linked > src/types/database.ts

export type SessionStatus =
  | "started"
  | "diverging"
  | "converged"
  | "paid"
  | "abandoned";

export type IdeaStatus = "generated" | "liked" | "skipped" | "refined";

export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type PlanStatus = "pending" | "ready" | "failed";

// Model C digital sale compliance (see supabase/migrations
// /0010_digital_sales_compliance.sql) — which legal document a
// legal_documents row/version applies to.
export type LegalDocumentType =
  | "terms"
  | "digital_delivery_consent"
  | "withdrawal_information"
  | "privacy";

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          marketing_opt_in: boolean;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          marketing_opt_in?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          user_id: string | null;
          created_at: string;
          status: SessionStatus;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          created_at?: string;
          status?: SessionStatus;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      intake_answers: {
        Row: {
          id: string;
          session_id: string;
          topic: string | null;
          time_available: string | null;
          budget: string | null;
          desired_surprise: string | null;
          company: string | null;
          raw_json: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          topic?: string | null;
          time_available?: string | null;
          budget?: string | null;
          desired_surprise?: string | null;
          company?: string | null;
          raw_json?: Record<string, unknown>;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["intake_answers"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "intake_answers_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      ideas: {
        Row: {
          id: string;
          session_id: string;
          lens: string;
          title: string;
          description: string;
          status: IdeaStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          lens: string;
          title: string;
          description: string;
          status?: IdeaStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ideas"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "ideas_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      window_plans: {
        Row: {
          id: string;
          session_id: string;
          title: string;
          language: string;
          status: PlanStatus;
          profile_summary: string;
          must_haves: string[];
          preferences: string[];
          ideas_json: unknown[];
          wildcard_json: Record<string, unknown>;
          labels_json: Record<string, string>;
          pdf_url: string | null;
          image_url: string | null;
          recipient_email: string | null;
          first_action_reminder_sent_at: string | null;
          // Fase 6 (Interaction & Retention) — per-idea thumbs reaction, see
          // supabase/migrations/0009_idea_feedback.sql.
          feedback_json: Record<string, string>;
          // "Verleiding" Fase 2 — which idea the buyer pressed "Dit ga ik
          // doen" on (same key format as feedback_json), see
          // supabase/migrations/0013_committed_idea.sql.
          committed_idea_key: string | null;
          committed_at: string | null;
          // Model C digital sale compliance (0010_digital_sales_compliance.sql)
          // — which order this Idea Book belongs to, and when it was
          // actually generated/e-mailed, so an order's full legal/delivery
          // status is reproducible end to end. payment_id is nullable
          // because it's not knowable for the test-mode bypass path
          // (getOrCreateTestWindowPlan in src/app/plan/data.ts never has a
          // real Stripe/payments row to point at).
          payment_id: string | null;
          generated_at: string | null;
          email_sent_at: string | null;
          pdf_version: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          title: string;
          language?: string;
          status?: PlanStatus;
          profile_summary?: string;
          must_haves?: string[];
          preferences?: string[];
          ideas_json?: unknown[];
          wildcard_json?: Record<string, unknown>;
          labels_json?: Record<string, string>;
          pdf_url?: string | null;
          image_url?: string | null;
          recipient_email?: string | null;
          first_action_reminder_sent_at?: string | null;
          feedback_json?: Record<string, string>;
          committed_idea_key?: string | null;
          committed_at?: string | null;
          payment_id?: string | null;
          generated_at?: string | null;
          email_sent_at?: string | null;
          pdf_version?: number;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["window_plans"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "window_plans_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "window_plans_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          session_id: string;
          stripe_payment_id: string;
          amount: number;
          currency: string;
          status: PaymentStatus;
          withdrawal_waiver_confirmed_at: string | null;
          // Model C digital sale compliance (0010_digital_sales_compliance.sql)
          // — this table is, in effect, the order record: one row per
          // Stripe Checkout attempt already existed, so it gets the order
          // vocabulary instead of a redundant parallel `orders` table.
          // order_number is assigned via the next_order_number() SQL
          // function at order-creation time (see src/lib/orderNumber.ts).
          order_number: string | null;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          stripe_payment_id: string;
          amount: number;
          currency?: string;
          status: PaymentStatus;
          withdrawal_waiver_confirmed_at?: string | null;
          order_number?: string | null;
          product_id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "payments_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          name: string;
          description: string;
          price_cents: number;
          currency: string;
          digital_content: boolean;
          delivery_type: string;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description: string;
          price_cents: number;
          currency?: string;
          digital_content?: boolean;
          delivery_type?: string;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
        Relationships: [];
      };
      terms_acceptance: {
        Row: {
          id: string;
          order_id: string;
          accepted: boolean;
          terms_version: string;
          consent_text_hash: string;
          accepted_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          accepted: boolean;
          terms_version: string;
          consent_text_hash: string;
          accepted_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["terms_acceptance"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "terms_acceptance_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      digital_delivery_consent: {
        Row: {
          id: string;
          order_id: string;
          consent: boolean;
          consent_version: string;
          consent_timestamp: string;
          withdrawal_acknowledged: boolean;
          withdrawal_acknowledged_version: string;
          withdrawal_acknowledged_timestamp: string;
          consent_text_hash: string;
          ip_address: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          order_id: string;
          consent: boolean;
          consent_version: string;
          consent_timestamp?: string;
          withdrawal_acknowledged: boolean;
          withdrawal_acknowledged_version: string;
          withdrawal_acknowledged_timestamp?: string;
          consent_text_hash: string;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["digital_delivery_consent"]["Insert"]
        >;
        Relationships: [
          {
            foreignKeyName: "digital_delivery_consent_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      legal_documents: {
        Row: {
          id: string;
          document_type: LegalDocumentType;
          version: string;
          locale: string;
          published_at: string;
          is_active: boolean;
        };
        Insert: {
          id?: string;
          document_type: LegalDocumentType;
          version: string;
          locale: string;
          published_at?: string;
          is_active?: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["legal_documents"]["Insert"]
        >;
        Relationships: [];
      };
      // Shared, anonymous cache of local research results (activity x place), see
      // supabase/migrations/0014_local_research_cache.sql.
      local_research_cache: {
        Row: {
          id: string;
          activity_id: string;
          place_key: string;
          locale: string;
          options: unknown[];
          searched_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          activity_id: string;
          place_key: string;
          locale: string;
          options?: unknown[];
          searched_at?: string;
          expires_at: string;
        };
        Update: Partial<Database["public"]["Tables"]["local_research_cache"]["Insert"]>;
        Relationships: [];
      };
      // Deliberately has no foreign key to any other table — see
      // supabase/migrations/0008_audit_log.sql for why this row can never
      // be traced back to a session or person.
      audit_log: {
        Row: {
          id: string;
          created_at: string;
          locale: string;
          input_json: Record<string, unknown>;
          output_profile_summary: string | null;
          output_must_haves: string[];
          output_preferences: string[];
          output_ideas_json: unknown[];
          output_wildcard_json: Record<string, unknown> | null;
          email_delivered: boolean;
        };
        Insert: {
          id?: string;
          created_at?: string;
          locale: string;
          input_json?: Record<string, unknown>;
          output_profile_summary?: string | null;
          output_must_haves?: string[];
          output_preferences?: string[];
          output_ideas_json?: unknown[];
          output_wildcard_json?: Record<string, unknown> | null;
          email_delivered?: boolean;
        };
        Update: Partial<Database["public"]["Tables"]["audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      // Assigns the next human-readable order number (e.g. "WI-2026-000042")
      // via a Postgres sequence — see supabase/migrations
      // /0010_digital_sales_compliance.sql and src/lib/orderNumber.ts.
      next_order_number: {
        Args: Record<string, never>;
        Returns: string;
      };
    };
  };
}
