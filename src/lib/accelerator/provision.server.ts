import { createHash } from "node:crypto";
import { z } from "zod";

import { ACCELERATOR_OFFER, ACCELERATOR_PRODUCT_CODE } from "@/lib/accelerator/program";

export type ProvisionAcceleratorOwnershipInput = {
  customerAccountId: string;
  idempotencyKey: string;
  purchaseSource: string;
  sourceReference: string;
  purchasedAt: string;
};

const provisionInputSchema = z.object({
  customerAccountId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(1).max(255),
  purchaseSource: z.string().trim().min(1).max(100),
  sourceReference: z.string().trim().min(1).max(255),
  purchasedAt: z.string().datetime({ offset: true }),
});

function fingerprint(parts: string[]): string {
  return createHash("sha256").update(parts.join("\u0000")).digest("hex");
}

/**
 * Trusted server-only boundary for a future independently verified purchase.
 * It records permanent ownership. It does not create a program run, start Day
 * 1, send email, or expose a public checkout route.
 */
export async function provisionAcceleratorOwnership(input: ProvisionAcceleratorOwnershipInput) {
  const parsed = provisionInputSchema.parse(input);
  const requestFingerprint = fingerprint([
    parsed.idempotencyKey,
    parsed.customerAccountId,
    parsed.purchaseSource,
    parsed.sourceReference,
    parsed.purchasedAt,
    ACCELERATOR_PRODUCT_CODE,
    String(ACCELERATOR_OFFER.priceCents),
    ACCELERATOR_OFFER.currency,
  ]);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin.rpc("provision_accelerator_ownership", {
    p_customer_id: parsed.customerAccountId,
    p_idempotency_key: parsed.idempotencyKey,
    p_request_fingerprint: requestFingerprint,
    p_purchase_source: parsed.purchaseSource,
    p_source_reference: parsed.sourceReference,
    p_purchased_at: parsed.purchasedAt,
    p_product_code: ACCELERATOR_PRODUCT_CODE,
    p_amount_cents: ACCELERATOR_OFFER.priceCents,
    p_currency: ACCELERATOR_OFFER.currency,
  });
  if (error) throw new Error(error.message);
  const row = rows?.[0];
  if (!row || !["created", "replayed"].includes(row.outcome)) {
    throw new Error("Accelerator ownership provisioning was rejected");
  }

  return {
    purchaseId: row.purchase_id,
    entitlementId: row.entitlement_id,
    replayed: row.replayed,
  };
}
