import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";

import { PlatformPage } from "@/components/platform-page";
import {
  AppList,
  AppListRow,
  AppLoadingState,
  AppNotice,
  AppStatePanel,
} from "@/components/precision-surfaces";
import { Button } from "@/components/ui/button";
import type { MeasurementReminder } from "@/lib/notifications/measurement-reminder";
import {
  dismissMeasurementReminder,
  getProgramReminderPreference,
  getPlatformNotifications,
  setProgramReminderPreference,
} from "@/lib/notifications/functions";
import type { PlatformNotification } from "@/lib/notifications/types";

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
      title="Notifications"
      description="Optional program check-ins appear here without changing your place or blocking progress."
      titleSize="compact"
    >
      <section className="border-y border-[var(--pu-border-strong)] py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-xl font-bold">Program reminders</h2>
            <p className="mt-1 text-sm leading-5 text-[var(--pu-text-secondary)]">
              Optional check-ins appear here when there’s something useful to do. Turning them off
              never changes your program, progress, or access.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
        </div>
      </section>

      {error ? (
        <AppNotice tone="danger" className="mt-5" role="alert">
          {error}
        </AppNotice>
      ) : null}

      <section className="mt-8" aria-label="Notification inbox">
        {notifications === null && !error ? (
          <AppLoadingState label="Loading your notifications" />
        ) : notifications?.length ? (
          <AppList>
            {notifications.map((notification) => (
              <AppListRow
                key={
                  notification.code === "weekly_measurement"
                    ? `${notification.enrollmentId}-${notification.programWeek}`
                    : notification.code
                }
                title={
                  <div className="flex items-center gap-3">
                    <Bell
                      aria-hidden="true"
                      className="size-5 shrink-0 text-[var(--pu-text-secondary)]"
                      strokeWidth={1.8}
                    />
                    <span>{notification.title}</span>
                  </div>
                }
                detail={
                  <div className="pl-8">
                    <p>{notification.message}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
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
                      ) : notification.code === "nutrition_target_review" ? (
                        <Button asChild size="sm">
                          <Link to="/nutrition">Review Targets</Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm">
                          <Link to={notification.target}>Open Today&rsquo;s Workout</Link>
                        </Button>
                      )}
                    </div>
                  </div>
                }
              />
            ))}
          </AppList>
        ) : (
          <AppStatePanel
            state="empty"
            title="You’re all caught up"
            description="Optional program reminders will appear here when there’s something useful to do."
          />
        )}
      </section>
    </PlatformPage>
  );
}
