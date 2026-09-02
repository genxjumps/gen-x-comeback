import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuthSafely } from "@/lib/safe-supabase-auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests. Lovable's custom-domain proxy can present an
// internal request URL while the browser Origin is the configured public app
// origin, so accept either that public origin or the request's own origin.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
  origin: (origin, ctx) => {
    try {
      if (origin === new URL(ctx.request.url).origin) return true;
      const appOrigin = process.env["APP_ORIGIN"];
      return Boolean(appOrigin && origin === new URL(appOrigin).origin);
    } catch {
      return false;
    }
  },
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuthSafely],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
