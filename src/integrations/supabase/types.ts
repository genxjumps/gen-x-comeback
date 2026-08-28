export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      canonical_events: {
        Row: {
          event_id: string;
          event_name: string;
          event_version: string;
          job_id: string | null;
          lead_plan_id: string | null;
          occurred_at: string;
          plan_version_id: string | null;
          source: string | null;
          submission_id: string | null;
        };
        Insert: {
          event_id?: string;
          event_name: string;
          event_version?: string;
          job_id?: string | null;
          lead_plan_id?: string | null;
          occurred_at?: string;
          plan_version_id?: string | null;
          source?: string | null;
          submission_id?: string | null;
        };
        Update: {
          event_id?: string;
          event_name?: string;
          event_version?: string;
          job_id?: string | null;
          lead_plan_id?: string | null;
          occurred_at?: string;
          plan_version_id?: string | null;
          source?: string | null;
          submission_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "canonical_events_lead_plan_fk";
            columns: ["lead_plan_id"];
            isOneToOne: false;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_accounts: {
        Row: {
          auth_user_id: string;
          created_at: string;
          email_normalized: string;
          email_original: string;
          email_verified_at: string;
          first_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          auth_user_id: string;
          created_at?: string;
          email_normalized: string;
          email_original: string;
          email_verified_at: string;
          first_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Update: {
          auth_user_id?: string;
          created_at?: string;
          email_normalized?: string;
          email_original?: string;
          email_verified_at?: string;
          first_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      customer_active_programs: {
        Row: {
          activated_at: string;
          customer_id: string;
          lead_plan_id: string | null;
          paid_enrollment_id: string | null;
          program_kind: string;
          updated_at: string;
        };
        Insert: {
          activated_at?: string;
          customer_id: string;
          lead_plan_id?: string | null;
          paid_enrollment_id?: string | null;
          program_kind: string;
          updated_at?: string;
        };
        Update: {
          activated_at?: string;
          customer_id?: string;
          lead_plan_id?: string | null;
          paid_enrollment_id?: string | null;
          program_kind?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_active_programs_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: true;
            referencedRelation: "customer_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_active_programs_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: true;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_active_programs_paid_enrollment_id_fkey";
            columns: ["paid_enrollment_id"];
            isOneToOne: true;
            referencedRelation: "paid_program_enrollments";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_lead_plan_links: {
        Row: {
          customer_id: string;
          lead_plan_id: string;
          link_source: string;
          linked_at: string;
        };
        Insert: {
          customer_id: string;
          lead_plan_id: string;
          link_source: string;
          linked_at?: string;
        };
        Update: {
          customer_id?: string;
          lead_plan_id?: string;
          link_source?: string;
          linked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_lead_plan_links_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_lead_plan_links_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: true;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      email_jobs: {
        Row: {
          alerted_stale_at: string | null;
          attempt_count: number;
          canceled_at: string | null;
          claim_token: string | null;
          created_at: string;
          delivered_at: string | null;
          delivery_status: Database["public"]["Enums"]["email_delivery_status"];
          eligible_at: string;
          first_provider_attempt_at: string | null;
          idempotency_key: string;
          job_id: string;
          job_type: string;
          job_version: string;
          last_error_at: string | null;
          last_error_code: string | null;
          lead_plan_id: string;
          lease_expires_at: string | null;
          locked_at: string | null;
          manual_review_at: string | null;
          next_attempt_at: string | null;
          plan_version_id: string;
          provider_accepted_at: string | null;
          provider_key: string | null;
          provider_message_id: string | null;
          source_event_id: string | null;
          status: Database["public"]["Enums"]["email_job_status"];
          suppression_reason: string | null;
          template_version: string;
          updated_at: string;
        };
        Insert: {
          alerted_stale_at?: string | null;
          attempt_count?: number;
          canceled_at?: string | null;
          claim_token?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_status?: Database["public"]["Enums"]["email_delivery_status"];
          eligible_at?: string;
          first_provider_attempt_at?: string | null;
          idempotency_key: string;
          job_id?: string;
          job_type: string;
          job_version?: string;
          last_error_at?: string | null;
          last_error_code?: string | null;
          lead_plan_id: string;
          lease_expires_at?: string | null;
          locked_at?: string | null;
          manual_review_at?: string | null;
          next_attempt_at?: string | null;
          plan_version_id: string;
          provider_accepted_at?: string | null;
          provider_key?: string | null;
          provider_message_id?: string | null;
          source_event_id?: string | null;
          status?: Database["public"]["Enums"]["email_job_status"];
          suppression_reason?: string | null;
          template_version: string;
          updated_at?: string;
        };
        Update: {
          alerted_stale_at?: string | null;
          attempt_count?: number;
          canceled_at?: string | null;
          claim_token?: string | null;
          created_at?: string;
          delivered_at?: string | null;
          delivery_status?: Database["public"]["Enums"]["email_delivery_status"];
          eligible_at?: string;
          first_provider_attempt_at?: string | null;
          idempotency_key?: string;
          job_id?: string;
          job_type?: string;
          job_version?: string;
          last_error_at?: string | null;
          last_error_code?: string | null;
          lead_plan_id?: string;
          lease_expires_at?: string | null;
          locked_at?: string | null;
          manual_review_at?: string | null;
          next_attempt_at?: string | null;
          plan_version_id?: string;
          provider_accepted_at?: string | null;
          provider_key?: string | null;
          provider_message_id?: string | null;
          source_event_id?: string | null;
          status?: Database["public"]["Enums"]["email_job_status"];
          suppression_reason?: string | null;
          template_version?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_jobs_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: false;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      email_production_control: {
        Row: {
          activated_at: string | null;
          activation_boundary: string | null;
          controlled_lead_plan_id: string | null;
          cron_job_id: number | null;
          genuine_plans_admitted: boolean;
          provider_submission_limit: number;
          scheduler_configured_at: string | null;
          scheduler_secret_sha256: string | null;
          scheduler_url: string | null;
          sending_enabled: boolean;
          singleton_id: number;
          updated_at: string;
        };
        Insert: {
          activated_at?: string | null;
          activation_boundary?: string | null;
          controlled_lead_plan_id?: string | null;
          cron_job_id?: number | null;
          genuine_plans_admitted?: boolean;
          provider_submission_limit?: number;
          scheduler_configured_at?: string | null;
          scheduler_secret_sha256?: string | null;
          scheduler_url?: string | null;
          sending_enabled?: boolean;
          singleton_id?: number;
          updated_at?: string;
        };
        Update: {
          activated_at?: string | null;
          activation_boundary?: string | null;
          controlled_lead_plan_id?: string | null;
          cron_job_id?: number | null;
          genuine_plans_admitted?: boolean;
          provider_submission_limit?: number;
          scheduler_configured_at?: string | null;
          scheduler_secret_sha256?: string | null;
          scheduler_url?: string | null;
          sending_enabled?: boolean;
          singleton_id?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_production_control_controlled_lead_plan_id_fkey";
            columns: ["controlled_lead_plan_id"];
            isOneToOne: false;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      email_provider_submissions: {
        Row: {
          completed_at: string | null;
          created_at: string;
          idempotency_key: string;
          invocation_id: string;
          job_id: string;
          job_type: string;
          lead_plan_id: string;
          outcome_code: string | null;
          provider_accepted_at: string | null;
          provider_key: string | null;
          provider_message_id: string | null;
          reserved_at: string;
          status: string;
          submission_attempt_id: string;
          template_version: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          idempotency_key: string;
          invocation_id: string;
          job_id: string;
          job_type: string;
          lead_plan_id: string;
          outcome_code?: string | null;
          provider_accepted_at?: string | null;
          provider_key?: string | null;
          provider_message_id?: string | null;
          reserved_at?: string;
          status?: string;
          submission_attempt_id?: string;
          template_version: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          idempotency_key?: string;
          invocation_id?: string;
          job_id?: string;
          job_type?: string;
          lead_plan_id?: string;
          outcome_code?: string | null;
          provider_accepted_at?: string | null;
          provider_key?: string | null;
          provider_message_id?: string | null;
          reserved_at?: string;
          status?: string;
          submission_attempt_id?: string;
          template_version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_provider_submissions_invocation_id_fkey";
            columns: ["invocation_id"];
            isOneToOne: false;
            referencedRelation: "email_scheduler_invocations";
            referencedColumns: ["invocation_id"];
          },
          {
            foreignKeyName: "email_provider_submissions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "email_jobs";
            referencedColumns: ["job_id"];
          },
          {
            foreignKeyName: "email_provider_submissions_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: false;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      email_scheduler_auth_attempts: {
        Row: {
          attempted_at: string;
          id: string;
          invocation_reference: string | null;
          result: string;
        };
        Insert: {
          attempted_at?: string;
          id?: string;
          invocation_reference?: string | null;
          result: string;
        };
        Update: {
          attempted_at?: string;
          id?: string;
          invocation_reference?: string | null;
          result?: string;
        };
        Relationships: [];
      };
      email_scheduler_invocations: {
        Row: {
          auth_deadline: string;
          auth_result: string | null;
          authenticated_at: string | null;
          claimed_count: number;
          completed_at: string | null;
          created_at: string;
          dispatch_succeeded: boolean | null;
          eligible_jobs_after: number;
          failure_code: string | null;
          invocation_id: string;
          invoked_at: string;
          provider_accepted_count: number;
          provider_attempt_count: number;
          sending_enabled: boolean | null;
          source: string;
          transport_request_id: number | null;
        };
        Insert: {
          auth_deadline: string;
          auth_result?: string | null;
          authenticated_at?: string | null;
          claimed_count?: number;
          completed_at?: string | null;
          created_at?: string;
          dispatch_succeeded?: boolean | null;
          eligible_jobs_after?: number;
          failure_code?: string | null;
          invocation_id?: string;
          invoked_at?: string;
          provider_accepted_count?: number;
          provider_attempt_count?: number;
          sending_enabled?: boolean | null;
          source?: string;
          transport_request_id?: number | null;
        };
        Update: {
          auth_deadline?: string;
          auth_result?: string | null;
          authenticated_at?: string | null;
          claimed_count?: number;
          completed_at?: string | null;
          created_at?: string;
          dispatch_succeeded?: boolean | null;
          eligible_jobs_after?: number;
          failure_code?: string | null;
          invocation_id?: string;
          invoked_at?: string;
          provider_accepted_count?: number;
          provider_attempt_count?: number;
          sending_enabled?: boolean | null;
          source?: string;
          transport_request_id?: number | null;
        };
        Relationships: [];
      };
      email_preference_credentials: {
        Row: {
          credential_id: string;
          issued_at: string;
          lead_plan_id: string;
          purpose: string;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: {
          credential_id?: string;
          issued_at?: string;
          lead_plan_id: string;
          purpose?: string;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          credential_id?: string;
          issued_at?: string;
          lead_plan_id?: string;
          purpose?: string;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "email_preference_credentials_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: true;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      email_provider_events: {
        Row: {
          event_kind: string | null;
          event_type: string;
          id: string;
          job_id: string | null;
          matched_at: string | null;
          occurred_at: string | null;
          provider_event_id: string;
          provider_key: string;
          provider_message_id: string | null;
          received_at: string;
          reconciled_at: string | null;
          suppression: string | null;
        };
        Insert: {
          event_kind?: string | null;
          event_type: string;
          id?: string;
          job_id?: string | null;
          matched_at?: string | null;
          occurred_at?: string | null;
          provider_event_id: string;
          provider_key: string;
          provider_message_id?: string | null;
          received_at?: string;
          reconciled_at?: string | null;
          suppression?: string | null;
        };
        Update: {
          event_kind?: string | null;
          event_type?: string;
          id?: string;
          job_id?: string | null;
          matched_at?: string | null;
          occurred_at?: string | null;
          provider_event_id?: string;
          provider_key?: string;
          provider_message_id?: string | null;
          received_at?: string;
          reconciled_at?: string | null;
          suppression?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "email_provider_events_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "email_jobs";
            referencedColumns: ["job_id"];
          },
        ];
      };
      email_suppressions: {
        Row: {
          created_at: string;
          email_normalized: string;
          id: string;
          reason: string;
          source: string;
        };
        Insert: {
          created_at?: string;
          email_normalized: string;
          id?: string;
          reason: string;
          source?: string;
        };
        Update: {
          created_at?: string;
          email_normalized?: string;
          id?: string;
          reason?: string;
          source?: string;
        };
        Relationships: [];
      };
      lead_plan_day_completions: {
        Row: {
          completed_at: string;
          created_at: string;
          day_number: number;
          id: string;
          lead_plan_id: string;
          updated_at: string;
        };
        Insert: {
          completed_at?: string;
          created_at?: string;
          day_number: number;
          id?: string;
          lead_plan_id: string;
          updated_at?: string;
        };
        Update: {
          completed_at?: string;
          created_at?: string;
          day_number?: number;
          id?: string;
          lead_plan_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_plan_day_completions_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: false;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_plan_day_starts: {
        Row: {
          created_at: string;
          day_number: number;
          id: string;
          lead_plan_id: string;
          plan_version_id: string;
          started_at: string;
        };
        Insert: {
          created_at?: string;
          day_number: number;
          id?: string;
          lead_plan_id: string;
          plan_version_id: string;
          started_at?: string;
        };
        Update: {
          created_at?: string;
          day_number?: number;
          id?: string;
          lead_plan_id?: string;
          plan_version_id?: string;
          started_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_plan_day_starts_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: false;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_plans: {
        Row: {
          access_token_hash: string | null;
          assessment_json: Json;
          consent_at: string;
          consent_copy: string;
          consent_granted: boolean;
          consent_version: string;
          created_at: string;
          email_last_engaged_at: string | null;
          email_normalized: string;
          email_original: string;
          email_suppressed_at: string | null;
          email_suppression_reason: string | null;
          email_verified_at: string | null;
          first_name: string;
          id: string;
          marketing_consent_active: boolean;
          marketing_consent_at: string | null;
          marketing_consent_source: string | null;
          marketing_unsubscribed_at: string | null;
          plan_email_consent_active: boolean;
          plan_email_consent_at: string | null;
          plan_email_consent_source: string | null;
          plan_email_unsubscribed_at: string | null;
          plan_json: Json;
          plan_version_id: string;
          updated_at: string;
        };
        Insert: {
          access_token_hash?: string | null;
          assessment_json: Json;
          consent_at: string;
          consent_copy: string;
          consent_granted: boolean;
          consent_version: string;
          created_at?: string;
          email_last_engaged_at?: string | null;
          email_normalized: string;
          email_original: string;
          email_suppressed_at?: string | null;
          email_suppression_reason?: string | null;
          email_verified_at?: string | null;
          first_name: string;
          id?: string;
          marketing_consent_active?: boolean;
          marketing_consent_at?: string | null;
          marketing_consent_source?: string | null;
          marketing_unsubscribed_at?: string | null;
          plan_email_consent_active?: boolean;
          plan_email_consent_at?: string | null;
          plan_email_consent_source?: string | null;
          plan_email_unsubscribed_at?: string | null;
          plan_json: Json;
          plan_version_id?: string;
          updated_at?: string;
        };
        Update: {
          access_token_hash?: string | null;
          assessment_json?: Json;
          consent_at?: string;
          consent_copy?: string;
          consent_granted?: boolean;
          consent_version?: string;
          created_at?: string;
          email_last_engaged_at?: string | null;
          email_normalized?: string;
          email_original?: string;
          email_suppressed_at?: string | null;
          email_suppression_reason?: string | null;
          email_verified_at?: string | null;
          first_name?: string;
          id?: string;
          marketing_consent_active?: boolean;
          marketing_consent_at?: string | null;
          marketing_consent_source?: string | null;
          marketing_unsubscribed_at?: string | null;
          plan_email_consent_active?: boolean;
          plan_email_consent_at?: string | null;
          plan_email_consent_source?: string | null;
          plan_email_unsubscribed_at?: string | null;
          plan_json?: Json;
          plan_version_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      operational_alerts: {
        Row: {
          alert_type: string;
          created_at: string;
          details: Json;
          id: string;
          job_id: string | null;
          lead_plan_id: string | null;
          resolved_at: string | null;
          severity: string;
        };
        Insert: {
          alert_type: string;
          created_at?: string;
          details?: Json;
          id?: string;
          job_id?: string | null;
          lead_plan_id?: string | null;
          resolved_at?: string | null;
          severity?: string;
        };
        Update: {
          alert_type?: string;
          created_at?: string;
          details?: Json;
          id?: string;
          job_id?: string | null;
          lead_plan_id?: string | null;
          resolved_at?: string | null;
          severity?: string;
        };
        Relationships: [
          {
            foreignKeyName: "operational_alerts_job_fk";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "email_jobs";
            referencedColumns: ["job_id"];
          },
        ];
      };
      paid_product_entitlements: {
        Row: {
          created_at: string;
          customer_id: string;
          granted_at: string;
          id: string;
          product_code: string;
          purchase_id: string;
          revoked_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          granted_at: string;
          id?: string;
          product_code: string;
          purchase_id: string;
          revoked_at?: string | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          granted_at?: string;
          id?: string;
          product_code?: string;
          purchase_id?: string;
          revoked_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paid_product_entitlements_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paid_product_entitlements_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "paid_purchases";
            referencedColumns: ["id"];
          },
        ];
      };
      paid_program_day_completions: {
        Row: {
          completed_at: string;
          created_at: string;
          day_number: number;
          enrollment_id: string;
          id: string;
          program_version: string;
          undo_until: string;
        };
        Insert: {
          completed_at?: string;
          created_at?: string;
          day_number: number;
          enrollment_id: string;
          id?: string;
          program_version: string;
          undo_until?: string;
        };
        Update: {
          completed_at?: string;
          created_at?: string;
          day_number?: number;
          enrollment_id?: string;
          id?: string;
          program_version?: string;
          undo_until?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paid_program_day_completions_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "paid_program_enrollments";
            referencedColumns: ["id"];
          },
        ];
      };
      paid_program_enrollments: {
        Row: {
          completed_at: string | null;
          created_at: string;
          customer_id: string;
          customer_time_zone: string;
          entitlement_id: string;
          id: string;
          paused_at: string | null;
          product_code: string;
          program_snapshot: Json;
          program_version: string;
          revoked_at: string | null;
          run_number: number;
          started_at: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          customer_id: string;
          customer_time_zone: string;
          entitlement_id: string;
          id?: string;
          paused_at?: string | null;
          product_code: string;
          program_snapshot: Json;
          program_version: string;
          revoked_at?: string | null;
          run_number: number;
          started_at: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          customer_id?: string;
          customer_time_zone?: string;
          entitlement_id?: string;
          id?: string;
          paused_at?: string | null;
          product_code?: string;
          program_snapshot?: Json;
          program_version?: string;
          revoked_at?: string | null;
          run_number?: number;
          started_at?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paid_program_enrollments_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "paid_program_enrollments_entitlement_id_fkey";
            columns: ["entitlement_id"];
            isOneToOne: false;
            referencedRelation: "paid_product_entitlements";
            referencedColumns: ["id"];
          },
        ];
      };
      paid_program_video_views: {
        Row: {
          created_at: string;
          day_number: number;
          enrollment_id: string;
          first_viewed_at: string;
          id: string;
          last_viewed_at: string;
          media_key: string;
          program_version: string;
          updated_at: string;
          view_count: number;
        };
        Insert: {
          created_at?: string;
          day_number: number;
          enrollment_id: string;
          first_viewed_at?: string;
          id?: string;
          last_viewed_at?: string;
          media_key: string;
          program_version: string;
          updated_at?: string;
          view_count?: number;
        };
        Update: {
          created_at?: string;
          day_number?: number;
          enrollment_id?: string;
          first_viewed_at?: string;
          id?: string;
          last_viewed_at?: string;
          media_key?: string;
          program_version?: string;
          updated_at?: string;
          view_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "paid_program_video_views_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "paid_program_enrollments";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_measurement_revisions: {
        Row: {
          action: string;
          id: string;
          measured_at: string;
          measurement_id: string;
          notes: string | null;
          recorded_at: string;
          revision: number;
          unit: string;
          value: number;
        };
        Insert: {
          action: string;
          id?: string;
          measured_at: string;
          measurement_id: string;
          notes?: string | null;
          recorded_at?: string;
          revision: number;
          unit: string;
          value: number;
        };
        Update: {
          action?: string;
          id?: string;
          measured_at?: string;
          measurement_id?: string;
          notes?: string | null;
          recorded_at?: string;
          revision?: number;
          unit?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "customer_measurement_revisions_measurement_id_fkey";
            columns: ["measurement_id"];
            isOneToOne: false;
            referencedRelation: "customer_measurements";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_measurements: {
        Row: {
          created_at: string;
          customer_id: string;
          enrollment_id: string | null;
          id: string;
          measured_at: string;
          measurement_context: string;
          measurement_kind: string;
          notes: string | null;
          removed_at: string | null;
          revision: number;
          status: string;
          unit: string;
          updated_at: string;
          value: number;
        };
        Insert: {
          created_at?: string;
          customer_id: string;
          enrollment_id?: string | null;
          id?: string;
          measured_at?: string;
          measurement_context: string;
          measurement_kind: string;
          notes?: string | null;
          removed_at?: string | null;
          revision?: number;
          status?: string;
          unit: string;
          updated_at?: string;
          value: number;
        };
        Update: {
          created_at?: string;
          customer_id?: string;
          enrollment_id?: string | null;
          id?: string;
          measured_at?: string;
          measurement_context?: string;
          measurement_kind?: string;
          notes?: string | null;
          removed_at?: string | null;
          revision?: number;
          status?: string;
          unit?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "customer_measurements_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_measurements_enrollment_id_fkey";
            columns: ["enrollment_id"];
            isOneToOne: false;
            referencedRelation: "paid_program_enrollments";
            referencedColumns: ["id"];
          },
        ];
      };
      paid_purchases: {
        Row: {
          amount_cents: number;
          created_at: string;
          currency: string;
          customer_id: string;
          id: string;
          idempotency_key: string;
          product_code: string;
          purchase_source: string;
          purchased_at: string;
          refund_request_deadline_at: string;
          request_fingerprint: string;
          source_reference: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          created_at?: string;
          currency: string;
          customer_id: string;
          id?: string;
          idempotency_key: string;
          product_code: string;
          purchase_source: string;
          purchased_at: string;
          refund_request_deadline_at: string;
          request_fingerprint: string;
          source_reference: string;
          status: string;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          created_at?: string;
          currency?: string;
          customer_id?: string;
          id?: string;
          idempotency_key?: string;
          product_code?: string;
          purchase_source?: string;
          purchased_at?: string;
          refund_request_deadline_at?: string;
          request_fingerprint?: string;
          source_reference?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "paid_purchases_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customer_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_access_sessions: {
        Row: {
          created_at: string;
          id: string;
          last_seen_at: string | null;
          lead_plan_id: string;
          plan_version_id: string;
          revoked_at: string | null;
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_seen_at?: string | null;
          lead_plan_id: string;
          plan_version_id: string;
          revoked_at?: string | null;
          token_hash: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_seen_at?: string | null;
          lead_plan_id?: string;
          plan_version_id?: string;
          revoked_at?: string | null;
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_access_sessions_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: false;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_return_tokens: {
        Row: {
          expires_at: string;
          issued_at: string;
          job_id: string | null;
          last_used_at: string | null;
          lead_plan_id: string;
          plan_version_id: string;
          purpose: string;
          revoked_at: string | null;
          token_hash: string;
          token_id: string;
          use_count: number;
        };
        Insert: {
          expires_at: string;
          issued_at?: string;
          job_id?: string | null;
          last_used_at?: string | null;
          lead_plan_id: string;
          plan_version_id: string;
          purpose?: string;
          revoked_at?: string | null;
          token_hash: string;
          token_id?: string;
          use_count?: number;
        };
        Update: {
          expires_at?: string;
          issued_at?: string;
          job_id?: string | null;
          last_used_at?: string | null;
          lead_plan_id?: string;
          plan_version_id?: string;
          purpose?: string;
          revoked_at?: string | null;
          token_hash?: string;
          token_id?: string;
          use_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "plan_return_tokens_job_fk";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "email_jobs";
            referencedColumns: ["job_id"];
          },
          {
            foreignKeyName: "plan_return_tokens_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: false;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      plan_submissions: {
        Row: {
          created_at: string;
          email_normalized: string | null;
          job_id: string | null;
          lead_plan_id: string;
          plan_version_id: string;
          request_fingerprint: string | null;
          session_token_hash: string | null;
          source: string;
          submission_id: string;
        };
        Insert: {
          created_at?: string;
          email_normalized?: string | null;
          job_id?: string | null;
          lead_plan_id: string;
          plan_version_id: string;
          request_fingerprint?: string | null;
          session_token_hash?: string | null;
          source: string;
          submission_id: string;
        };
        Update: {
          created_at?: string;
          email_normalized?: string | null;
          job_id?: string | null;
          lead_plan_id?: string;
          plan_version_id?: string;
          request_fingerprint?: string | null;
          session_token_hash?: string | null;
          source?: string;
          submission_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plan_submissions_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: false;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limit_counters: {
        Row: {
          attempts: number;
          bucket_key: string;
          updated_at: string;
          window_start: string;
        };
        Insert: {
          attempts?: number;
          bucket_key: string;
          updated_at?: string;
          window_start: string;
        };
        Update: {
          attempts?: number;
          bucket_key?: string;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      return_link_sessions: {
        Row: {
          expires_at: string;
          issued_at: string;
          last_seen_at: string | null;
          lead_plan_id: string;
          plan_version_id: string;
          revoked_at: string | null;
          session_id: string;
          session_token_hash: string;
          token_id: string | null;
        };
        Insert: {
          expires_at: string;
          issued_at?: string;
          last_seen_at?: string | null;
          lead_plan_id: string;
          plan_version_id: string;
          revoked_at?: string | null;
          session_id?: string;
          session_token_hash: string;
          token_id?: string | null;
        };
        Update: {
          expires_at?: string;
          issued_at?: string;
          last_seen_at?: string | null;
          lead_plan_id?: string;
          plan_version_id?: string;
          revoked_at?: string | null;
          session_id?: string;
          session_token_hash?: string;
          token_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "return_link_sessions_lead_plan_id_fkey";
            columns: ["lead_plan_id"];
            isOneToOne: false;
            referencedRelation: "lead_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_link_sessions_token_id_fkey";
            columns: ["token_id"];
            isOneToOne: false;
            referencedRelation: "plan_return_tokens";
            referencedColumns: ["token_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admit_genuine_email_plans: { Args: never; Returns: boolean };
      apply_email_delivery_event: {
        Args: {
          p_job_id: string;
          p_kind: Database["public"]["Enums"]["email_delivery_status"];
          p_occurred_at?: string;
        };
        Returns: boolean;
      };
      begin_provider_attempt: {
        Args: {
          p_attempted_at: string;
          p_claim_token: string;
          p_job_id: string;
        };
        Returns: string;
      };
      begin_production_provider_attempt: {
        Args: {
          p_attempted_at: string;
          p_claim_token: string;
          p_invocation_id: string;
          p_job_id: string;
        };
        Returns: Json;
      };
      cancel_unsent_proactive_jobs: {
        Args: { p_at: string; p_lead_plan_id: string };
        Returns: number;
      };
      claim_email_jobs: {
        Args: { p_job_type: string; p_lease_seconds?: number; p_limit?: number };
        Returns: {
          alerted_stale_at: string | null;
          attempt_count: number;
          canceled_at: string | null;
          claim_token: string | null;
          created_at: string;
          delivered_at: string | null;
          delivery_status: Database["public"]["Enums"]["email_delivery_status"];
          eligible_at: string;
          first_provider_attempt_at: string | null;
          idempotency_key: string;
          job_id: string;
          job_type: string;
          job_version: string;
          last_error_at: string | null;
          last_error_code: string | null;
          lead_plan_id: string;
          lease_expires_at: string | null;
          locked_at: string | null;
          manual_review_at: string | null;
          next_attempt_at: string | null;
          plan_version_id: string;
          provider_accepted_at: string | null;
          provider_key: string | null;
          provider_message_id: string | null;
          source_event_id: string | null;
          status: Database["public"]["Enums"]["email_job_status"];
          suppression_reason: string | null;
          template_version: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "email_jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_email_jobs_for_lead: {
        Args: {
          p_job_type: string;
          p_lead_plan_id: string;
          p_lease_seconds?: number;
          p_limit?: number;
        };
        Returns: {
          alerted_stale_at: string | null;
          attempt_count: number;
          canceled_at: string | null;
          claim_token: string | null;
          created_at: string;
          delivered_at: string | null;
          delivery_status: Database["public"]["Enums"]["email_delivery_status"];
          eligible_at: string;
          first_provider_attempt_at: string | null;
          idempotency_key: string;
          job_id: string;
          job_type: string;
          job_version: string;
          last_error_at: string | null;
          last_error_code: string | null;
          lead_plan_id: string;
          lease_expires_at: string | null;
          locked_at: string | null;
          manual_review_at: string | null;
          next_attempt_at: string | null;
          plan_version_id: string;
          provider_accepted_at: string | null;
          provider_key: string | null;
          provider_message_id: string | null;
          source_event_id: string | null;
          status: Database["public"]["Enums"]["email_job_status"];
          suppression_reason: string | null;
          template_version: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "email_jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      claim_production_email_jobs: {
        Args: {
          p_invocation_id: string;
          p_job_type: string;
          p_lease_seconds?: number;
          p_limit?: number;
        };
        Returns: Database["public"]["Tables"]["email_jobs"]["Row"][];
        SetofOptions: {
          from: "*";
          to: "email_jobs";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      commit_plan_version: {
        Args: {
          p_assessment: Json;
          p_consent_copy?: string;
          p_consent_version?: string;
          p_email_normalized?: string;
          p_email_original?: string;
          p_first_name?: string;
          p_lead_plan_id?: string;
          p_plan: Json;
          p_request_fingerprint: string;
          p_session_token_hash: string;
          p_submission_id: string;
        };
        Returns: {
          first_name: string;
          job_id: string;
          lead_plan_id: string;
          outcome: string;
          plan_version_id: string;
          replayed: boolean;
          source: string;
        }[];
      };
      accelerator_progress_state: {
        Args: { p_enrollment_id: string; p_program_version: string };
        Returns: {
          available_on: string | null;
          can_complete_current: boolean;
          completed_days: number[];
          current_day: number | null;
          program_completed: boolean;
          undo_day: number | null;
          undo_until: string | null;
        }[];
      };
      activate_lead_plan_atomic: {
        Args: { p_customer_id: string; p_lead_plan_id: string };
        Returns: {
          lead_plan_id: string;
          outcome: string;
          paused_enrollment_id: string | null;
        }[];
      };
      complete_accelerator_day_atomic: {
        Args: {
          p_day_number: number;
          p_enrollment_id: string;
          p_program_version: string;
        };
        Returns: {
          available_on: string | null;
          can_complete_current: boolean;
          completed_days: number[];
          current_day: number | null;
          newly_completed: boolean;
          program_completed: boolean;
          undo_day: number | null;
          undo_until: string | null;
        }[];
      };
      complete_plan_day_atomic: {
        Args: {
          p_day_number: number;
          p_lead_plan_id: string;
          p_plan_version_id: string;
        };
        Returns: {
          halfway_job_id: string;
          halfway_queued: boolean;
          required_completions: number;
        }[];
      };
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number };
        Returns: boolean;
      };
      authenticate_email_scheduler_invocation: {
        Args: {
          p_authenticated_at?: string;
          p_invocation_id: string;
          p_request_timestamp: string;
          p_secret_sha256: string;
        };
        Returns: string;
      };
      complete_production_provider_attempt: {
        Args: {
          p_completed_at: string;
          p_outcome: string;
          p_outcome_code?: string;
          p_provider_accepted_at?: string;
          p_provider_key?: string;
          p_provider_message_id?: string;
          p_submission_attempt_id: string;
        };
        Returns: boolean;
      };
      configure_email_production_scheduler: {
        Args: { p_url: string };
        Returns: Json;
      };
      count_production_eligible_email_jobs: { Args: never; Returns: number };
      create_email_production_cron: { Args: never; Returns: number };
      disable_email_production_sending: {
        Args: { p_reason: string };
        Returns: boolean;
      };
      email_delivery_rank: {
        Args: { p_status: Database["public"]["Enums"]["email_delivery_status"] };
        Returns: number;
      };
      email_production_warning_state: { Args: never; Returns: Json };
      enable_email_production_sending: { Args: never; Returns: boolean };
      establish_email_production_activation: { Args: never; Returns: Json };
      finish_email_job: {
        Args: {
          p_claim_token: string;
          p_event_name?: string;
          p_job_id: string;
          p_patch?: Json;
          p_status: Database["public"]["Enums"]["email_job_status"];
        };
        Returns: boolean;
      };
      finish_email_scheduler_invocation: {
        Args: {
          p_claimed_count: number;
          p_completed_at?: string;
          p_dispatch_succeeded: boolean;
          p_eligible_jobs_after: number;
          p_failure_code?: string;
          p_invocation_id: string;
          p_sending_enabled: boolean;
        };
        Returns: boolean;
      };
      invoke_email_dispatch_scheduler: { Args: never; Returns: string };
      mark_day_1_started: {
        Args: { p_lead_plan_id: string; p_plan_version_id: string };
        Returns: {
          newly_started: boolean;
          started_at: string;
        }[];
      };
      raise_stale_email_job_alerts: {
        Args: { p_cutoff: string; p_job_type: string };
        Returns: number;
      };
      pause_email_production_cron: { Args: never; Returns: boolean };
      pause_program_run_atomic: {
        Args: { p_customer_id: string; p_enrollment_id: string };
        Returns: Database["public"]["Tables"]["paid_program_enrollments"]["Row"][];
        SetofOptions: {
          from: "*";
          to: "paid_program_enrollments";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      provision_accelerator_ownership: {
        Args: {
          p_amount_cents: number;
          p_currency: string;
          p_customer_id: string;
          p_idempotency_key: string;
          p_product_code: string;
          p_purchase_source: string;
          p_purchased_at: string;
          p_request_fingerprint: string;
          p_source_reference: string;
        };
        Returns: {
          customer_id: string;
          entitlement_id: string;
          outcome: string;
          purchase_id: string;
          replayed: boolean;
        }[];
      };
      resume_program_run_atomic: {
        Args: { p_customer_id: string; p_enrollment_id: string };
        Returns: {
          enrollment_id: string;
          outcome: string;
          paused_enrollment_id: string | null;
          paused_lead_plan_id: string | null;
        }[];
      };
      record_accelerator_video_view_atomic: {
        Args: {
          p_day_number: number;
          p_enrollment_id: string;
          p_media_key: string;
          p_program_version: string;
        };
        Returns: Database["public"]["Tables"]["paid_program_video_views"]["Row"][];
        SetofOptions: {
          from: "*";
          to: "paid_program_video_views";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      request_plan_recovery: {
        Args: { p_email_normalized: string; p_request_id: string };
        Returns: undefined;
      };
      resolve_verified_customer_account: {
        Args: {
          p_auth_user_id: string;
          p_email_normalized: string;
          p_email_original: string;
          p_email_verified_at: string;
          p_first_name: string | null;
        };
        Returns: {
          customer_first_name: string | null;
          customer_id: string;
          linked_lead_plans: number;
          outcome: string;
          replayed: boolean;
        }[];
      };
      add_customer_measurement_atomic: {
        Args: {
          p_customer_id: string;
          p_enrollment_id: string | null;
          p_measured_at: string;
          p_measurement_context: string;
          p_measurement_kind: string;
          p_notes: string | null;
          p_unit: string;
          p_value: number;
        };
        Returns: Database["public"]["Tables"]["customer_measurements"]["Row"][];
        SetofOptions: {
          from: "*";
          to: "customer_measurements";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      correct_customer_measurement_atomic: {
        Args: {
          p_customer_id: string;
          p_measured_at: string;
          p_measurement_id: string;
          p_notes: string | null;
          p_unit: string;
          p_value: number;
        };
        Returns: Database["public"]["Tables"]["customer_measurements"]["Row"][];
        SetofOptions: {
          from: "*";
          to: "customer_measurements";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      remove_customer_measurement_atomic: {
        Args: { p_customer_id: string; p_measurement_id: string };
        Returns: { measurement_id: string; removed: boolean }[];
      };
      start_program_run_atomic: {
        Args: {
          p_customer_id: string;
          p_customer_time_zone: string;
          p_entitlement_id: string;
          p_program_snapshot: Json;
          p_program_version: string;
        };
        Returns: {
          enrollment_id: string;
          outcome: string;
          paused_enrollment_id: string | null;
          paused_lead_plan_id: string | null;
          run_number: number;
        }[];
      };
      undo_accelerator_day_atomic: {
        Args: {
          p_day_number: number;
          p_enrollment_id: string;
          p_program_version: string;
        };
        Returns: {
          available_on: string | null;
          can_complete_current: boolean;
          completed_days: number[];
          current_day: number | null;
          program_completed: boolean;
          undo_day: number | null;
          undo_until: string | null;
          undone: boolean;
        }[];
      };
      record_email_scheduler_auth_attempt: {
        Args: {
          p_attempted_at?: string;
          p_invocation_reference: string;
          p_result: string;
        };
        Returns: undefined;
      };
      set_email_production_controlled_plan: {
        Args: { p_lead_plan_id: string };
        Returns: boolean;
      };
      set_plan_email_consent: {
        Args: { p_active: boolean; p_lead_plan_id: string; p_source: string };
        Returns: boolean;
      };
    };
    Enums: {
      email_delivery_status: "pending" | "delivered" | "delayed" | "bounced" | "complained";
      email_job_status:
        | "pending"
        | "processing"
        | "retry_scheduled"
        | "provider_accepted"
        | "failed_permanent"
        | "suppressed"
        | "canceled"
        | "manual_review";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      email_delivery_status: ["pending", "delivered", "delayed", "bounced", "complained"],
      email_job_status: [
        "pending",
        "processing",
        "retry_scheduled",
        "provider_accepted",
        "failed_permanent",
        "suppressed",
        "canceled",
        "manual_review",
      ],
    },
  },
} as const;
