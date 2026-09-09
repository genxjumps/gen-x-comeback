import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

const io = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), cookie: vi.fn(), setCookie: vi.fn() }));
// Keep validation and the production handler; replace framework request context only.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    inputValidator: (validate: (data: unknown) => unknown) => ({
      handler:
        (fn: (args: { data: unknown }) => unknown) =>
        ({ data }: { data: unknown }) =>
          fn({ data: validate(data) }),
    }),
  }),
}));
vi.mock("@tanstack/react-start/server", () => ({ setCookie: io.setCookie }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: { rpc: io.rpc, from: io.from },
}));
vi.mock("@/lib/plan-access.server", async (original) => ({
  ...(await original<object>()),
  currentCookieHeader: io.cookie,
}));

import { saveLeadPlanFromHandoff } from "@/lib/lead.functions";
import { getSubmissionAttempt } from "@/lib/plan-submission";
import { hashAccessToken } from "@/lib/lead-plan";
import type { Answers } from "@/lib/plan";

const db = new PGlite({ extensions: { pgcrypto } });
const context = new AsyncLocalStorage<{ cookie: string; cookies: string[] }>();
let failSession = false;
let wakes = 0;

beforeAll(async () => {
  // Same inert extension scaffolding as signup:db:test; no remote connection exists.
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA supabase_migrations; CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY,name text,statements text[]);
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE SCHEMA cron; CREATE TABLE cron.job(jobid bigint,jobname text);
    CREATE SCHEMA net; CREATE SCHEMA vault; CREATE TABLE vault.secrets(id uuid,name text);
    CREATE TABLE vault.decrypted_secrets(id uuid,name text,decrypted_secret text);`);
  for (const file of readdirSync("supabase/migrations").sort()) {
    await db.exec(
      readFileSync(`supabase/migrations/${file}`, "utf8").replace(
        /CREATE EXTENSION IF NOT EXISTS pg_(cron|net);/g,
        "",
      ),
    );
  }
  io.cookie.mockImplementation(() => context.getStore()!.cookie);
  io.setCookie.mockImplementation((name, value, options) => {
    expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    context.getStore()!.cookies.push(`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  });
  // SDK transport adapter only: all decisions and persistence execute the real SQL.
  io.rpc.mockImplementation(async (name, args) => {
    if (name === "invoke_email_dispatch_scheduler") {
      wakes++;
      return { data: null, error: null }; // Never contact a provider or pg_net.
    }
    try {
      if (name === "resolve_signup_intake") {
        return {
          data: (
            await db.query("SELECT * FROM public.resolve_signup_intake($1)", [args.p_token_hash])
          ).rows,
          error: null,
        };
      }
      if (name !== "save_signup_plan") throw new Error(`Unexpected RPC: ${name}`);
      const result = await db.query<{ result: unknown }>(
        "SELECT public.save_signup_plan($1,$2::uuid,$3,$4,$5::jsonb,$6::jsonb,$7) AS result",
        [
          args.p_token_hash,
          args.p_submission_id,
          args.p_session_token_hash,
          args.p_request_fingerprint,
          JSON.stringify(args.p_assessment),
          JSON.stringify(args.p_plan),
          args.p_time_zone,
        ],
      );
      return { data: result.rows[0].result, error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  });
  io.from.mockImplementation((table) => {
    if (table === "lead_plans")
      return {
        select: () => ({
          eq: (_key: string, id: string) => ({
            limit: async () => ({
              data: (
                await db.query("SELECT plan_version_id FROM public.lead_plans WHERE id=$1", [id])
              ).rows,
              error: null,
            }),
          }),
        }),
      };
    if (table !== "return_link_sessions") throw new Error(`Unexpected table: ${table}`);
    return {
      insert: async (row: Record<string, string>) => {
        if (failSession) {
          failSession = false;
          return { error: { message: "Injected session failure" } };
        }
        await db.query(
          "INSERT INTO public.return_link_sessions(session_token_hash,lead_plan_id,plan_version_id,expires_at) VALUES($1,$2,$3,$4)",
          [row.session_token_hash, row.lead_plan_id, row.plan_version_id, row.expires_at],
        );
        return { error: null };
      },
    };
  });
}, 30000);

afterAll(async () => {
  await db.close();
  vi.unstubAllGlobals();
});

const answers: Answers = {
  q1: "one",
  q2: "inconsistent",
  q3: "new",
  q4: ["limit_impact"],
  q5: "3",
  equipment: ["jump_rope"],
  weight: "",
  unit: "lb",
};

