import { ACCESS_TOKEN_STORAGE_KEY } from "@/lib/lead-plan";
import { ASSESSMENT_STORAGE_KEY } from "@/lib/plan";
import { ELIGIBILITY_STORAGE_KEY } from "@/lib/signup-draft";
import { LEAD_INTAKE_STORAGE_KEY } from "@/lib/lead-intake-draft";

export const LOGOUT_EVENT_KEY = "gxj_logout_event_v1";
const PRIVATE_LOCAL_KEYS = [
  ACCESS_TOKEN_STORAGE_KEY,
  ASSESSMENT_STORAGE_KEY,
  ELIGIBILITY_STORAGE_KEY,
  "gxj_assessment_owner_v1",
  "gxj_submission_v1",
] as const;

/** Keep unrelated device preferences (including Home Screen installation). */
export function clearBrowserAccountData(): void {
  let failed = false;
  for (const key of PRIVATE_LOCAL_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      failed = true;
    }
  }
  try {
    window.sessionStorage.removeItem(LEAD_INTAKE_STORAGE_KEY);
  } catch {
    failed = true;
  }
  if (failed) throw new Error("Browser account data could not be cleared");
}

export function logoutEvent(): string | null {
  try {
    return window.localStorage.getItem(LOGOUT_EVENT_KEY);
  } catch {
    return null;
  }
}

/** Other tabs clear only their tab-local draft, never a subsequent login's shared credentials. */
export function watchLogoutEvents(clearCache: () => void): () => void {
  const initial = logoutEvent();
  const discard = () => {
    try {
      window.sessionStorage.removeItem(LEAD_INTAKE_STORAGE_KEY);
      window.sessionStorage.setItem("gxj_seen_logout_v1", logoutEvent() ?? "");
    } catch {
      // Always discard the private in-memory page, including when storage is blocked.
    }
    clearCache();
    window.location.replace("/account");
  };
  try {
    const previous = window.sessionStorage.getItem("gxj_seen_logout_v1");
    if (initial && previous !== initial) window.sessionStorage.removeItem(LEAD_INTAKE_STORAGE_KEY);
    window.sessionStorage.setItem("gxj_seen_logout_v1", initial ?? "");
  } catch {
    // The Account action itself reports storage failures. Keep navigation usable.
  }
  const storage = (event: StorageEvent) => {
    if (event.key === LOGOUT_EVENT_KEY && event.newValue !== initial) discard();
  };
  const restored = (event: PageTransitionEvent) => {
    if (logoutEvent() !== initial) discard();
    else if (event.persisted) window.location.reload();
  };
  window.addEventListener("storage", storage);
  window.addEventListener("pageshow", restored);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener("pageshow", restored);
  };
}

export type LogoutDependencies = {
  clearServerSession: (token: string | null) => Promise<boolean>;
  signOut: () => Promise<{ error: unknown }>;
  clearData: () => void;
  announce: () => void;
};

/** All cleanup is attempted. A partial/network/storage failure never becomes success. */
export async function logoutThisBrowser(
  token: string | null,
  dependencies: LogoutDependencies,
): Promise<boolean> {
  let ok = true;
  try {
    if (!(await dependencies.clearServerSession(token))) ok = false;
  } catch {
    ok = false;
  }
  try {
    dependencies.clearData();
  } catch {
    ok = false;
  }
  try {
    if ((await dependencies.signOut()).error) ok = false;
  } catch {
    ok = false;
  }
  try {
    dependencies.announce();
  } catch {
    ok = false;
  }
  return ok;
}
