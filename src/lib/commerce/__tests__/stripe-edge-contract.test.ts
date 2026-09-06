import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const EDGE_FUNCTION = readFileSync(
  join(process.cwd(), "supabase", "functions", "accelerator-stripe", "index.ts"),
  "utf8",
);
const SUPABASE_CONFIG = readFileSync(join(process.cwd(), "supabase", "config.toml"), "utf8");
const COMMERCE_FUNCTIONS = readFileSync(
  join(process.cwd(), "src", "lib", "commerce", "functions.ts"),
  "utf8",
);
const SUCCESS_ROUTE = readFileSync(
  join(process.cwd(), "src", "routes", "checkout.accelerator.success.tsx"),
  "utf8",
);
const PROGRAM_ROUTE = readFileSync(
  join(process.cwd(), "src", "routes", "programs_.accelerator.tsx"),
  "utf8",
);
const GUEST_HANDOFF_MIGRATION = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260905190000_accelerator_guest_checkout_handoffs.sql",
  ),
  "utf8",
);

describe("Accelerator Stripe edge contract", () => {
  it("keeps every provider credential inside Lovable Cloud", () => {
    expect(EDGE_FUNCTION).toContain('env("STRIPE_SECRET_KEY")');
    expect(EDGE_FUNCTION).toContain('env("STRIPE_WEBHOOK_SECRET")');
    expect(EDGE_FUNCTION).toContain('env("STRIPE_ACCELERATOR_PRICE_ID")');
    expect(EDGE_FUNCTION).toContain('env("STRIPE_TEST_CUSTOMER_IDS")');
    expect(EDGE_FUNCTION).toContain('env("STRIPE_CHECKOUT_ENABLED")');
    expect(EDGE_FUNCTION).toContain('env("STRIPE_GUEST_CHECKOUT_ENABLED")');
  });

  it("rejects live Stripe keys and validates the locked offer", () => {
    expect(EDGE_FUNCTION).toContain("/^(sk|rk)_test_/");
    expect(EDGE_FUNCTION).toContain("price.unit_amount !== PRICE_CENTS");
    expect(EDGE_FUNCTION).toContain("price.livemode !== false");
    expect(EDGE_FUNCTION).toContain('metadata["genx_product_code"] !== PRODUCT_CODE');
    expect(EDGE_FUNCTION).toContain('metadata["genx_program_version"] !== PROGRAM_VERSION');
  });

  it("verifies provider signatures and provisions through the idempotent transaction", () => {
    expect(EDGE_FUNCTION).toContain("webhooks.constructEventAsync");
    expect(EDGE_FUNCTION).toContain('rpc("provision_accelerator_ownership"');
    expect(EDGE_FUNCTION).toContain("session.livemode !== false");
    expect(EDGE_FUNCTION).toContain('session.payment_status !== "paid"');
  });

  it("binds immediate guest access to the browser that opened the paid Checkout Session", () => {
    expect(EDGE_FUNCTION).toContain('genx_checkout_kind: "guest"');
    expect(EDGE_FUNCTION).toContain("genx_guest_claim_hash: claimHash");
    expect(EDGE_FUNCTION).toContain('stage = "validate_guest_claim"');
    expect(EDGE_FUNCTION).toContain("secretsMatch(suppliedHash, storedHash)");
    expect(EDGE_FUNCTION).toContain('type: "magiclink"');
    expect(EDGE_FUNCTION).toContain('rpc("resolve_verified_customer_account"');
    expect(COMMERCE_FUNCTIONS).toContain("const GUEST_CHECKOUT_CLAIM_COOKIE =");
    expect(COMMERCE_FUNCTIONS).toMatch(
      /setCookie\(GUEST_CHECKOUT_CLAIM_COOKIE, result\.claimToken, \{[\s\S]*?path: "\/"/,
    );
    expect(COMMERCE_FUNCTIONS).toContain("httpOnly: true");
    expect(COMMERCE_FUNCTIONS).toContain('sameSite: "lax"');
    expect(COMMERCE_FUNCTIONS).toMatch(
      /if \(result\.ok\) deleteCookie\(GUEST_CHECKOUT_CLAIM_COOKIE, \{ path: "\/" \}\)/,
    );
    expect(COMMERCE_FUNCTIONS).not.toContain('path: "/checkout/accelerator/success"');
    expect(SUCCESS_ROUTE).toContain("supabase.auth.verifyOtp");
    expect(SUCCESS_ROUTE).toContain("Set Up My Accelerator");
    expect(SUCCESS_ROUTE).not.toContain("Start Day 1");
    expect(GUEST_HANDOFF_MIGRATION).toContain(
      "CREATE TABLE public.accelerator_guest_checkout_handoffs",
    );
    expect(GUEST_HANDOFF_MIGRATION).toContain(
      "REVOKE ALL ON TABLE public.accelerator_guest_checkout_handoffs FROM PUBLIC, anon, authenticated",
    );
    expect(EDGE_FUNCTION).toContain('.from("accelerator_guest_checkout_handoffs")');
    expect(EDGE_FUNCTION).toContain('throw new Error("guest_handoff_pending")');
  });

  it("keeps the responsive program detail page separate from the catalog", () => {
    expect(PROGRAM_ROUTE).toContain('createFileRoute("/programs_/accelerator")');
    expect(PROGRAM_ROUTE).toContain("Get the 28-Day Accelerator");
    expect(PROGRAM_ROUTE).toContain("lg:grid-cols-");
    expect(PROGRAM_ROUTE).toMatch(/Buying creates your[\s\S]*access but does not start Day 1\./);
  });

  it("authenticates the app proxy independently of Supabase JWT verification", () => {
    expect(EDGE_FUNCTION).toContain("secretsMatch(bearer(request), config.serviceRoleKey)");
    expect(SUPABASE_CONFIG).toContain("[functions.accelerator-stripe]");
    expect(SUPABASE_CONFIG).toMatch(/\[functions\.accelerator-stripe\][\s\S]*verify_jwt = false/);
  });

  it("logs safe failure codes without logging payment or identity payloads", () => {
    expect(EDGE_FUNCTION).toContain('event: "request_failed"');
    expect(EDGE_FUNCTION).toContain("reason: safeFailureReason(error)");
    expect(EDGE_FUNCTION).toContain('providerCode: safeToken(record["code"])');
    expect(EDGE_FUNCTION).not.toContain("console.log");
    expect(EDGE_FUNCTION).not.toMatch(/console\.error\([^)]*(sessionId|rawBody|signature|email)/s);
  });

  it("returns only safe fulfillment diagnostics to the test webhook caller", () => {
    expect(EDGE_FUNCTION).toContain("class FulfillmentFailure extends Error");
    expect(EDGE_FUNCTION).toContain("new FulfillmentFailure(stage, reason)");
    expect(EDGE_FUNCTION).toContain(
      '{ error: "fulfillment_failed", stage: failure.stage, reason: failure.reason }',
    );
    expect(EDGE_FUNCTION).toContain('"line_items_mismatch"');
  });
});
