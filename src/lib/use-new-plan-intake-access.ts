import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { bindSignupDraft } from "@/lib/signup-draft";
import { verifyAccessToken } from "@/lib/lead.functions";
import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/lead-plan";
import { readStoredToken, clearStoredToken } from "@/lib/access-token";
import { useServerFn } from "@tanstack/react-start";

import { getLeadIntakeWelcome } from "@/lib/lead-intake.functions";
import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";

export type NewPlanIntakeAccess = "checking" | "allowed" | "closed";

export function useNewPlanIntakeAccess(): NewPlanIntakeAccess {
  const verify = useServerFn(verifyAccessToken);
  const navigate = useNavigate();
  const loadHandoff = useServerFn(getLeadIntakeWelcome);
  const [access, setAccess] = useState<NewPlanIntakeAccess>("checking");

  useEffect(() => {
    let active = true;
    void loadHandoff({ data: { token: readStoredToken() } })
      .then(async (result) => {
        if (!active) return;
        if (result.ok && result.state === "setup") {
          bindSignupDraft(result.draftKey);
          setAccess("allowed");
        } else if (result.ok) {
          if (result.useCookie) clearStoredToken();
          navigate({
            to: result.state === "plan" ? "/your-plan" : "/welcome",
            hash: result.platformAuthTokenHash
              ? `gxj_auth=${encodeURIComponent(result.platformAuthTokenHash)}`
              : undefined,
            replace: true,
          });
        } else {
          const authorized = await verify({ data: { token: readStoredToken() } });
          if (active) setAccess(authorized.ok || NEW_PLAN_INTAKE_OPEN ? "allowed" : "closed");
        }
      })
      .catch(() => {
        if (active) setAccess("closed");
      });
    return () => {
      active = false;
    };
  }, [loadHandoff, navigate, verify]);

  return access;
}
