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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      canonical_events: {
        Row: {
          event_id: string
          event_name: string
          event_version: string
          job_id: string | null
          lead_plan_id: string | null
          occurred_at: string
          plan_version_id: string | null
          source: string | null
          submission_id: string | null
        }
        Insert: {
          event_id?: string
          event_name: string
          event_version?: string
          job_id?: string | null
          lead_plan_id?: string | null
          occurred_at?: string
          plan_version_id?: string | null
          source?: string | null
          submission_id?: string | null
        }
        Update: {
          event_id?: string
          event_name?: string
          event_version?: string
          job_id?: string | null
          lead_plan_id?: string | null
          occurred_at?: string
          plan_version_id?: string | null
          source?: string | null
          submission_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canonical_events_lead_plan_fk"
            columns: ["lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      email_jobs: {
        Row: {
          alerted_stale_at: string | null
          attempt_count: number
          canceled_at: string | null
          claim_token: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: Database["public"]["Enums"]["email_delivery_status"]
          eligible_at: string
          first_provider_attempt_at: string | null
          idempotency_key: string
          job_id: string
          job_type: string
          job_version: string
          last_error_at: string | null
          last_error_code: string | null
          lead_plan_id: string
          lease_expires_at: string | null
          locked_at: string | null
          manual_review_at: string | null
          next_attempt_at: string | null
          plan_version_id: string
          provider_accepted_at: string | null
          provider_key: string | null
          provider_message_id: string | null
          source_event_id: string | null
          status: Database["public"]["Enums"]["email_job_status"]
          suppression_reason: string | null
          template_version: string
          updated_at: string
        }
        Insert: {
          alerted_stale_at?: string | null
          attempt_count?: number
          canceled_at?: string | null
          claim_token?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: Database["public"]["Enums"]["email_delivery_status"]
          eligible_at?: string
          first_provider_attempt_at?: string | null
          idempotency_key: string
          job_id?: string
          job_type: string
          job_version?: string
          last_error_at?: string | null
          last_error_code?: string | null
          lead_plan_id: string
          lease_expires_at?: string | null
          locked_at?: string | null
          manual_review_at?: string | null
          next_attempt_at?: string | null
          plan_version_id: string
          provider_accepted_at?: string | null
          provider_key?: string | null
          provider_message_id?: string | null
          source_event_id?: string | null
          status?: Database["public"]["Enums"]["email_job_status"]
          suppression_reason?: string | null
          template_version: string
          updated_at?: string
        }
        Update: {
          alerted_stale_at?: string | null
          attempt_count?: number
          canceled_at?: string | null
          claim_token?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: Database["public"]["Enums"]["email_delivery_status"]
          eligible_at?: string
          first_provider_attempt_at?: string | null
          idempotency_key?: string
          job_id?: string
          job_type?: string
          job_version?: string
          last_error_at?: string | null
          last_error_code?: string | null
          lead_plan_id?: string
          lease_expires_at?: string | null
          locked_at?: string | null
          manual_review_at?: string | null
          next_attempt_at?: string | null
          plan_version_id?: string
          provider_accepted_at?: string | null
          provider_key?: string | null
          provider_message_id?: string | null
          source_event_id?: string | null
          status?: Database["public"]["Enums"]["email_job_status"]
          suppression_reason?: string | null
          template_version?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_jobs_lead_plan_id_fkey"
            columns: ["lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      email_preference_credentials: {
        Row: {
          credential_id: string
          issued_at: string
          lead_plan_id: string
          purpose: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          credential_id?: string
          issued_at?: string
          lead_plan_id: string
          purpose?: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          credential_id?: string
          issued_at?: string
          lead_plan_id?: string
          purpose?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_preference_credentials_lead_plan_id_fkey"
            columns: ["lead_plan_id"]
            isOneToOne: true
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      email_production_control: {
        Row: {
          activated_at: string | null
          activation_boundary: string | null
          controlled_lead_plan_id: string | null
          cron_job_id: number | null
          genuine_plans_admitted: boolean
          provider_submission_limit: number
          scheduler_configured_at: string | null
          scheduler_secret_sha256: string | null
          scheduler_url: string | null
          sending_enabled: boolean
          singleton_id: number
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          activation_boundary?: string | null
          controlled_lead_plan_id?: string | null
          cron_job_id?: number | null
          genuine_plans_admitted?: boolean
          provider_submission_limit?: number
          scheduler_configured_at?: string | null
          scheduler_secret_sha256?: string | null
          scheduler_url?: string | null
          sending_enabled?: boolean
          singleton_id?: number
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          activation_boundary?: string | null
          controlled_lead_plan_id?: string | null
          cron_job_id?: number | null
          genuine_plans_admitted?: boolean
          provider_submission_limit?: number
          scheduler_configured_at?: string | null
          scheduler_secret_sha256?: string | null
          scheduler_url?: string | null
          sending_enabled?: boolean
          singleton_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_production_control_controlled_lead_plan_id_fkey"
            columns: ["controlled_lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      email_provider_events: {
        Row: {
          event_kind: string | null
          event_type: string
          id: string
          job_id: string | null
          matched_at: string | null
          occurred_at: string | null
          provider_event_id: string
          provider_key: string
          provider_message_id: string | null
          received_at: string
          reconciled_at: string | null
          suppression: string | null
        }
        Insert: {
          event_kind?: string | null
          event_type: string
          id?: string
          job_id?: string | null
          matched_at?: string | null
          occurred_at?: string | null
          provider_event_id: string
          provider_key: string
          provider_message_id?: string | null
          received_at?: string
          reconciled_at?: string | null
          suppression?: string | null
        }
        Update: {
          event_kind?: string | null
          event_type?: string
          id?: string
          job_id?: string | null
          matched_at?: string | null
          occurred_at?: string | null
          provider_event_id?: string
          provider_key?: string
          provider_message_id?: string | null
          received_at?: string
          reconciled_at?: string | null
          suppression?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_provider_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      email_provider_submissions: {
        Row: {
          completed_at: string | null
          created_at: string
          idempotency_key: string
          invocation_id: string
          job_id: string
          job_type: string
          lead_plan_id: string
          outcome_code: string | null
          provider_accepted_at: string | null
          provider_key: string | null
          provider_message_id: string | null
          reserved_at: string
          status: string
          submission_attempt_id: string
          template_version: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          idempotency_key: string
          invocation_id: string
          job_id: string
          job_type: string
          lead_plan_id: string
          outcome_code?: string | null
          provider_accepted_at?: string | null
          provider_key?: string | null
          provider_message_id?: string | null
          reserved_at?: string
          status?: string
          submission_attempt_id?: string
          template_version: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          idempotency_key?: string
          invocation_id?: string
          job_id?: string
          job_type?: string
          lead_plan_id?: string
          outcome_code?: string | null
          provider_accepted_at?: string | null
          provider_key?: string | null
          provider_message_id?: string | null
          reserved_at?: string
          status?: string
          submission_attempt_id?: string
          template_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_provider_submissions_invocation_id_fkey"
            columns: ["invocation_id"]
            isOneToOne: false
            referencedRelation: "email_scheduler_invocations"
            referencedColumns: ["invocation_id"]
          },
          {
            foreignKeyName: "email_provider_submissions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "email_provider_submissions_lead_plan_id_fkey"
            columns: ["lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      email_scheduler_auth_attempts: {
        Row: {
          attempted_at: string
          id: string
          invocation_reference: string | null
          result: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          invocation_reference?: string | null
          result: string
        }
        Update: {
          attempted_at?: string
          id?: string
          invocation_reference?: string | null
          result?: string
        }
        Relationships: []
      }
      email_scheduler_invocations: {
        Row: {
          auth_deadline: string
          auth_result: string | null
          authenticated_at: string | null
          claimed_count: number
          completed_at: string | null
          created_at: string
          dispatch_succeeded: boolean | null
          eligible_jobs_after: number
          failure_code: string | null
          invocation_id: string
          invoked_at: string
          provider_accepted_count: number
          provider_attempt_count: number
          sending_enabled: boolean | null
          source: string
          transport_request_id: number | null
        }
        Insert: {
          auth_deadline: string
          auth_result?: string | null
          authenticated_at?: string | null
          claimed_count?: number
          completed_at?: string | null
          created_at?: string
          dispatch_succeeded?: boolean | null
          eligible_jobs_after?: number
          failure_code?: string | null
          invocation_id?: string
          invoked_at?: string
          provider_accepted_count?: number
          provider_attempt_count?: number
          sending_enabled?: boolean | null
          source?: string
          transport_request_id?: number | null
        }
        Update: {
          auth_deadline?: string
          auth_result?: string | null
          authenticated_at?: string | null
          claimed_count?: number
          completed_at?: string | null
          created_at?: string
          dispatch_succeeded?: boolean | null
          eligible_jobs_after?: number
          failure_code?: string | null
          invocation_id?: string
          invoked_at?: string
          provider_accepted_count?: number
          provider_attempt_count?: number
          sending_enabled?: boolean | null
          source?: string
          transport_request_id?: number | null
        }
        Relationships: []
      }
      email_suppressions: {
        Row: {
          created_at: string
          email_normalized: string
          id: string
          reason: string
          source: string
        }
        Insert: {
          created_at?: string
          email_normalized: string
          id?: string
          reason: string
          source?: string
        }
        Update: {
          created_at?: string
          email_normalized?: string
          id?: string
          reason?: string
          source?: string
        }
        Relationships: []
      }
      lead_plan_day_completions: {
        Row: {
          completed_at: string
          created_at: string
          day_number: number
          id: string
          lead_plan_id: string
          updated_at: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          day_number: number
          id?: string
          lead_plan_id: string
          updated_at?: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          day_number?: number
          id?: string
          lead_plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_plan_day_completions_lead_plan_id_fkey"
            columns: ["lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_plan_day_starts: {
        Row: {
          created_at: string
          day_number: number
          id: string
          lead_plan_id: string
          plan_version_id: string
          started_at: string
        }
        Insert: {
          created_at?: string
          day_number: number
          id?: string
          lead_plan_id: string
          plan_version_id: string
          started_at?: string
        }
        Update: {
          created_at?: string
          day_number?: number
          id?: string
          lead_plan_id?: string
          plan_version_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_plan_day_starts_lead_plan_id_fkey"
            columns: ["lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_plans: {
        Row: {
          access_token_hash: string | null
          assessment_json: Json
          consent_at: string
          consent_copy: string
          consent_granted: boolean
          consent_version: string
          created_at: string
          email_last_engaged_at: string | null
          email_normalized: string
          email_original: string
          email_suppressed_at: string | null
          email_suppression_reason: string | null
          email_verified_at: string | null
          first_name: string
          id: string
          marketing_consent_active: boolean
          marketing_consent_at: string | null
          marketing_consent_source: string | null
          marketing_unsubscribed_at: string | null
          plan_email_consent_active: boolean
          plan_email_consent_at: string | null
          plan_email_consent_source: string | null
          plan_email_unsubscribed_at: string | null
          plan_json: Json
          plan_version_id: string
          updated_at: string
        }
        Insert: {
          access_token_hash?: string | null
          assessment_json: Json
          consent_at: string
          consent_copy: string
          consent_granted: boolean
          consent_version: string
          created_at?: string
          email_last_engaged_at?: string | null
          email_normalized: string
          email_original: string
          email_suppressed_at?: string | null
          email_suppression_reason?: string | null
          email_verified_at?: string | null
          first_name: string
          id?: string
          marketing_consent_active?: boolean
          marketing_consent_at?: string | null
          marketing_consent_source?: string | null
          marketing_unsubscribed_at?: string | null
          plan_email_consent_active?: boolean
          plan_email_consent_at?: string | null
          plan_email_consent_source?: string | null
          plan_email_unsubscribed_at?: string | null
          plan_json: Json
          plan_version_id?: string
          updated_at?: string
        }
        Update: {
          access_token_hash?: string | null
          assessment_json?: Json
          consent_at?: string
          consent_copy?: string
          consent_granted?: boolean
          consent_version?: string
          created_at?: string
          email_last_engaged_at?: string | null
          email_normalized?: string
          email_original?: string
          email_suppressed_at?: string | null
          email_suppression_reason?: string | null
          email_verified_at?: string | null
          first_name?: string
          id?: string
          marketing_consent_active?: boolean
          marketing_consent_at?: string | null
          marketing_consent_source?: string | null
          marketing_unsubscribed_at?: string | null
          plan_email_consent_active?: boolean
          plan_email_consent_at?: string | null
          plan_email_consent_source?: string | null
          plan_email_unsubscribed_at?: string | null
          plan_json?: Json
          plan_version_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_sync_jobs: {
        Row: {
          attempt_count: number
          claim_token: string | null
          consent_at: string
          created_at: string
          first_provider_attempt_at: string | null
          idempotency_key: string
          job_id: string
          last_error_at: string | null
          last_error_code: string | null
          lead_plan_id: string
          lease_expires_at: string | null
          locked_at: string | null
          next_attempt_at: string | null
          provider_accepted_at: string | null
          provider_key: string | null
          provider_subscriber_id: string | null
          status: Database["public"]["Enums"]["marketing_sync_job_status"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          claim_token?: string | null
          consent_at: string
          created_at?: string
          first_provider_attempt_at?: string | null
          idempotency_key: string
          job_id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          lead_plan_id: string
          lease_expires_at?: string | null
          locked_at?: string | null
          next_attempt_at?: string | null
          provider_accepted_at?: string | null
          provider_key?: string | null
          provider_subscriber_id?: string | null
          status?: Database["public"]["Enums"]["marketing_sync_job_status"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          claim_token?: string | null
          consent_at?: string
          created_at?: string
          first_provider_attempt_at?: string | null
          idempotency_key?: string
          job_id?: string
          last_error_at?: string | null
          last_error_code?: string | null
          lead_plan_id?: string
          lease_expires_at?: string | null
          locked_at?: string | null
          next_attempt_at?: string | null
          provider_accepted_at?: string | null
          provider_key?: string | null
          provider_subscriber_id?: string | null
          status?: Database["public"]["Enums"]["marketing_sync_job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_sync_jobs_lead_plan_id_fkey"
            columns: ["lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_alerts: {
        Row: {
          alert_type: string
          created_at: string
          details: Json
          id: string
          job_id: string | null
          lead_plan_id: string | null
          resolved_at: string | null
          severity: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          details?: Json
          id?: string
          job_id?: string | null
          lead_plan_id?: string | null
          resolved_at?: string | null
          severity?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          details?: Json
          id?: string
          job_id?: string | null
          lead_plan_id?: string | null
          resolved_at?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_alerts_job_fk"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["job_id"]
          },
        ]
      }
      plan_access_sessions: {
        Row: {
          created_at: string
          id: string
          last_seen_at: string | null
          lead_plan_id: string
          plan_version_id: string
          revoked_at: string | null
          token_hash: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          lead_plan_id: string
          plan_version_id: string
          revoked_at?: string | null
          token_hash: string
        }
        Update: {
          created_at?: string
          id?: string
          last_seen_at?: string | null
          lead_plan_id?: string
          plan_version_id?: string
          revoked_at?: string | null
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_access_sessions_lead_plan_id_fkey"
            columns: ["lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_return_tokens: {
        Row: {
          expires_at: string
          issued_at: string
          job_id: string | null
          last_used_at: string | null
          lead_plan_id: string
          plan_version_id: string
          purpose: string
          revoked_at: string | null
          token_hash: string
          token_id: string
          use_count: number
        }
        Insert: {
          expires_at: string
          issued_at?: string
          job_id?: string | null
          last_used_at?: string | null
          lead_plan_id: string
          plan_version_id: string
          purpose?: string
          revoked_at?: string | null
          token_hash: string
          token_id?: string
          use_count?: number
        }
        Update: {
          expires_at?: string
          issued_at?: string
          job_id?: string | null
          last_used_at?: string | null
          lead_plan_id?: string
          plan_version_id?: string
          purpose?: string
          revoked_at?: string | null
          token_hash?: string
          token_id?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_return_tokens_job_fk"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "email_jobs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "plan_return_tokens_lead_plan_id_fkey"
            columns: ["lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_submissions: {
        Row: {
          created_at: string
          email_normalized: string | null
          job_id: string | null
          lead_plan_id: string
          plan_version_id: string
          request_fingerprint: string | null
          session_token_hash: string | null
          source: string
          submission_id: string
        }
        Insert: {
          created_at?: string
          email_normalized?: string | null
          job_id?: string | null
          lead_plan_id: string
          plan_version_id: string
          request_fingerprint?: string | null
          session_token_hash?: string | null
          source: string
          submission_id: string
        }
        Update: {
          created_at?: string
          email_normalized?: string | null
          job_id?: string | null
          lead_plan_id?: string
          plan_version_id?: string
          request_fingerprint?: string | null
          session_token_hash?: string | null
          source?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_submissions_lead_plan_id_fkey"
            columns: ["lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_counters: {
        Row: {
          attempts: number
          bucket_key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          attempts?: number
          bucket_key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          attempts?: number
          bucket_key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      return_link_sessions: {
        Row: {
          expires_at: string
          issued_at: string
          last_seen_at: string | null
          lead_plan_id: string
          plan_version_id: string
          revoked_at: string | null
          session_id: string
          session_token_hash: string
          token_id: string | null
        }
        Insert: {
          expires_at: string
          issued_at?: string
          last_seen_at?: string | null
          lead_plan_id: string
          plan_version_id: string
          revoked_at?: string | null
          session_id?: string
          session_token_hash: string
          token_id?: string | null
        }
        Update: {
          expires_at?: string
          issued_at?: string
          last_seen_at?: string | null
          lead_plan_id?: string
          plan_version_id?: string
          revoked_at?: string | null
          session_id?: string
          session_token_hash?: string
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_link_sessions_lead_plan_id_fkey"
            columns: ["lead_plan_id"]
            isOneToOne: false
            referencedRelation: "lead_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_link_sessions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "plan_return_tokens"
            referencedColumns: ["token_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admit_genuine_email_plans: { Args: never; Returns: boolean }
      apply_email_delivery_event: {
        Args: {
          p_job_id: string
          p_kind: Database["public"]["Enums"]["email_delivery_status"]
          p_occurred_at?: string
        }
        Returns: boolean
      }
      authenticate_email_scheduler_invocation: {
        Args: {
          p_authenticated_at?: string
          p_invocation_id: string
          p_request_timestamp: string
          p_secret_sha256: string
        }
        Returns: string
      }
      begin_marketing_sync_attempt: {
        Args: {
          p_attempted_at?: string
          p_claim_token: string
          p_job_id: string
        }
        Returns: string
      }
      begin_production_provider_attempt: {
        Args: {
          p_attempted_at: string
          p_claim_token: string
          p_invocation_id: string
          p_job_id: string
        }
        Returns: Json
      }
      begin_provider_attempt: {
        Args: {
          p_attempted_at: string
          p_claim_token: string
          p_job_id: string
        }
        Returns: string
      }
      cancel_unsent_proactive_jobs: {
        Args: { p_at: string; p_lead_plan_id: string }
        Returns: number
      }
      claim_email_jobs: {
        Args: { p_job_type: string; p_lease_seconds?: number; p_limit?: number }
        Returns: {
          alerted_stale_at: string | null
          attempt_count: number
          canceled_at: string | null
          claim_token: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: Database["public"]["Enums"]["email_delivery_status"]
          eligible_at: string
          first_provider_attempt_at: string | null
          idempotency_key: string
          job_id: string
          job_type: string
          job_version: string
          last_error_at: string | null
          last_error_code: string | null
          lead_plan_id: string
          lease_expires_at: string | null
          locked_at: string | null
          manual_review_at: string | null
          next_attempt_at: string | null
          plan_version_id: string
          provider_accepted_at: string | null
          provider_key: string | null
          provider_message_id: string | null
          source_event_id: string | null
          status: Database["public"]["Enums"]["email_job_status"]
          suppression_reason: string | null
          template_version: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_email_jobs_for_lead: {
        Args: {
          p_job_type: string
          p_lead_plan_id: string
          p_lease_seconds?: number
          p_limit?: number
        }
        Returns: {
          alerted_stale_at: string | null
          attempt_count: number
          canceled_at: string | null
          claim_token: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: Database["public"]["Enums"]["email_delivery_status"]
          eligible_at: string
          first_provider_attempt_at: string | null
          idempotency_key: string
          job_id: string
          job_type: string
          job_version: string
          last_error_at: string | null
          last_error_code: string | null
          lead_plan_id: string
          lease_expires_at: string | null
          locked_at: string | null
          manual_review_at: string | null
          next_attempt_at: string | null
          plan_version_id: string
          provider_accepted_at: string | null
          provider_key: string | null
          provider_message_id: string | null
          source_event_id: string | null
          status: Database["public"]["Enums"]["email_job_status"]
          suppression_reason: string | null
          template_version: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_marketing_sync_jobs: {
        Args: { p_lease_seconds?: number; p_limit?: number }
        Returns: {
          attempt_count: number
          claim_token: string | null
          consent_at: string
          created_at: string
          first_provider_attempt_at: string | null
          idempotency_key: string
          job_id: string
          last_error_at: string | null
          last_error_code: string | null
          lead_plan_id: string
          lease_expires_at: string | null
          locked_at: string | null
          next_attempt_at: string | null
          provider_accepted_at: string | null
          provider_key: string | null
          provider_subscriber_id: string | null
          status: Database["public"]["Enums"]["marketing_sync_job_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "marketing_sync_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_production_email_jobs: {
        Args: {
          p_invocation_id: string
          p_job_type: string
          p_lease_seconds?: number
          p_limit?: number
        }
        Returns: {
          alerted_stale_at: string | null
          attempt_count: number
          canceled_at: string | null
          claim_token: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: Database["public"]["Enums"]["email_delivery_status"]
          eligible_at: string
          first_provider_attempt_at: string | null
          idempotency_key: string
          job_id: string
          job_type: string
          job_version: string
          last_error_at: string | null
          last_error_code: string | null
          lead_plan_id: string
          lease_expires_at: string | null
          locked_at: string | null
          manual_review_at: string | null
          next_attempt_at: string | null
          plan_version_id: string
          provider_accepted_at: string | null
          provider_key: string | null
          provider_message_id: string | null
          source_event_id: string | null
          status: Database["public"]["Enums"]["email_job_status"]
          suppression_reason: string | null
          template_version: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "email_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      commit_plan_version: {
        Args: {
          p_assessment: Json
          p_consent_copy?: string
          p_consent_version?: string
          p_email_normalized?: string
          p_email_original?: string
          p_first_name?: string
          p_lead_plan_id?: string
          p_plan: Json
          p_request_fingerprint: string
          p_session_token_hash: string
          p_submission_id: string
        }
        Returns: {
          first_name: string
          job_id: string
          lead_plan_id: string
          outcome: string
          plan_version_id: string
          replayed: boolean
          source: string
        }[]
      }
      complete_plan_day_atomic: {
        Args: {
          p_day_number: number
          p_lead_plan_id: string
          p_plan_version_id: string
        }
        Returns: {
          halfway_job_id: string
          halfway_queued: boolean
          required_completions: number
        }[]
      }
      complete_production_provider_attempt: {
        Args: {
          p_completed_at: string
          p_outcome: string
          p_outcome_code?: string
          p_provider_accepted_at?: string
          p_provider_key?: string
          p_provider_message_id?: string
          p_submission_attempt_id: string
        }
        Returns: boolean
      }
      configure_email_production_scheduler: {
        Args: { p_url: string }
        Returns: Json
      }
      consume_rate_limit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      count_production_eligible_email_jobs: { Args: never; Returns: number }
      create_email_production_cron: { Args: never; Returns: number }
      disable_email_production_sending: {
        Args: { p_reason: string }
        Returns: boolean
      }
      email_delivery_rank: {
        Args: { p_status: Database["public"]["Enums"]["email_delivery_status"] }
        Returns: number
      }
      email_production_warning_state: { Args: never; Returns: Json }
      enable_email_production_sending: { Args: never; Returns: boolean }
      establish_email_production_activation: { Args: never; Returns: Json }
      finish_email_job: {
        Args: {
          p_claim_token: string
          p_event_name?: string
          p_job_id: string
          p_patch?: Json
          p_status: Database["public"]["Enums"]["email_job_status"]
        }
        Returns: boolean
      }
      finish_email_scheduler_invocation: {
        Args: {
          p_claimed_count: number
          p_completed_at?: string
          p_dispatch_succeeded: boolean
          p_eligible_jobs_after: number
          p_failure_code?: string
          p_invocation_id: string
          p_sending_enabled: boolean
        }
        Returns: boolean
      }
      finish_marketing_sync_job: {
        Args: {
          p_claim_token: string
          p_error_code?: string
          p_job_id: string
          p_next_attempt_at?: string
          p_provider_accepted_at?: string
          p_status: string
          p_subscriber_id?: string
        }
        Returns: boolean
      }
      invoke_email_dispatch_scheduler: { Args: never; Returns: string }
      mark_day_1_started: {
        Args: { p_lead_plan_id: string; p_plan_version_id: string }
        Returns: {
          newly_started: boolean
          started_at: string
        }[]
      }
      pause_email_production_cron: { Args: never; Returns: boolean }
      raise_stale_email_job_alerts: {
        Args: { p_cutoff: string; p_job_type: string }
        Returns: number
      }
      record_email_scheduler_auth_attempt: {
        Args: {
          p_attempted_at?: string
          p_invocation_reference: string
          p_result: string
        }
        Returns: undefined
      }
      request_plan_recovery: {
        Args: { p_email_normalized: string; p_request_id: string }
        Returns: undefined
      }
      set_email_production_controlled_plan: {
        Args: { p_lead_plan_id: string }
        Returns: boolean
      }
      set_plan_email_consent: {
        Args: { p_active: boolean; p_lead_plan_id: string; p_source: string }
        Returns: boolean
      }
    }
    Enums: {
      email_delivery_status:
        | "pending"
        | "delivered"
        | "delayed"
        | "bounced"
        | "complained"
      email_job_status:
        | "pending"
        | "processing"
        | "retry_scheduled"
        | "provider_accepted"
        | "failed_permanent"
        | "suppressed"
        | "canceled"
        | "manual_review"
      marketing_sync_job_status:
        | "pending"
        | "processing"
        | "retry_scheduled"
        | "provider_accepted"
        | "failed_permanent"
        | "suppressed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      email_delivery_status: [
        "pending",
        "delivered",
        "delayed",
        "bounced",
        "complained",
      ],
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
      marketing_sync_job_status: [
        "pending",
        "processing",
        "retry_scheduled",
        "provider_accepted",
        "failed_permanent",
        "suppressed",
      ],
    },
  },
} as const
