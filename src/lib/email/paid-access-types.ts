import type { EmailDeliveryStatus, EmailJobStatus } from "@/lib/email/types";

export type PaidAccessJobRow = {
  job_id: string;
  job_type: "paid_purchase_access" | "paid_recovery";
  job_version: "v1";
  template_version: "paid_access_v1";
  customer_id: string;
  entitlement_id: string | null;
  idempotency_key: string;
  eligible_at: string;
  status: EmailJobStatus;
  delivery_status: EmailDeliveryStatus;
  attempt_count: number;
  next_attempt_at: string | null;
  locked_at: string | null;
  lease_expires_at: string | null;
  claim_token: string | null;
  first_provider_attempt_at: string | null;
  provider_key: string | null;
  provider_message_id: string | null;
  provider_accepted_at: string | null;
  delivered_at: string | null;
  last_error_code: string | null;
  last_error_at: string | null;
  canceled_at: string | null;
  suppression_reason: string | null;
  manual_review_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaidAccessCustomer = {
  id: string;
  auth_user_id: string;
  email_original: string;
  email_normalized: string;
};

export type PaidAccessJobPatch = {
  next_attempt_at?: string | null;
  provider_key?: string | null;
  provider_message_id?: string | null;
  provider_accepted_at?: string | null;
  last_error_code?: string | null;
  last_error_at?: string | null;
  suppression_reason?: string | null;
  canceled_at?: string | null;
  manual_review_at?: string | null;
};