async function snapshot(email: string) {
  return (
    await db.query<{ id: string; plan_version_id: string; [key: string]: unknown }>(
      `SELECT p.id,p.plan_version_id,p.plan_json,p.assessment_json,p.plan_start_on,p.plan_time_zone,
    (SELECT count(*)::int FROM public.lead_plans WHERE email_normalized=$1) AS identities,
    (SELECT count(*)::int FROM public.plan_submissions WHERE lead_plan_id=p.id) AS submissions,
    (SELECT count(*)::int FROM public.email_jobs WHERE lead_plan_id=p.id AND job_type='plan_ready') AS plan_ready,
    (SELECT count(*)::int FROM public.lead_plan_day_completions WHERE lead_plan_id=p.id) AS completions
    FROM public.lead_plans p WHERE p.email_normalized=$1`,
      [email],
    )
  ).rows[0];
}

describe("save response loss through loopback HTTP and real database", () => {
  it.each(["dropped-response", "session-failure"])(
    "recovers after %s without replacing the plan",
    async (fault) => {
      const email = `${fault}@example.test`;
      const raw = randomBytes(32).toString("hex");
      await db.query(
        `INSERT INTO public.lead_intakes(token_hash,email_normalized,email_original,first_name,consent_copy,consent_version,expires_at,controlled_test)
      VALUES($1,$2,$2,'Fault Test','both','v1',now()+interval '1 day',true)`,
        [await hashAccessToken(raw), email],
      );
      const storage = new Map<string, string>();
      const mountBrowserStorage = () =>
        vi.stubGlobal("window", {
          localStorage: {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => storage.set(key, value),
          },
        });
      mountBrowserStorage();
      const attempt = await getSubmissionAttempt(answers);
      const requestData = {
        assessment: answers,
        submissionId: attempt.submissionId,
        sessionTokenHash: attempt.hash,
        timeZone: "America/New_York",
      };
      let first = true;
      let commitObserved = false;
      const handler = saveLeadPlanFromHandoff as unknown as (arg: {
        data: typeof requestData;
      }) => Promise<unknown>;
      const server = createServer((req, res) => {
        context.run({ cookie: req.headers.cookie ?? "", cookies: [] }, async () => {
          try {
            let body = "";
            for await (const chunk of req) body += chunk;
            const result = await handler({ data: JSON.parse(body) });
            if (first && fault === "dropped-response") {
              first = false;
              commitObserved = !!(await snapshot(email));
              // Commit and session issuance finished; discard every response byte,
              // including Set-Cookie, before the HTTP client can observe success.
              res.destroy();
              return;
            }
            res.setHeader("Set-Cookie", context.getStore()!.cookies);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch {
            first = false;
            res.statusCode = 503;
            res.end("Injected failure");
          }
        });
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("No loopback listener");
      const url = `http://127.0.0.1:${address.port}`;
      const send = (data: typeof requestData) =>
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", cookie: `gxj_lead_intake_v1=${raw}` },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(5000),
        });
      try {
        const wakeBefore = wakes;
        failSession = fault === "session-failure";
        if (fault === "dropped-response") {
          await expect(send(requestData)).rejects.toThrow();
          expect(commitObserved).toBe(true);
        } else {
          const failed = await send(requestData);
          expect(failed.status).toBe(503);
          expect(failed.headers.get("set-cookie")).toBeNull();
        }
        const committed = await snapshot(email);
        expect(committed).toMatchObject({
          identities: 1,
          submissions: 1,
          plan_ready: 1,
          completions: 0,
        });
        expect(wakes).toBe(wakeBefore + 1);
        // A retry must not erase progress written after the original commit.
        await db.query(
          "INSERT INTO public.lead_plan_day_completions(lead_plan_id,day_number) VALUES($1,1)",
          [committed.id],
        );
        mountBrowserStorage(); // Reloaded client context, persisted storage retained.
        const retryAttempt = await getSubmissionAttempt(answers);
        expect(retryAttempt).toEqual(attempt);
        const response = await send({
          ...requestData,
          submissionId: retryAttempt.submissionId,
          sessionTokenHash: retryAttempt.hash,
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({ outcome: "saved", replayed: true });
        expect(await snapshot(email)).toEqual({ ...committed, completions: 1 });
        const cookie = response.headers.get("set-cookie")!;
        expect(cookie).toContain("return_link_session=");
        const sessionRaw = cookie.split(";")[0].split("=")[1];
        const sessions = await db.query(
          "SELECT lead_plan_id,plan_version_id FROM public.return_link_sessions WHERE session_token_hash=$1 AND expires_at>now()",
          [await hashAccessToken(sessionRaw)],
        );
        expect(sessions.rows).toEqual([
          { lead_plan_id: committed.id, plan_version_id: committed.plan_version_id },
        ]);
        expect(
          (await db.query("SELECT count(*)::int AS count FROM public.email_provider_submissions"))
            .rows,
        ).toEqual([{ count: 0 }]);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        vi.unstubAllGlobals();
      }
    },
    15000,
  );
});
