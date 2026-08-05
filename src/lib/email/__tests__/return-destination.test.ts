// Checkpoint 5: trusted closed destination for the deliberate /return exchange.
// Pure and deterministic: the exchange module is mocked, so no database,
// provider, or network call happens.
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_RETURN_DESTINATION,
  OPEN_PLAN_TOKEN_PURPOSE,
  RETURN_DESTINATIONS,
  resolveReturnDestination,
} from "@/lib/email/return-destination";
import {
  PLAN_READY_JOB_TYPE,
  PLAN_READY_TEMPLATE_VERSION,
  START_DAY_1_JOB_TYPE,
  START_DAY_1_TEMPLATE_VERSION,
} from "@/lib/email/types";

type Exchange = { ok: boolean; sessionToken?: string; expiresAt?: Date; destination?: string };

const exchangeReturnToken = vi.fn(async () => ({ ok: false }) as Exchange);

vi.mock("@/lib/email/rate-limit.server", () => ({
  callerBucketKey: () => "test-bucket",
  consumeRateLimit: async () => ({ allowed: true }),
}));

vi.mock("@/lib/email/return-exchange.server", () => ({
  exchangeReturnToken: (...args: unknown[]) =>
    exchangeReturnToken(...(args as [])) as Promise<Exchange>,
}));

type Handler = (ctx: { request: Request }) => Promise<Response>;

async function handlerFor(method: "GET" | "POST"): Promise<Handler> {
  const mod = await import("@/routes/return");
  const options = (mod.Route as unknown as { options: Record<string, unknown> }).options;
  const server = options["server"] as { handlers: Record<string, Handler> };
  const handler = server.handlers[method];
  if (!handler) throw new Error(`missing ${method} handler`);
  return handler;
}

function okExchange(destination: string): Exchange {
  return {
    ok: true,
    sessionToken: "s".repeat(43),
    expiresAt: new Date(Date.now() + 60_000),
    destination,
  };
}

async function post(form: Record<string, string>): Promise<Response> {
  const handler = await handlerFor("POST");
  const body = new FormData();
  for (const [k, v] of Object.entries(form)) body.set(k, v);
  return handler({
    request: new Request("https://app.genxjumps.com/return", { method: "POST", body }),
  });
}

const LEAD = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";

function input(over: Partial<Parameters<typeof resolveReturnDestination>[0]> = {}) {
  return {
    purpose: OPEN_PLAN_TOKEN_PURPOSE,
    leadPlanId: LEAD,
    planVersionId: VERSION,
    job: {
      jobType: START_DAY_1_JOB_TYPE,
      templateVersion: START_DAY_1_TEMPLATE_VERSION,
      leadPlanId: LEAD,
      planVersionId: VERSION,
    },
    ...over,
  } as Parameters<typeof resolveReturnDestination>[0];
}

describe("resolveReturnDestination mapping", () => {
  it("maps a trusted linked start_day_1_v1 job to the Day 1 page (START and RESUME)", () => {
    expect(resolveReturnDestination(input())).toBe("/your-plan/day/1");
  });

  it("keeps Plan Ready linked tokens on the general plan hub", () => {
    expect(
      resolveReturnDestination(
        input({
          job: {
            jobType: PLAN_READY_JOB_TYPE,
            templateVersion: PLAN_READY_TEMPLATE_VERSION,
            leadPlanId: LEAD,
            planVersionId: VERSION,
          },
        }),
      ),
    ).toBe("/your-plan");
  });

  it("keeps tokens with no job association on the general plan hub", () => {
    expect(resolveReturnDestination(input({ job: null }))).toBe("/your-plan");
    expect(resolveReturnDestination(input({ job: undefined }))).toBe("/your-plan");
  });

  it("never opens Day 1 for a non open_plan token purpose", () => {
    for (const purpose of ["recovery", "email_preferences", "", null, undefined]) {
      expect(resolveReturnDestination(input({ purpose }))).toBe(DEFAULT_RETURN_DESTINATION);
    }
  });

  it("never opens Day 1 when the job does not belong to the validated token lead/version", () => {
    const other = "33333333-3333-4333-8333-333333333333";
    const mismatches = [
      { leadPlanId: other, planVersionId: VERSION },
      { leadPlanId: LEAD, planVersionId: other },
      { leadPlanId: null, planVersionId: VERSION },
      { leadPlanId: LEAD, planVersionId: null },
    ];
    for (const m of mismatches) {
      expect(
        resolveReturnDestination(
          input({
            job: {
              jobType: START_DAY_1_JOB_TYPE,
              templateVersion: START_DAY_1_TEMPLATE_VERSION,
              ...m,
            },
          }),
        ),
      ).toBe(DEFAULT_RETURN_DESTINATION);
    }
  });

  it("never yields an external or unknown destination for mismatched job state", () => {
    const cases = [
      { jobType: START_DAY_1_JOB_TYPE, templateVersion: "start_day_1_v2" },
      { jobType: "start_day_2", templateVersion: START_DAY_1_TEMPLATE_VERSION },
      { jobType: null, templateVersion: null },
      { jobType: "https://evil.example.com", templateVersion: "//evil.example.com" },
    ];
    for (const c of cases) {
      const out = resolveReturnDestination(
        input({ job: { ...c, leadPlanId: LEAD, planVersionId: VERSION } }),
      );
      expect(RETURN_DESTINATIONS).toContain(out);
      expect(out).toBe(DEFAULT_RETURN_DESTINATION);
    }
  });

  it("is pure and does not mutate its input", () => {
    const value = input();
    const snapshot = JSON.stringify(value);
    resolveReturnDestination(value);
    resolveReturnDestination(value);
    expect(JSON.stringify(value)).toBe(snapshot);
  });
});

