import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";

import { AccountNavigation } from "@/components/account-navigation";
import { supabase } from "@/integrations/supabase/client";
import { getPlatformNotifications } from "@/lib/notifications/functions";

export function PlatformHeaderActions() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const loadNotifications = useServerFn(getPlatformNotifications);
  const [notificationCount, setNotificationCount] = useState(0);
  const [authRevision, setAuthRevision] = useState(0);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        setNotificationCount(0);
        setAuthRevision((value) => value + 1);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    setNotificationCount(0);
    void loadNotifications({ data: {} })
      .then((result) => {
        if (active && result.ok) setNotificationCount(result.notifications.length);
      })
      .catch(() => undefined);
    const updateCount = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") setNotificationCount(detail.count);
      else setAuthRevision((value) => value + 1);
    };
    window.addEventListener("gxj:notifications-changed", updateCount);
    return () => {
      active = false;
      window.removeEventListener("gxj:notifications-changed", updateCount);
    };
  }, [loadNotifications, pathname, authRevision]);

  return (
    <div className="flex items-center gap-2">
      <AccountNavigation />
      <Link
        to="/notifications"
        aria-label={notificationCount > 0 ? "Notifications - unread reminder" : "Notifications"}
        aria-current={pathname === "/notifications" ? "page" : undefined}
        className={`relative grid size-10 place-items-center rounded-full border transition-colors ${
          pathname === "/notifications"
            ? "border-foreground bg-foreground text-background"
            : "border-border hover:bg-muted"
        }`}
      >
        <Bell aria-hidden="true" className="size-4" />
        {notificationCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive"
          />
        ) : null}
      </Link>
    </div>
  );
}
