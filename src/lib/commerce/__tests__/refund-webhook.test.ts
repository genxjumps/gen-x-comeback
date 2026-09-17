import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, it, expect, vi } from "vitest";
import { reconcileStripeRefund } from "../../../../supabase/functions/accelerator-stripe/refunds";
// Execute the actual Edge handler with in-memory SDK boundaries and verified-event
// fixtures. No live Stripe signature, remote service, or payment API is invoked.
const source = readFileSync("supabase/functions/accelerator-stripe/index.ts", "utf8").replace(
  /^import .*;\n/gm,
  "",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
function setup(eventType = "charge.refunded", status = "succeeded") {
  let handler!: (request: Request) => Promise<Response>;
  const rpc = vi.fn(
    async (): Promise<{ data: Record<string, unknown>; error: unknown }> => ({
      data: { outcome: "refunded" },
      error: null,
    }),
  );
  const event = {
    type: eventType,
    livemode: false,
    data: { object: { id: eventType === "charge.refunded" ? "ch_one" : "re_one" } },
  };
  const construct = vi.fn(async () => event);
  const provider = {
    webhooks: { constructEventAsync: construct },
    charges: {
      retrieve: vi.fn(async () => ({
        id: "ch_one",
        livemode: false,
        paid: true,
        amount: 3700,
        currency: "usd",
        payment_intent: "pi_one",
      })),
    },
    checkout: {
      sessions: {
        retrieve: vi.fn(async () => ({
          id: "cs_test_one",
          livemode: false,
          mode: "payment",
          status: "complete",
          payment_status: "paid",
          amount_total: 3700,
          currency: "usd",
          client_reference_id: "00000000-0000-4000-8000-000000000001",
          metadata: {
            customer_account_id: "00000000-0000-4000-8000-000000000001",
            genx_product_code: "accelerator_28",
            genx_program_version: "accelerator_28_v1",
          },
          payment_intent: {
            id: "pi_one",
            latest_charge: { id: "ch_one", paid: true, created: 1770000000, amount_refunded: 0 },
          },
          line_items: {
            data: [
              {
                quantity: 1,
                price: {
                  id: "price_fixture",
                  livemode: false,
                  active: true,
                  type: "one_time",
                  unit_amount: 3700,
                  currency: "usd",
                  product: {
                    metadata: {
                      genx_product_code: "accelerator_28",
                      genx_program_version: "accelerator_28_v1",
                    },
                  },
                },
              },
            ],
          },
        })),
        list: vi.fn(async () => ({
          has_more: false,
          data: [
            {
              id: "cs_test_one",
              livemode: false,
              mode: "payment",
              payment_status: "paid",
              amount_total: 3700,
              currency: "usd",
              payment_intent: "pi_one",
              metadata: {
                genx_product_code: "accelerator_28",
                genx_program_version: "accelerator_28_v1",
              },
            },
          ],
        })),
      },
    },
    refunds: {
      retrieve: vi.fn(async () => ({ id: "re_one", charge: "ch_one" })),
      list: () =>
        (async function* () {
          yield { id: "re_one", charge: "ch_one", amount: 3700, currency: "usd", status };
        })(),
    },
  };
  const values: Record<string, string> = {
    STRIPE_CHECKOUT_ENABLED: "false",
    STRIPE_SECRET_KEY: "sk_test_fixture",
    STRIPE_WEBHOOK_SECRET: "whsec_fixture",
    STRIPE_ACCELERATOR_PRICE_ID: "price_fixture",
    APP_ORIGIN: "https://app.example.test",
    SUPABASE_URL: "https://db.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture",
  };
  const Stripe = function () {
    return provider;
  };
  new Function("createClient", "Stripe", "reconcileStripeRefund", "Deno", compiled)(
    () => ({ rpc }),
    Stripe,
    reconcileStripeRefund,
    {
      env: { get: (n: string) => values[n] },
      serve: (h: typeof handler) => {
        handler = h;
      },
    },
  );
  const send = (auth = "sb_secret_fixture") =>
    handler(
      new Request("https://edge.example.test", {
        method: "POST",
        headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" },
        body: JSON.stringify({
          action: "webhook",
          rawBody: "signed-body",
          signature: "signature-fixture",
        }),
      }),
    );
  return { send, rpc, construct, event, provider, values };
}
describe("refund Edge webhook dispatch", () => {
  it("acknowledges checkout webhook replay for a refunded purchase without restoring access", async () => {
    const f = setup("checkout.session.completed");
    f.values.STRIPE_CHECKOUT_ENABLED = "true";
    f.values.STRIPE_TEST_CUSTOMER_IDS = "00000000-0000-4000-8000-000000000001";
    f.event.data.object.id = "cs_test_one";
    f.rpc.mockResolvedValue({
      data: [{ outcome: "refunded_or_inactive" }] as unknown as Record<string, unknown>,
      error: null,
    });
    expect(await (await f.send()).json()).toEqual({
      received: true,
      handled: true,
      replayed: true,
    });
    expect(f.rpc).toHaveBeenCalledTimes(1);
  });
  it("reconciles a full refund discovered during delayed checkout fulfillment", async () => {
    const f = setup("checkout.session.completed");
    f.values.STRIPE_CHECKOUT_ENABLED = "true";
    f.values.STRIPE_TEST_CUSTOMER_IDS = "00000000-0000-4000-8000-000000000001";
    f.event.data.object.id = "cs_test_one";
    const session = await f.provider.checkout.sessions.retrieve();
    session.payment_intent.latest_charge.amount_refunded = 3700;
    f.provider.checkout.sessions.retrieve.mockResolvedValue(session);
    f.rpc.mockResolvedValueOnce({
      data: [
        {
          outcome: "created",
          entitlement_id: "00000000-0000-4000-8000-000000000002",
          replayed: false,
        },
      ] as unknown as Record<string, unknown>,
      error: null,
    });
    expect(await (await f.send()).json()).toEqual({
      received: true,
      handled: true,
      replayed: true,
    });
    expect(f.rpc).toHaveBeenNthCalledWith(
      2,
      "confirm_accelerator_full_refund",
      expect.objectContaining({ p_source_reference: "cs_test_one" }),
    );
  });
  it.each(["charge.refunded", "refund.created", "refund.updated", "refund.failed"])(
    "re-reads provider state for %s even when checkout is closed",
    async (eventType) => {
      const f = setup(eventType);
      const response = await f.send();
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        received: true,
        handled: true,
        outcome: "refunded",
      });
      expect(f.construct).toHaveBeenCalledWith("signed-body", "signature-fixture", "whsec_fixture");
      expect(f.rpc).toHaveBeenCalledWith(
        "confirm_accelerator_full_refund",
        expect.objectContaining({ p_source_reference: "cs_test_one" }),
      );
    },
  );
  it("keeps a pending refund from changing the database", async () => {
    const f = setup("refund.updated", "pending");
    expect((await f.send()).status).toBe(200);
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("returns 500 so Stripe retries a refund received before the purchase", async () => {
    const f = setup();
    f.rpc.mockResolvedValue({ data: { outcome: "purchase_pending" }, error: null });
    expect((await f.send()).status).toBe(500);
  });
  it("does not acknowledge a database failure", async () => {
    const f = setup();
    f.rpc.mockRejectedValue(Error("offline"));
    expect((await f.send()).status).toBe(500);
  });
  it("requires the app proxy service credential", async () => {
    const f = setup();
    expect((await f.send("wrong")).status).toBe(401);
    expect(f.construct).not.toHaveBeenCalled();
    expect(f.rpc).not.toHaveBeenCalled();
  });
  it("rejects invalid signatures before provider reads", async () => {
    const f = setup();
    f.construct.mockRejectedValue(Error("bad signature"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await f.send()).status).toBe(400);
      expect(f.provider.charges.retrieve).not.toHaveBeenCalled();
      expect(f.rpc).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
  it("rejects live events", async () => {
    const f = setup();
    f.event.livemode = true;
    expect((await f.send()).status).toBe(400);
    expect(f.rpc).not.toHaveBeenCalled();
  });
});
