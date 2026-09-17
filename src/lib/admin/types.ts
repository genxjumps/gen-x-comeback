import type { AdminCustomerProgress } from "@/lib/admin/customer-progress";

export type PrivateCustomerProgressResult =
  | { ok: true; customers: AdminCustomerProgress[]; generatedAt: string }
  | { ok: false };
