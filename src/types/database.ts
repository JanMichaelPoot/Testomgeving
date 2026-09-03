// Hand-written to match supabase/migrations/0001_init.sql.
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
          chosen_idea_id: string;
          title: string;
          why_it_fits: string;
          steps_json: unknown[];
          first_action: string;
          cost_estimate: string | null;
          time_estimate: string | null;
          pdf_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          chosen_idea_id: string;
          title: string;
          why_it_fits: string;
          steps_json?: unknown[];
          first_action: string;
          cost_estimate?: string | null;
          time_estimate?: string | null;
          pdf_url?: string | null;
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
            foreignKeyName: "window_plans_chosen_idea_id_fkey";
            columns: ["chosen_idea_id"];
            isOneToOne: false;
            referencedRelation: "ideas";
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
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
