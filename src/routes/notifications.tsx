import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";

import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";
import {
  dismissMeasurementReminder,
  getProgramReminderPreference,
  getPlatformNotifications,
  setProgramReminderPreference,
} from "@/lib/notifications/functions";
import type { PlatformNotification, PlatformComebackReminder } from "@/lib/notifications/types";

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
  const loadPreference = useServerFn(getProgramReminderPreference);
  const updatePreference = useServerFn(setProgramReminderPreference);
  const [notifications, setNotifications] = useState<PlatformNotification[] | null>(null);
  const [programRemindersEnabled, setProgramRemindersEnabled] = useState<boolean | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [updatingPreference, setUpdatingPreference] = useState(false);
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
    void loadPreference({ data: {} })
      .then((result) => {
        if (active && result.ok) setProgramRemindersEnabled(result.programRemindersEnabled);
      })
      .catch(() => {
        if (active) setError("Your reminder preference couldn’t be loaded. Try again.");
      });
    return () => {
      active = false;
    };
  }, [loadNotifications, loadPreference]);

  async function dismiss(notification: Exclude<PlatformNotification, PlatformComebackReminder>) {
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
              item.code !== "weekly_measurement" ||
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

  async function toggleProgramReminders() {
    if (programRemindersEnabled === null || updatingPreference) return;
    const nextValue = !programRemindersEnabled;
    setUpdatingPreference(true);
    setError(null);
    try {
      const result = await updatePreference({ data: { programRemindersEnabled: nextValue } });
      if (!result.ok) {
        setError("Your reminder preference couldn’t be saved. Try again.");
        return;
      }
      setProgramRemindersEnabled(result.programRemindersEnabled);
      if (!result.programRemindersEnabled) {
        setNotifications([]);
        window.dispatchEvent(
          new CustomEvent("gxj:notifications-changed", { detail: { count: 0 } }),
        );
      } else {
        const refreshed = await loadNotifications({ data: {} });
        setNotifications(refreshed.ok ? refreshed.notifications : []);
        window.dispatchEvent(
          new CustomEvent("gxj:notifications-changed", {
            detail: { count: refreshed.ok ? refreshed.notifications.length : 0 },
          }),
        );
      }
    } catch {
      setError("Your reminder preference couldn’t be saved. Try again.");
    } finally {
      setUpdatingPreference(false);
    }
  }

  return (
    <PlatformPage
      kicker="Notifications"
      title="Your Inbox"
      description="Optional program check-ins appear here without changing your place or blocking progress."
    >
      <section className="mb-4 rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold">Program reminders</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Optional check-ins appear here when there&rsquo;s something useful to do. Turning them off
          never changes your program, progress, or access.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium" aria-live="polite">
            {programRemindersEnabled === null
              ? "Loading preference..."
              : programRemindersEnabled
                ? "Program reminders are on"
                : "Program reminders are off"}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={programRemindersEnabled === null || updatingPreference}
            onClick={() => void toggleProgramReminders()}
          >
            {updatingPreference ? "Saving..." : programRemindersEnabled ? "Turn Off" : "Turn On"}
          </Button>
        </div>
      </section>
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
              key={
                notification.code === "weekly_measurement"
                  ? `${notification.enrollmentId}-${notification.programWeek}`
                  : notification.code
              }
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
                {notification.code === "weekly_measurement" ? (
                  <>
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
                  </>
                ) : (
                  <Button asChild size="sm">
                    <Link to={notification.target}>Open Today&rsquo;s Workout</Link>
                  </Button>
                )}
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
