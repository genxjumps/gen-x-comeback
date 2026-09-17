// Recovery/access portability contract.
//
// A recovery email is a portable access credential for the current plan version.
// It is not bound to the browser/device that requested it and it is not consumed
// by the first successful use. Each successful use establishes a fresh browser
// session. Plan replacement remains the deliberate revocation boundary.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import { hashAccessToken } from "@/lib/lead-plan";

const LEAD = "11111111-1111-4111-8111-111111111111";
const VERSION = "22222222-2222-4222-8222-222222222222";
const TOKEN_ID = "33333333-3333-4333-8333-333333333333";
const RAW = "R".repeat(43);

type Row = Record<string, unknown>;
type Write = { table: string; op: "insert" | "update"; payload: unknown };

const state: { rows: Record<string, Row[]>; writes: Write[] } = { rows: {}, writes: [] };

function makeClient() {
  const from = (table: string) => ({
    select: () => {
      const filters: Row = {};
      const query = {
        eq(column: string, value: unknown) {
          filters[column] = value;
          return query;
        },
        limit(_n: number) {
          const rows = (state.rows[table] ?? []).filter((row) =>
            Object.entries(filters).every(([key, value]) => row[key] === value),
          );
          return Promise.resolve({ data: rows, error: null });
        },
      };
      return query;
    },
    insert(payload: unknown) {
      state.writes.push({ table, op: "insert" as const, payload });
      return Promise.resolve({ error: null });
    },
    update(payload: unknown) {
      return {
        eq: (_column: string, _value: unknown) => {
          state.writes.push({ table, op: "update" as const, payload });
          return Promise.resolve({ error: null });
        },
      };
    },
  });

  return { supabaseAdmin: { from } };
}

vi.mock("@/integrations/supabase/client.server", () => makeClient());

async function seed() {
  state.rows = {
    plan_return_tokens: [
      {
        token_id: TOKEN_ID,
        lead_plan_id: LEAD,
        plan_version_id: VERSION,
        purpose: "recovery",
        token_hash: await hashAccessToken(RAW),
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        revoked_at: null,
        use_count: 0,
        job_id: null,
      },
    ],
    lead_plans: [
      {
        id: LEAD,
        plan_version_id: VERSION,
        email_verified_at: null,
        email_original: "reader@example.com",
      },
    ],
  };
  state.writes = [];
}

async function exchange() {
  const { exchangeReturnToken } = await import("@/lib/email/return-exchange.server");
  return exchangeReturnToken(RAW);
}

describe("portable recovery access", () => {
  beforeEach(seed);

  it("allows the same still-valid recovery link to establish independent sessions more than once", async () => {
    const first = await exchange();
    const second = await exchange();

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    // Two devices/browsers using the same valid email link must receive two
    // independent session credentials, not compete for one browser state.
    expect(first.sessionToken).not.toBe(second.sessionToken);

    const sessionWrites = state.writes.filter(
      (write) => write.table === "return_link_sessions" && write.op === "insert",
    );
    expect(sessionWrites).toHaveLength(2);

    // Successful use records usage but never revokes the portable link or any
    // existing browser session.
    const tokenUpdates = state.writes.filter(
      (write) => write.table === "plan_return_tokens" && write.op === "update",
    );
    expect(tokenUpdates).toHaveLength(2);
    for (const update of tokenUpdates) {
      expect(update.payload).not.toHaveProperty("revoked_at");
    }

    const sessionRevocations = state.writes.filter(
      (write) =>
        write.table === "return_link_sessions" &&
        write.op === "update" &&
        typeof write.payload === "object" &&
        write.payload !== null &&
        "revoked_at" in write.payload,
    );
    expect(sessionRevocations).toHaveLength(0);
  });

  it("keeps a new Recovery request from invalidating older still-valid links or sessions", () => {
    const migration = readFileSync(
      "supabase/migrations/20260807175301_630a998c-8645-4bfa-9f21-e0c0166d673e.sql",
      "utf8",
    );
    const recovery = migration.slice(migration.indexOf("FUNCTION public.request_plan_recovery"));
    const body = recovery.slice(0, recovery.indexOf("-- 9."));

    expect(body).toContain("'recovery', 'v1', 'recovery_v1'");
    expect(body).not.toContain("UPDATE public.plan_return_tokens");
    expect(body).not.toContain("UPDATE public.return_link_sessions");
    expect(body).not.toContain("UPDATE public.plan_access_sessions");
  });

  it("preserves plan replacement as the deliberate revocation boundary", () => {
    const migration = readFileSync(
      "supabase/migrations/20260806175920_582a324d-47f9-44ac-aec4-1ad8b86eb7d6.sql",
      "utf8",
    );

    expect(migration).toContain("UPDATE public.plan_return_tokens");
    expect(migration).toContain("UPDATE public.return_link_sessions");
    expect(migration).toContain("UPDATE public.plan_access_sessions");
    expect(migration).toContain("SET revoked_at = v_now");
  });
});
