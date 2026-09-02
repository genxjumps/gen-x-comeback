# Production Recovery Handoff: Root Cause Found (investigation only)

## Verdict

The cookie work is fine. The failure is earlier and entirely client-side: **the published production bundle was built without the client Supabase environment variables**, so the global `functionMiddleware` client hook throws before any server-function request is sent. `getPlanHub` is never called, so `authorize()` never runs and `return_cookie_probe` is never written.

## Hard evidence

Fetched the live bundle from `https://app.genxjumps.com/assets/index-6C1Job3W.js` (linked from `/your-plan`). The compiled Supabase client factory reads:

```text
function jl(){ let e={}.SUPABASE_URL, t={}.SUPABASE_PUBLISHABLE_KEY;
  if(!e||!t){ ... throw Error("Missing Supabase environment variable(s): ...") } ... }
```

Interpretation of that exact output:

- Source is `import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL`.
- Vite statically replaced `import.meta.env.VITE_SUPABASE_URL` and `..._PUBLISHABLE_KEY` with `undefined` (they were absent at production build time), leaving only the `{}.SUPABASE_URL` fallback, which is always `undefined` in the browser.
- Therefore both checks fail and the factory **always throws** in production.
- Corroborating: no `https://<ref>.supabase.co` string exists anywhere in the production bundle, and no publishable key literal is inlined — only the generic `sb_publishable_` prefix test. A correctly built bundle would contain both literals.

The local workspace `.env` does contain `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, which is why preview behaves differently from production.

## Exact failure point

1. `src/integrations/supabase/client.ts` exports `supabase` as a lazy `Proxy`; the client is constructed on the **first property access**, and construction throws when the env vars are missing.
2. `src/start.ts` registers `functionMiddleware: [attachSupabaseAuth]` globally — it applies to every server function, including unauthenticated ones like `getPlanHub`.
3. `src/integrations/supabase/auth-attacher.ts` client hook does `await supabase.auth.getSession()` → first property access → constructor throws → middleware rejects **before** `next()`.
4. Because the client middleware throws, no HTTP request to the serverFn endpoint is ever made.
5. `src/routes/your-plan.index.tsx` wraps the call in `try/catch` and sets `status = "denied"` on any throw → `AccessDenied` renders.
6. Server side is never entered → zero `return_cookie_probe` rows, while `/return` (a plain server route, no client middleware, no `supabase` browser client) still succeeds and logs `tanstack_set_cookie_ok` / `raw_set_cookie_header_added`.

This explains every observed symptom simultaneously, including the asymmetry between `/return` working and `/your-plan` failing. `PlatformAccessBoundary` and `auth-session-bootstrap` would fail identically on production for the same reason.

## Ruled out / lower probability

- Cookie transport: `/return` logged both cookie writes; the read path was never reached, so it cannot be the cause of zero probes.
- CSRF (`src/start.ts` `createCsrfMiddleware`): that is a **server** `requestMiddleware`. A CSRF rejection would still produce a request and, being a serverFn rejection before the handler, would also produce no probe — but it cannot explain the absent Supabase literals in the bundle, and `APP_ORIGIN` is already reported as `https://app.genxjumps.com`. Secondary suspect only.
- Server env (`SUPABASE_URL`, service role): server-side admin writes from `/return` succeeded, so server binding is healthy.
- Auth storage / `brokeredPreviewStorage`: never reached; construction throws first.

## Published-build question

`https://app.genxjumps.com/` and `/your-plan` return HTTP 200 with `x-deployment-id: psr2.63d4b7ac-ec53-4a69-83fc-710d8ad3eb8d...`. Deployment IDs are opaque and cannot be mapped to a Git commit from outside, so I cannot prove which commit is live. What is provable is that whatever build is live was compiled **without** `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, which is a build/environment defect rather than a source-code defect.

## Recommended next step (not executed)

Confirm the production build environment supplies `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then republish and re-check the bundle for an inlined `supabase.co` URL. A hardening option, separately reviewable: make `attachSupabaseAuth` fail-soft (catch and continue without an `Authorization` header) so a missing browser client can never block unauthenticated server functions. No code, config, or deployment changes were made in this turn.
