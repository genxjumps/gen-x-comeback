import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import {
  ACCELERATOR_OFFER,
  ACCELERATOR_PRODUCT_CODE,
  ACCELERATOR_PROGRAM_VERSION,
  buildAcceleratorProgramSnapshot,
} from "@/lib/accelerator/program";

export type ProvisionAcceleratorInput = {
  idempotencyKey: string;
  email: string;
  firstName: string;
  purchaseSource: string;
  sourceReference: string;
  purchasedAt: string;
  /** Caller-generated opaque credential retained across an exact retry. */
  rawAccessToken: string;
};

const provisionInputSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(255),
  email: z.string().trim().email().max(254),
  firstName: z.string().trim().min(1).max(60),
  purchaseSource: z.string().trim().min(1).max(100),
  sourceReference: z.string().trim().min(1).max(255),
  purchasedAt: z.string().datetime({ offset: true }),
  rawAccessToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

function fingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

/**
 * Trusted server-only activation boundary for a future verified paid purchase.
 * It is deliberately not exposed through a route or client-callable server fn.
 */
export async function provisionAcceleratorEnrollment(input: ProvisionAcceleratorInput) {
  const parsed = provisionInputSchema.parse(input);
  const emailOriginal = parsed.email;
  const emailNormalized = emailOriginal.toLowerCase();
  const firstName = parsed.firstName;
  const rawAccessToken = parsed.rawAccessToken;
  const accessTokenHash = createHash("sha256").update(rawAccessToken).digest("hex");
  const snapshot = buildAcceleratorProgramSnapshot();
  const requestFingerprint = fingerprint([
    parsed.idempotencyKey,
    emailNormalized,
    firstName,
    parsed.purchaseSource,
    parsed.sourceReference,
    parsed.purchasedAt,
    ACCELERATOR_PRODUCT_CODE,
    String(ACCELERATOR_OFFER.priceCents),
    ACCELERATOR_PROGRAM_VERSION,
    JSON.stringify(snapshot),
    accessTokenHash,
  ]);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("provision_accelerator_enrollment", {
    p_idempotency_key: parsed.idempotencyKey,
    p_request_fingerprint: requestFingerprint,
    p_email_normalized: emailNormalized,
    p_email_original: emailOriginal,
    p_first_name: firstName,
    p_purchase_source: parsed.purchaseSource,
    p_source_reference: parsed.sourceReference,
    p_purchased_at: parsed.purchasedAt,
    p_product_code: ACCELERATOR_PRODUCT_CODE,
    p_amount_cents: ACCELERATOR_OFFER.priceCents,
    p_currency: ACCELERATOR_OFFER.currency,
    p_program_version: ACCELERATOR_PROGRAM_VERSION,
    p_program_snapshot: snapshot,
    p_access_token_hash: accessTokenHash,
  });
  if (error) throw new Error(error.message);
  const row = rows?.[0];
  if (!row || !["created", "replayed"].includes(row.outcome)) {
    throw new Error("Accelerator enrollment provisioning was rejected");
  }

  return { enrollmentId: row.enrollment_id, rawAccessToken, replayed: row.replayed };
}

/** Creates a credential once. The trusted caller must reuse it on an exact retry. */
export function generateAcceleratorAccessToken(): string {
  return randomBytes(32).toString("base64url");
}
