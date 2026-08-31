import { createFileRoute } from "@tanstack/react-router";

import { PlatformPage } from "@/components/platform-page";

export const Route = createFileRoute("/nutrition")({
  head: () => ({
    meta: [
      { title: "Your Nutrition | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Nutrition,
});

function Nutrition() {
  return (
    <PlatformPage
      kicker="Your Nutrition"
      title="Protein First. Keep It Practical."
      description="Approved nutrition guidance will live here. Calorie and protein targets won't be calculated until their formulas are deliberately reviewed."
    >
      <section className="rounded-lg border border-dashed border-border bg-muted/35 p-6 text-center">
        <p className="text-sm font-semibold">Nutrition guidance placeholder</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          No unapproved target formula is active.
        </p>
      </section>
    </PlatformPage>
  );
}
