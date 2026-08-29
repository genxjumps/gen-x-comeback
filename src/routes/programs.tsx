import { createFileRoute } from "@tanstack/react-router";

import { PlatformPage } from "@/components/platform-page";

export const Route = createFileRoute("/programs")({
  head: () => ({
    meta: [
      { title: "Explore Programs | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Programs,
});

function Programs() {
  return (
    <PlatformPage
      kicker="Explore Programs"
      title="Find Your Next Program"
      description="Gen X Jumps is built around structured programs that tell you what to do next - not an endless video library."
    >
      <section className="rounded-lg border border-border bg-card p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gxj-teal">
          Enrollment closed during development
        </p>
        <h2 className="mt-2 text-xl font-semibold">28-Day Fat Loss Accelerator</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The program can appear here without opening checkout or making any payment-provider call.
        </p>
      </section>
    </PlatformPage>
  );
}
