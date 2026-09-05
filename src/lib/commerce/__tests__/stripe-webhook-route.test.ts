import { beforeEach, describe, expect, it, vi } from "vitest";

const readConfig = vi.fn();
const constructEvent = vi.fn();
const fulfill = vi.fn();

vi.mock("@/lib/commerce/stripe-config.server", () => ({
  readStripeCheckoutConfig: readConfig,
}));

vi.mock("@/lib/commerce/stripe-checkout.server", () => ({
  constructStripeWebhookEvent: constructEvent,
  fulfillAcceleratorCheckout: fulfill,
}));

type Handler = (ctx: { request: Request }) => Promise<Response>;

async function post(signature?: string): Promise<Response> {
  const mod = await import("@/routes/api/public/stripe/webhook");
  const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
  const server = options["server"] as { handlers: Record<string, Handler> };
  return server.handlers.POST({
    request: new Request("https://app.genxjumps.com/api/public/stripe/webhook", {
      method: "POST",
      headers: signature ? { "stripe-signature": signature } : {},
      body: "raw-provider-body",
    }),
  });
}

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.resetModules();
    readConfig.mockReset().mockReturnValue({ webhookSecret: "whsec_test" });
    constructEvent.mockReset().mockResolvedValue({
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_verified" } },
    });
    fulfill.mockReset().mockResolvedValue({ replayed: false });
  });

  it("rejects a request without a Stripe signature before parsing the body", async () => {
    expect((await post()).status).toBe(400);
    expect(constructEvent).not.toHaveBeenCalled();
  });

  it("rejects an invalid signed event without attempting fulfillment", async () => {
    constructEvent.mockRejectedValue(new Error("invalid signature"));
    expect((await post("bad-signature")).status).toBe(400);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it("acknowledges unrelated signed events without provisioning", async () => {
    constructEvent.mockResolvedValue({ type: "payment_intent.created", data: { object: {} } });
    const response = await post("signed");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, handled: false });
    expect(fulfill).not.toHaveBeenCalled();
  });

  it("fulfills a verified Checkout Session by its provider ID", async () => {
    const response = await post("signed");
    expect(response.status).toBe(200);
    expect(fulfill).toHaveBeenCalledWith({
      config: { webhookSecret: "whsec_test" },
      sessionId: "cs_test_verified",
    });
    expect(await response.json()).toEqual({ received: true, handled: true, replayed: false });
  });

  it("returns a retryable failure when durable fulfillment fails", async () => {
    fulfill.mockRejectedValue(new Error("database unavailable"));
    expect((await post("signed")).status).toBe(500);
  });
});
