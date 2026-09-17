import { beforeEach, describe, expect, it, vi } from "vitest";

const forwardWebhook = vi.fn();

vi.mock("@/lib/commerce/stripe-edge.server", () => ({
  forwardStripeWebhookToEdge: forwardWebhook,
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
    forwardWebhook
      .mockReset()
      .mockResolvedValue(Response.json({ received: true, handled: true, replayed: false }));
  });

  it("rejects a request without a Stripe signature before parsing the body", async () => {
    expect((await post()).status).toBe(400);
    expect(forwardWebhook).not.toHaveBeenCalled();
  });

  it("forwards the exact signed provider body to the secret-bearing edge function", async () => {
    const response = await post("signed");
    expect(response.status).toBe(200);
    expect(forwardWebhook).toHaveBeenCalledWith({
      rawBody: "raw-provider-body",
      signature: "signed",
    });
    expect(await response.json()).toEqual({ received: true, handled: true, replayed: false });
  });

  it("preserves the edge status so Stripe retries transient failures", async () => {
    forwardWebhook.mockResolvedValue(Response.json({ error: "edge_failure" }, { status: 503 }));
    expect((await post("signed")).status).toBe(503);
  });
});
