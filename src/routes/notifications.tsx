import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";

import { PlatformPage } from "@/components/platform-page";

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
  return (
    <PlatformPage
      kicker="Notifications"
      title="Your Inbox"
      description="Program reminders and useful comeback messages will appear here after reminder behavior and preferences are built."
    >
      <section className="rounded-lg border border-dashed border-border bg-muted/35 p-8 text-center">
        <Bell aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
        <p className="mt-4 text-sm font-semibold">Nothing here yet</p>
        <p className="mt-1 text-xs text-muted-foreground">No notifications have been activated.</p>
      </section>
    </PlatformPage>
  );
}
