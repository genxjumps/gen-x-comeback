import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashAccessToken } from "@/lib/lead-plan";
import { logoutBrowserSession, LOGOUT_COOKIES } from "../logout.server";

const io = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from: io.from } }));
const raw = "a".repeat(43);
const cookie = "b".repeat(43);
type Session = { token_hash?: string; session_token_hash?: string; revoked_at: string | null };
let sessions: Record<string, Session[]>;
let fail: boolean;

function request(
  overrides: { method?: string; origin?: string; body?: string; cookie?: string } = {},
) {
  return new Request("https://app.genxjumps.com/logout", {
    method: overrides.method ?? "POST",
    headers: {
      origin: overrides.origin ?? "https://app.genxjumps.com",
      cookie: overrides.cookie ?? `return_link_session=${cookie}; gxj_lead_intake_v1=intake`,
      "content-type": "application/json",
    },
    ...(overrides.method === "GET"
      ? {}
      : { body: overrides.body ?? JSON.stringify({ token: raw }) }),
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  fail = false;
  sessions = {
    plan_access_sessions: [
      { token_hash: await hashAccessToken(raw), revoked_at: null },
      { token_hash: "another-browser", revoked_at: null },
    ],
    return_link_sessions: [
      { session_token_hash: await hashAccessToken(cookie), revoked_at: null },
      { session_token_hash: "another-device", revoked_at: null },
    ],
  };
  io.from.mockImplementation((table: string) => ({
    update: (values: { revoked_at: string }) => ({
      eq: (key: keyof Session, hash: string) => ({
        is: async (column: keyof Session, value: null) => {
          if (fail) return { error: { message: "internal database detail" } };
          for (const row of sessions[table]) {
            if (row[key] === hash && row[column] === value) Object.assign(row, values);
          }
          return { error: null };
        },
      }),
    }),
  }));
});

describe("deliberate browser logout", () => {
  it("rejects GET and cross-origin requests without modifying sessions or cookies", async () => {
    for (const req of [request({ method: "GET" }), request({ origin: "https://other.example" })]) {
      const response = await logoutBrowserSession(req);
      expect([403, 405]).toContain(response.status);
      expect(response.headers.has("set-cookie")).toBe(false);
    }
    expect(io.from).not.toHaveBeenCalled();
  });

  it("revokes only supplied browser sessions and expires every HTTP-only handoff", async () => {
    const response = await logoutBrowserSession(request());
    expect(await response.json()).toEqual({ ok: true });
    for (const rows of Object.values(sessions)) {
      expect(rows[0].revoked_at).toEqual(expect.any(String));
      expect(rows[1].revoked_at).toBeNull();
    }
    expect(io.from.mock.calls.map(([table]) => table)).toEqual([
      "plan_access_sessions",
      "return_link_sessions",
    ]);
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(3);
    for (const name of LOGOUT_COOKIES) {
      expect(cookies).toContain(
        `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=Lax`,
      );
    }
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("is safe to repeat and needs no active paid ownership or reviewer role", async () => {
    await logoutBrowserSession(request());
    const before = structuredClone(sessions);
    expect((await logoutBrowserSession(request())).status).toBe(200);
    expect(sessions).toEqual(before);
    expect(
      (await logoutBrowserSession(request({ body: '{"token":null}', cookie: "" }))).status,
    ).toBe(200);
  });

  it("does not let untrusted identity fields select a customer or revoke their sessions", async () => {
    const response = await logoutBrowserSession(
      request({
        cookie: "return_link_session=invalid",
        body: JSON.stringify({
          token: "invalid",
          customerId: "another-customer",
          email: "other@example.com",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(io.from).not.toHaveBeenCalled();
  });

  it("reports revocation errors without exposing internals and still clears cookies", async () => {
    fail = true;
    const response = await logoutBrowserSession(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
    expect(response.headers.getSetCookie()).toHaveLength(3);
    expect(sessions.plan_access_sessions[0].revoked_at).toBeNull();
  });

  it("does not strand malformed-cookie or malformed-body requests", async () => {
    for (const req of [request({ cookie: "return_link_session=%" }), request({ body: "{" })]) {
      const response = await logoutBrowserSession(req);
      expect(response.status).toBe(503);
      expect(response.headers.getSetCookie()).toHaveLength(3);
    }
  });
});
