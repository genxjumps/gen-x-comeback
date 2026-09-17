import type { ReactNode } from "react";

import { PlatformPage } from "@/components/platform-page";
import type { WorkoutOverviewItem } from "@/lib/workout-presentation";

export function WorkoutOverview({ items }: { items: WorkoutOverviewItem[] }) {
  const columns =
    items.length >= 4 ? "sm:grid-cols-4" : items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";

  return (
    <section className="pb-7 pt-8" aria-labelledby="workout-overview">
      <h2
        id="workout-overview"
        className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl"
      >
        Workout Overview
      </h2>
      <dl className={`mt-4 grid grid-cols-2 border-l border-t border-foreground/25 ${columns}`}>
        {items.map(({ label, value }) => (
          <div
            key={label}
            className="flex min-h-32 flex-col justify-center border-b border-r border-foreground/25 p-4"
          >
            <dt className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </dt>
            <dd className="gxj-display-title mt-3 text-xl uppercase leading-[0.95] tracking-wide sm:text-2xl">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function WorkoutNotes({ children }: { children: ReactNode }) {
  return (
    <section className="border-t-2 border-foreground/20 py-7" aria-labelledby="workout-notes">
      <h2
        id="workout-notes"
        className="gxj-display-title text-2xl uppercase tracking-wide sm:text-3xl"
      >
        Workout Notes
      </h2>
      <div className="mt-4 space-y-5 leading-relaxed">{children}</div>
    </section>
  );
}

export function WorkoutScreen({
  kicker,
  title,
  description,
  media,
  overview,
  notes,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  media: ReactNode;
  overview: WorkoutOverviewItem[];
  notes?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <PlatformPage
      kicker={kicker}
      title={title}
      description={description}
      titleSize="compact"
      contentGap="tight"
    >
      {media}
      <WorkoutOverview items={overview} />
      {notes ? <WorkoutNotes>{notes}</WorkoutNotes> : null}
      {children}
    </PlatformPage>
  );
}
