import { useCallback, useEffect, useState } from "react";
import { Check, Download, MoreVertical, Share2, SquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  installPlatform,
  isStandaloneDisplay,
  markInstallDismissed,
  rememberStandaloneDisplay,
  shouldShowInstallNudge,
  type DeferredInstallPrompt,
  type InstallPlatform,
} from "@/lib/pwa-install";

export type InstallEventName =
  | "install_prompt_shown"
  | "install_cta_clicked"
  | "install_prompt_accepted"
  | "install_prompt_dismissed"
  | "install_instructions_shown"
  | "install_not_now"
  | "installed_display_detected";

type TrackInstall = (eventName: InstallEventName, platform: InstallPlatform) => void;

export function PwaInstallCapture() {
  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      window.__gxjInstallPrompt = event as DeferredInstallPrompt;
      window.dispatchEvent(new Event("gxj:install-available"));
    };
    const installed = () => {
      window.__gxjInstallPrompt = undefined;
      rememberStandaloneDisplay();
      window.dispatchEvent(new Event("gxj:app-installed"));
    };
    const registerServiceWorker = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    };

    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    if ("serviceWorker" in navigator) {
      if (document.readyState === "complete") registerServiceWorker();
      else window.addEventListener("load", registerServiceWorker, { once: true });
    }
    rememberStandaloneDisplay();
    return () => {
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);
  return null;
}

function ManualSteps({ platform }: { platform: InstallPlatform }) {
  if (platform === "ios") {
    return (
      <ol className="mt-5 grid gap-3" aria-label="Add Gen X Jumps to your Home Screen">
        <li className="flex gap-3 rounded-md border border-border bg-background p-3">
          <Share2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gxj-teal" />
          <p className="text-sm leading-relaxed">
            <strong>1. Open the Share menu</strong>
            <span className="block text-muted-foreground">
              Tap the Share button in your browser.
            </span>
          </p>
        </li>
        <li className="flex gap-3 rounded-md border border-border bg-background p-3">
          <SquarePlus aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gxj-teal" />
          <p className="text-sm leading-relaxed">
            <strong>2. Choose Add to Home Screen</strong>
            <span className="block text-muted-foreground">Scroll the Share menu if needed.</span>
          </p>
        </li>
        <li className="flex gap-3 rounded-md border border-border bg-background p-3">
          <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gxj-teal" />
          <p className="text-sm leading-relaxed">
            <strong>3. Tap Add</strong>
            <span className="block text-muted-foreground">
              Gen X Jumps will appear with your apps.
            </span>
          </p>
        </li>
      </ol>
    );
  }

  return (
    <div className="mt-5 flex gap-3 rounded-md border border-border bg-background p-4">
      <MoreVertical aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-gxj-teal" />
      <p className="text-sm leading-relaxed">
        <strong>Use your browser&rsquo;s install option.</strong>
        <span className="block text-muted-foreground">
          {platform === "android"
            ? "Open the browser menu, then choose Install app or Add to Home screen."
            : "Choose the install icon in the address bar or Install Gen X Jumps from the browser menu."}
        </span>
      </p>
    </div>
  );
}

export function InstallExperience({
  compact = false,
  onContinue,
  onDismiss,
  track,
}: {
  compact?: boolean;
  onContinue?: () => void;
  onDismiss?: () => void;
  track: TrackInstall;
}) {
  const [platform] = useState<InstallPlatform>(() => installPlatform());
  const [showInstructions, setShowInstructions] = useState(false);
  const [installed, setInstalled] = useState(() => isStandaloneDisplay());
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const completed = () => {
      setInstalled(true);
      track("installed_display_detected", platform);
    };
    window.addEventListener("gxj:app-installed", completed);
    track(isStandaloneDisplay() ? "installed_display_detected" : "install_prompt_shown", platform);
    return () => {
      window.removeEventListener("gxj:app-installed", completed);
    };
  }, [platform, track]);

  const install = useCallback(async () => {
    track("install_cta_clicked", platform);
    const deferred = window.__gxjInstallPrompt;
    if (deferred) {
      setWorking(true);
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        track(
          choice.outcome === "accepted" ? "install_prompt_accepted" : "install_prompt_dismissed",
          platform,
        );
        if (choice.outcome === "dismissed") markInstallDismissed();
        window.__gxjInstallPrompt = undefined;
      } catch {
        setShowInstructions(true);
        track("install_instructions_shown", platform);
      } finally {
        setWorking(false);
      }
      return;
    }
    setShowInstructions(true);
    track("install_instructions_shown", platform);
  }, [platform, track]);

  if (installed) {
    return (
      <div className="rounded-lg border border-gxj-teal bg-gxj-mint p-4" role="status">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Check aria-hidden="true" className="size-5 text-gxj-teal" />
          {platform === "desktop"
            ? "Gen X Jumps is installed."
            : "Gen X Jumps is on your Home Screen."}
        </p>
        {onContinue ? (
          <Button type="button" className="mt-4 w-full sm:w-auto" onClick={onContinue}>
            View My Plan
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={compact ? "" : "rounded-lg border border-border bg-card p-5 sm:p-6"}>
      {compact ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gxj-teal">
            Keep Your Plan Close
          </p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight">
            Add Gen X Jumps to Your Home Screen
          </h2>
        </>
      ) : null}
      <p className={`${compact ? "mt-2" : ""} text-sm leading-relaxed text-muted-foreground`}>
        Add Gen X Jumps to your Home Screen for quick access to your workouts, nutrition targets,
        and progress.
      </p>
      <Button
        type="button"
        size="lg"
        className="mt-5 w-full sm:w-auto"
        disabled={working}
        onClick={() => void install()}
      >
        <Download aria-hidden="true" className="size-4" />
        {working ? "Opening..." : "Add to My Home Screen"}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">No app store required.</p>
      {showInstructions ? <ManualSteps platform={platform} /> : null}
      {onContinue ? (
        <button
          type="button"
          className="mt-5 block w-full text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:w-auto"
          onClick={() => {
            markInstallDismissed();
            track("install_not_now", platform);
            onContinue();
          }}
        >
          Not Now - View My Plan
        </button>
      ) : null}
      {!onContinue && onDismiss ? (
        <button
          type="button"
          className="mt-4 block text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => {
            markInstallDismissed();
            track("install_not_now", platform);
            onDismiss();
          }}
        >
          Remind Me Later
        </button>
      ) : null}
    </div>
  );
}

export function InstallNudge({ track }: { track: TrackInstall }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => setVisible(shouldShowInstallNudge()), []);
  if (!visible) return null;
  return (
    <section className="mt-6 rounded-lg border border-border bg-card p-4">
      <InstallExperience compact track={track} onDismiss={() => setVisible(false)} />
    </section>
  );
}
