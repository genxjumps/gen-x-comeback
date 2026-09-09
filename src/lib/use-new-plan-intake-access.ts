import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { getLeadIntakeWelcome } from "@/lib/lead-intake.functions";
import { NEW_PLAN_INTAKE_OPEN } from "@/lib/intake";

export type NewPlanIntakeAccess = "checking" | "allowed" | "closed";

export function useNewPlanIntakeAccess(): NewPlanIntakeAccess {
  const loadHandoff = useServerFn(getLeadIntakeWelcome);
  const [access, setAccess] = useState<NewPlanIntakeAccess>(
    NEW_PLAN_INTAKE_OPEN ? "allowed" : "checking",
  );

  useEffect(() => {
    if (NEW_PLAN_INTAKE_OPEN) {
      setAccess("allowed");
      return;
    }

    let active = true;
    void loadHandoff({ data: {} })
      .then((result) => {
        if (active) setAccess(result.ok ? "allowed" : "closed");
      })
      .catch(() => {
        if (active) setAccess("closed");
      });
    return () => {
      active = false;
    };
  }, [loadHandoff]);

  return NEW_PLAN_INTAKE_OPEN ? "allowed" : access;
}
