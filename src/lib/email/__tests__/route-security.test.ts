// Route-level security tests for the checkpoint hardening.
// Deterministic: no provider, database, or network calls. The dispatch route's
// runtime gate is exercised with an intentionally incomplete email config, so
// no adapter is ever constructed and no store is ever created.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const exchangeReturnToken = vi.fn(async () => ({ ok: false }) as { ok: boolean });

vi.mock("@/lib/email/return-exchange.server", () => ({
  exchangeReturnToken: (...args: unknown[]) =>
    exchangeReturnToken(...(args as [])) as Promise<{ ok: boolean }>,
}));

type Handler = (ctx: { request: Request }) => Promise<Response>;

async function handlerFor(
  modulePath: "dispatch" | "return",
  method: "GET" | "POST",
): Promise<Handler> {
  const mod =
    modulePath === "dispatch"
      ? await import("@/routes/api/public/email/dispatch")
      : await import("@/routes/return");
  const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
  const server = options["server"] as { handlers: Record<string, Handler> };
  const handler = server.handlers[method];
  if (!handler) throw new Error(`missing ${method} handler`);
  return handler;
}

const DISPATCH_URL = "https://app.genxjumps.com/api/public/email/dispatch";
const SECRET = "dispatch-secret-value-0123456789";

describe("POST /api/public/email/dispatch authorization", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env["EMAIL_DISPATCH_SECRET"];
    delete process.env["SUPABASE_ANON_KEY"];
    // Keep the sending gate incomplete so authorization is the only variable.
    delete process.env["EMAIL_SENDING_ENABLED"];
  });

  afterEach(() => {
    process.env = { ...original };
  });

  async function post(headers: Record<string, string>): Promise<Response> {
    const handler = await handlerFor("dispatch", "POST");
    return handler({ request: new Request(DISPATCH_URL, { method: "POST", headers }) });
  }

  it("rejects when the server secret is not configured", async () => {
    const res = await post({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(401);
  });

  it("rejects when no authorization header is present", async () => {
    process.env["EMAIL_DISPATCH_SECRET"] = SECRET;
    expect((await post({})).status).toBe(401);
  });

  it("rejects malformed and non-Bearer authorization headers", async () => {
    process.env["EMAIL_DISPATCH_SECRET"] = SECRET;
    for (const value of [SECRET, `Basic ${SECRET}`, "Bearer", "Bearer ", `bearer${SECRET}`]) {
      expect((await post({ authorization: value })).status).toBe(401);
    }
  });

  it("rejects a wrong bearer secret", async () => {
    process.env["EMAIL_DISPATCH_SECRET"] = SECRET;
    expect((await post({ authorization: "Bearer not-the-secret" })).status).toBe(401);
  });

  it("no longer accepts Supabase anon or publishable keys", async () => {
    process.env["EMAIL_DISPATCH_SECRET"] = SECRET;
    process.env["SUPABASE_ANON_KEY"] = "anon-key-value";
    process.env["SUPABASE_PUBLISHABLE_KEY"] = "sb_publishable_test";
    for (const key of ["anon-key-value", "sb_publishable_test"]) {
      expect((await post({ authorization: `Bearer ${key}` })).status).toBe(401);
      expect((await post({ apikey: key })).status).toBe(401);
    }
  });

  it("rejects apikey-only authorization even when it carries the dispatch secret", async () => {
    process.env["EMAIL_DISPATCH_SECRET"] = SECRET;
    expect((await post({ apikey: SECRET })).status).toBe(401);
  });

  it("passes a correct bearer secret through to the fail-closed runtime gate", async () => {
    process.env["EMAIL_DISPATCH_SECRET"] = SECRET;
    const res = await post({ authorization: `Bearer ${SECRET}` });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sending_enabled: boolean;
      missing_configuration: string[];
      claimed: number;
    };
    expect(body.sending_enabled).toBe(false);
    expect(body.claimed).toBe(0);
    expect(body.missing_configuration).toContain("EMAIL_SENDING_ENABLED");
  });
});

describe("/return method semantics", () => {
  beforeEach(() => {
    exchangeReturnToken.mockClear();
  });

  it("GET renders a real submit form without verifying the token", async () => {
    const handler = await handlerFor("return", "GET");
    const res = await handler({
      request: new Request("https://app.genxjumps.com/return?token=abc123"),
    });
    const html = await res.text();

    expect(exchangeReturnToken).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
    expect(html).toContain('<form method="post" action="/return"');
    expect(html).toContain('<button type="submit"');
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/\.submit\(\)/);
    // No inline event handlers (onclick=, onload=, ...) anywhere in the markup.
    expect(html).not.toMatch(/\son[a-z]+\s*=/i);
  });

  it("POST is the only method that invokes the token exchange", async () => {
    const handler = await handlerFor("return", "POST");
    const body = new FormData();
    body.set("token", "abc123");
    const res = await handler({
      request: new Request("https://app.genxjumps.com/return", { method: "POST", body }),
    });

    expect(exchangeReturnToken).toHaveBeenCalledTimes(1);
    // Generic recovery response is unchanged for an unusable token.
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("This Link No Longer Works");
  });

  it("exposes no handler other than GET and POST on /return", async () => {
    const mod = await import("@/routes/return");
    const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
    const server = options["server"] as { handlers: Record<string, unknown> };
    expect(Object.keys(server.handlers).sort()).toEqual(["GET", "POST"]);
  });
});