describe("POST /return destination behavior", () => {
  beforeEach(() => {
    exchangeReturnToken.mockReset();
  });

  it("redirects a trusted start_day_1_v1 token (START) 303 to /your-plan/day/1", async () => {
    exchangeReturnToken.mockResolvedValue(okExchange("/your-plan/day/1"));
    const res = await post({ token: "a".repeat(43) });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/your-plan/day/1");
    expect(res.headers.get("set-cookie")).toContain("return_link_session=");
  });

  it("redirects a trusted start_day_1_v1 token (RESUME) 303 to /your-plan/day/1", async () => {
    // START and RESUME share the same trusted job contract.
    exchangeReturnToken.mockResolvedValue(okExchange("/your-plan/day/1"));
    const res = await post({ token: "b".repeat(43) });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/your-plan/day/1");
  });

  it("keeps a Plan Ready linked token on /your-plan", async () => {
    exchangeReturnToken.mockResolvedValue(okExchange("/your-plan"));
    const res = await post({ token: "c".repeat(43) });
    expect(res.headers.get("location")).toBe("/your-plan");
  });

  it("keeps an ordinary Open My Plan token on /your-plan", async () => {
    exchangeReturnToken.mockResolvedValue(okExchange("/your-plan"));
    const res = await post({ token: "d".repeat(43) });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/your-plan");
  });

  it("returns a clean app route with no token or query string", async () => {
    exchangeReturnToken.mockResolvedValue(okExchange("/your-plan/day/1"));
    const token = "e".repeat(43);
    const res = await post({ token });
    const location = res.headers.get("location")!;
    expect(location).not.toContain("?");
    expect(location).not.toContain("token");
    expect(location).not.toContain(token);
    expect(location.startsWith("/your-plan")).toBe(true);
  });

  it("ignores hostile destination fields in the POST form (no open redirect)", async () => {
    exchangeReturnToken.mockResolvedValue(okExchange("/your-plan"));
    const res = await post({
      token: "f".repeat(43),
      destination: "https://evil.example.com",
      redirect: "//evil.example.com",
      next: "/admin",
    });
    expect(res.headers.get("location")).toBe("/your-plan");
    // Only the token is ever read from the request.
    const arg = (exchangeReturnToken.mock.calls as unknown as unknown[][])[0]?.[0];
    expect(arg).toBe("f".repeat(43));
  });

  it("returns generic recovery with no destination disclosure for unusable tokens", async () => {
    exchangeReturnToken.mockResolvedValue({ ok: false });
    const res = await post({ token: "g".repeat(43), destination: "https://evil.example.com" });
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
    const html = await res.text();
    expect(html).toContain("This Link No Longer Works");
    expect(html).not.toContain("/your-plan/day/1");
    expect(html).not.toContain("evil.example.com");
  });
});

describe("GET /return remains read-only", () => {
  beforeEach(() => {
    exchangeReturnToken.mockReset();
    exchangeReturnToken.mockResolvedValue({ ok: false });
  });

  it("never invokes the exchange and honors no destination query params", async () => {
    const handler = await handlerFor("GET");
    const res = await handler({
      request: new Request(
        "https://app.genxjumps.com/return?token=abc123&destination=https://evil.example.com&next=/admin&redirect=//evil.example.com",
      ),
    });
    const html = await res.text();

    expect(exchangeReturnToken).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(html).not.toContain("evil.example.com");
    expect(html).not.toContain("/admin");
    expect(html).toContain('<form method="post" action="/return"');
  });
});

describe("exchange side effects stay within the documented contract", () => {
  it("writes no Day 1 start/completion state and emits no day_1 events", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/lib/email/return-exchange.server.ts", "utf8"),
    );
    for (const forbidden of [
      "lead_plan_day_starts",
      "lead_plan_day_completions",
      "mark_day_1_started",
      "day_1_started",
      "day_1_completed",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("destination resolution reads only trusted job columns", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/lib/email/return-destination.ts", "utf8"),
    );
    for (const forbidden of ["fetch(", "process.env", "request", "searchParams", "supabase"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
