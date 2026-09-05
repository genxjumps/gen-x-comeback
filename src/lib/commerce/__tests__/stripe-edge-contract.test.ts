import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const EDGE_FUNCTION = readFileSync(
  join(process.cwd(), "supabase", "functions", "accelerator-stripe", "index.ts"),
  "utf8",
);
const SUPABASE_CONFIG = readFileSync(join(process.cwd(), "supabase", "config.toml"), "utf8");

describe("Accelerator Stripe edge contract", () => {
  it("keeps every provider credential inside Lovable Cloud", () => {
    expect(EDGE_FUNCTION).toContain('env("STRIPE_SECRET_KEY")');
    expect(EDGE_FUNCTION).toContain('env("STRIPE_WEBHOOK_SECRET")');
    expect(EDGE_FUNCTION).toContain('env("STRIPE_ACCELERATOR_PRICE_ID")');
    expect(EDGE_FUNCTION).toContain('env("STRIPE_TEST_CUSTOMER_IDS")');
    expect(EDGE_FUNCTION).toContain('env("STRIPE_CHECKOUT_ENABLED")');
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
    expect(EDGE_FUNCTION).toContain("new FulfillmentFailure(stage, safeFailureReason(error))");
    expect(EDGE_FUNCTION).toContain(
      '{ error: "fulfillment_failed", stage: failure.stage, reason: failure.reason }',
    );
    expect(EDGE_FUNCTION).toContain('"line_items_mismatch"');
  });
});
