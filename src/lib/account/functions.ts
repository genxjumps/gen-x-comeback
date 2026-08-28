import { createServerFn } from "@tanstack/react-start";

import type { CustomerAccountResult } from "@/lib/account/types";

/**
 * Private source-level account bootstrap. No public screen invokes this until
 * the later platform-shell checkpoint deliberately opens that path.
 */
export const getOrCreateCustomerAccount = createServerFn({ method: "POST" }).handler(
  async (): Promise<CustomerAccountResult> => {
    const { currentAuthorizationHeader, resolveCustomerAccount } =
      await import("@/lib/account/customer-account.server");
    return resolveCustomerAccount(await currentAuthorizationHeader());
  },
);
