import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

/**
 * Adds the member bearer token when browser Supabase auth is available.
 * Anonymous server functions must still run if the optional browser auth
 * client cannot initialize, so recovery and other token/cookie flows are not
 * coupled to the member-auth bundle configuration.
 */
export const attachSupabaseAuthSafely = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch (error) {
      console.error("[Supabase] Browser auth unavailable; continuing without bearer token.", error);
    }

    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
