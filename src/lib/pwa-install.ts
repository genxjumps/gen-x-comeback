export const PWA_DISMISSED_STORAGE_KEY = "gxj_pwa_install_dismissed_v1";
export const PWA_INSTALLED_STORAGE_KEY = "gxj_pwa_installed_v1";
export const PWA_NUDGE_DELAY_MS = 24 * 60 * 60 * 1000;

export type InstallPlatform = "ios" | "android" | "desktop";

export type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Navigator {
    standalone?: boolean;
  }

  interface Window {
    __gxjInstallPrompt?: DeferredInstallPrompt;
  }
}

export function installPlatform(): InstallPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const agent = navigator.userAgent;
  const ios =
    /iPad|iPhone|iPod/.test(agent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  return /Android/i.test(agent) ? "android" : "desktop";
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

export function markInstallDismissed(now = Date.now()): void {
  try {
    window.localStorage.setItem(PWA_DISMISSED_STORAGE_KEY, String(now));
  } catch {
    // Storage availability never blocks plan access.
  }
}

export function shouldShowInstallNudge(now = Date.now()): boolean {
  if (isStandaloneDisplay()) return false;
  try {
    if (window.localStorage.getItem(PWA_INSTALLED_STORAGE_KEY) === "true") return false;
    const dismissedAt = Number(window.localStorage.getItem(PWA_DISMISSED_STORAGE_KEY));
    return !Number.isFinite(dismissedAt) || now - dismissedAt >= PWA_NUDGE_DELAY_MS;
  } catch {
    return true;
  }
}

export function rememberStandaloneDisplay(): void {
  if (!isStandaloneDisplay()) return;
  try {
    window.localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, "true");
  } catch {
    // Detection still works on this page without persistence.
  }
}
