import { ArrowRight, ExternalLink } from "lucide-react";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { platformShellStyles as shell } from "@/components/platform-shell-styles";
import { PuEyebrow, PuHeading } from "@/design-system/precision/components";
import { reviewGroups, reviewScreens } from "@/lib/app-review";

export const Route = createFileRoute("/review")({
  head: () => ({
    meta: [
      { title: "App Review | Gen X Jumps" },
      { name: "description", content: "Private working index of Gen X Jumps app screens." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ReviewLayout,
});

function ReviewLayout() {
  return <Outlet />;
}

export function ReviewHub() {
  return (
    <div className={shell.shell}>
      <header className="border-b border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)]">
        <div className="mx-auto flex min-h-[4.5rem] w-full max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <span className={shell.brand}>Gen X Jumps</span>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--pu-text-secondary)]">
            App Review
          </p>
        </div>
      </header>

      <main className="gxj-app-surface mx-auto w-full max-w-[var(--pu-content-app)] px-5 pb-16 pt-7 sm:px-8 sm:pt-10 lg:px-10">
        <header className="max-w-3xl border-b border-[var(--pu-border-subtle)] pb-8">
          <PuEyebrow>Review Hub</PuEyebrow>
          <PuHeading level={1} hero className="mt-4">
            The Whole App, In One Place
          </PuHeading>
          <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-foreground/75 sm:text-lg">
            Each link opens an isolated scenario with sample data. Production routes remain the
            visual authority; review shares the production shell and control primitives. Nothing
            here signs in, changes a plan, records progress, or touches a real account.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
            <span>{reviewScreens.length} review states</span>
            <span>{reviewGroups.length} screen groups</span>
          </div>
        </header>

        <nav aria-label="App review screens">
          {reviewGroups.map((group) => {
            const screens = reviewScreens.filter((screen) => screen.group === group);
            return (
              <section
                key={group}
                className="border-b border-[var(--pu-border-subtle)] py-8 last:border-b-0"
              >
                <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
                  <div>
                    <PuHeading level={2}>{group}</PuHeading>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {screens.length} {screens.length === 1 ? "state" : "states"}
                    </p>
                  </div>
                  <div className="divide-y divide-[var(--pu-border-subtle)] border-t border-[var(--pu-border-subtle)]">
                    {screens.map((screen) => (
                      <a
                        key={screen.slug}
                        href={`/review/${screen.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="group grid min-h-20 grid-cols-[1fr_auto] items-center gap-4 py-4 focus-visible:outline-none focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px]"
                      >
                        <span>
                          <span className="block font-bold">{screen.title}</span>
                          <span className="mt-1 block text-sm text-muted-foreground">
                            {screen.state} <span aria-hidden="true">·</span> {screen.route}
                          </span>
                        </span>
                        <span className="flex items-center gap-2 text-sm font-bold">
                          <span className="hidden sm:inline">Open</span>
                          <ExternalLink className="size-4" aria-hidden="true" />
                          <ArrowRight
                            className="size-4 transition-transform group-hover:translate-x-1"
                            aria-hidden="true"
                          />
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </nav>
      </main>
    </div>
  );
}
