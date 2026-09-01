import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";

import { getAcceleratorHub, recordAcceleratorVideoView } from "@/lib/accelerator/functions";

type StreamPlayer = {
  addEventListener: (event: "play", handler: () => void) => void;
};

declare global {
  interface Window {
    Stream?: (iframe: HTMLIFrameElement) => StreamPlayer;
  }
}

const SDK_SRC = "https://embed.cloudflarestream.com/embed/sdk.latest.js";

function loadStreamSdk(): Promise<void> {
  if (window.Stream) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Cloudflare Stream SDK failed")), {
        once: true,
      });
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("Cloudflare Stream SDK failed")), {
      once: true,
    });
    document.head.appendChild(script);
  });
}

function videoIdentity(iframe: HTMLIFrameElement): { day: number; mediaKey: string } | null {
  const dayMatch = iframe.title.match(/^Day (\d+) -/);
  const uidMatch = iframe.src.match(/cloudflarestream\.com\/([a-f0-9]{32})\/iframe/i);
  if (!dayMatch || !uidMatch) return null;
  const day = Number(dayMatch[1]);
  if (!Number.isInteger(day) || day < 1 || day > 28) return null;
  return { day, mediaKey: uidMatch[1] };
}

export function AcceleratorVideoTracker() {
  const loadHub = useServerFn(getAcceleratorHub);
  const recordView = useServerFn(recordAcceleratorVideoView);

  useEffect(() => {
    let cancelled = false;
    const wired = new WeakSet<HTMLIFrameElement>();

    void (async () => {
      const [hubResult] = await Promise.all([loadHub({ data: {} }), loadStreamSdk()]);
      if (cancelled || !hubResult.ok || !window.Stream) return;
      const enrollmentId = hubResult.data.enrollmentId;

      const wirePlayers = () => {
        const iframes = document.querySelectorAll<HTMLIFrameElement>(
          'iframe[src*="cloudflarestream.com/"]',
        );
        for (const iframe of iframes) {
          if (wired.has(iframe)) continue;
          const identity = videoIdentity(iframe);
          if (!identity) continue;
          wired.add(iframe);
          const player = window.Stream?.(iframe);
          if (!player) continue;
          let recorded = false;
          player.addEventListener("play", () => {
            if (recorded) return;
            recorded = true;
            void recordView({
              data: {
                enrollmentId,
                day: identity.day,
                mediaKey: identity.mediaKey,
              },
            }).catch(() => {
              recorded = false;
            });
          });
        }
      };

      wirePlayers();
      const observer = new MutationObserver(wirePlayers);
      observer.observe(document.body, { childList: true, subtree: true });
      if (cancelled) observer.disconnect();
      else return () => observer.disconnect();
    })().then((cleanup) => {
      if (cancelled) cleanup?.();
      else if (cleanup) cleanupRef = cleanup;
    }).catch(() => undefined);

    let cleanupRef: (() => void) | undefined;
    return () => {
      cancelled = true;
      cleanupRef?.();
    };
  }, [loadHub, recordView]);

  return null;
}
