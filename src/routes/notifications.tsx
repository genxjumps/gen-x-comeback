import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";

import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import {
  dismissMeasurementReminder,
  getPlatformNotifications,
} from "@/lib/notifications/functions";
import type { MeasurementReminder } from "@/lib/notifications/measurement-reminder";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const loadNotifications = useServerFn(getPlatformNotifications);
  const dismissReminder = useServerFn(dismissMeasurementReminder);
  const [notifications, setNotifications] = useState<MeasurementReminder[] | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void loadNotifications({ data: {} })
      .then((result) => {
        if (active) setNotifications(result.ok ? result.notifications : []);
      })
      .catch(() => {
        if (active) setError("Your notifications couldn’t be loaded. Try again.");
      });
    return () => {
      active = false;
    };
  }, [loadNotifications]);

  async function dismiss(notification: MeasurementReminder) {
    setDismissing(true);
    setError(null);
    try {
      const result = await dismissReminder({
        data: {
          enrollmentId: notification.enrollmentId,
          programWeek: notification.programWeek,
        },
      });
      if (!result.ok) {
        setError("That reminder couldn’t be dismissed. Reload and try again.");
        return;
      }
      setNotifications(
        (current) =>
          current?.filter(
            (item) =>
              item.enrollmentId !== notification.enrollmentId ||
              item.programWeek !== notification.programWeek,
          ) ?? [],
      );
      window.dispatchEvent(new CustomEvent("gxj:notifications-changed", { detail: { count: 0 } }));
    } catch {
      setError("That reminder couldn’t be dismissed. Try again.");
    } finally {
      setDismissing(false);
    }
  }

  return (
    <PlatformPage
      kicker="Notifications"
      title="Your Inbox"
      description="Optional program check-ins appear here without changing your place or blocking progress."
    >
      {error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notifications === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading your notifications...</p>
      ) : notifications?.length ? (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <section
              key={`${notification.enrollmentId}-${notification.programWeek}`}
              className="rounded-lg border border-border bg-card p-5"
            >
              <div className="flex items-start gap-3">
                <Bell aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <div>
                  <h2 className="text-base font-semibold">{notification.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {notification.message}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild size="sm">
                  <Link to="/progress">Add a Measurement</Link>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={dismissing}
                  onClick={() => void dismiss(notification)}
                >
                  {dismissing ? "Dismissing..." : "Dismiss for This Week"}
                </Button>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="rounded-lg border border-dashed border-border bg-muted/35 p-8 text-center">
          <Bell aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-4 text-sm font-semibold">You’re all caught up</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional program reminders will appear here when there’s something useful to do.
          </p>
        </section>
      )}
    </PlatformPage>
  );
}
