import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { RefundRpcArgs } from "@/integrations/supabase/refunds.types";

const purchaseSchema = z.object({
  purchaseId: z.string().uuid(),
  purchasedAt: z.string(),
  deadline: z.string(),
  purchaseStatus: z.enum(["paid", "refunded", "disputed", "canceled"]),
  requestedAt: z.string().nullable(),
  refundedAt: z.string().nullable(),
  canRequest: z.boolean(),
});
const queueSchema = z.object({
  requestId: z.string().uuid(),
  purchaseId: z.string().uuid(),
  customerEmail: z.string(),
  requestedAt: z.string(),
  deadline: z.string(),
  status: z.enum(["requested", "refunded"]),
  refundedAt: z.string().nullable(),
  checkoutSessionId: z.string(),
});
export type RefundPurchase = z.infer<typeof purchaseSchema>;
export type RefundQueueItem = z.infer<typeof queueSchema>;
export type RefundPurchasesResult = { ok: true; purchases: RefundPurchase[] } | { ok: false };
export type RefundQueueResult = { ok: true; requests: RefundQueueItem[] } | { ok: false };

async function customer() {
  const { currentAuthorizationHeader, resolveCustomerAccount } =
    await import("@/lib/account/customer-account.server");
  const result = await resolveCustomerAccount(await currentAuthorizationHeader());
  return result.ok ? result.account.id : null;
}
async function rpc<K extends keyof RefundRpcArgs>(name: K, args: RefundRpcArgs[K]) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Generated from the isolated migration replay; no mutation of generated baseline types.
  const client = supabaseAdmin as unknown as {
    rpc(name: K, args: RefundRpcArgs[K]): PromiseLike<{ data: unknown; error: unknown }>;
  };
  const result = await client.rpc(name, args);
  if (result.error) throw new Error("Refund service unavailable");
  return result.data;
}
export const getRefundPurchases = createServerFn({ method: "POST" }).handler(
  async (): Promise<RefundPurchasesResult> => {
    try {
      const id = await customer();
      if (!id) return { ok: false };
      const data = await rpc("get_accelerator_refund_purchases", { p_customer_id: id });
      return { ok: true, purchases: z.array(purchaseSchema).parse(data) };
    } catch {
      return { ok: false };
    }
  },
);
const inputSchema = z.object({ purchaseId: z.string().uuid() }).strict();
export const requestAcceleratorRefund = createServerFn({ method: "POST" })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      const id = await customer();
      if (!id) return { outcome: "unavailable" as const };
      return z
        .object({
          outcome: z.enum(["received", "refunded", "ineligible", "unavailable"]),
          requestId: z.string().uuid().optional(),
        })
        .parse(
          await rpc("request_accelerator_refund", {
            p_customer_id: id,
            p_purchase_id: data.purchaseId,
          }),
        );
    } catch {
      return { outcome: "unavailable" as const };
    }
  });
export const getRefundQueue = createServerFn({ method: "POST" }).handler(
  async (): Promise<RefundQueueResult> => {
    try {
      const id = await customer();
      if (!id) return { ok: false };
      const data = await rpc("get_accelerator_refund_queue", { p_reviewer_id: id });
      if (data === null) return { ok: false };
      return { ok: true, requests: z.array(queueSchema).parse(data) };
    } catch {
      return { ok: false };
    }
  },
);
