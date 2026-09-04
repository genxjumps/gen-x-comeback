import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import type { AdminCustomerProgress, AdminProgramStatus } from "@/lib/admin/customer-progress";
import { getPrivateCustomerProgress } from "@/lib/admin/functions";
import type { PrivateCustomerProgressResult } from "@/lib/admin/types";
import { PlatformPage } from "@/components/platform-page";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({
    meta: [
      { title: "Private Customer Progress | Gen X Jumps" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PrivateCustomerProgress,
});

type CustomerFilter = "all" | "active" | "paused" | "completed" | "inactive";

const filters: { value: CustomerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "inactive", label: "Inactive 4+ days" },
];

const statusLabels: Record<AdminProgramStatus, string> = {
  not_started: "Enrolled, not started",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatMeasurement(value: { value: number; unit: string } | null): string {
  return value ? `${value.value} ${value.unit}` : "—";
}

function MeasurementLine({
  label,
  values,
}: {
  label: string;
  values: {
    weight: { value: number; unit: string } | null;
    waist: { value: number; unit: string } | null;
  };
}) {
  return (
    <p className="text-xs leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{label}:</span> Weight{" "}
      {formatMeasurement(values.weight)}
      <span aria-hidden="true"> · </span>Waist {formatMeasurement(values.waist)}
    </p>
  );
}

function CustomerCard({ customer }: { customer: AdminCustomerProgress }) {
  const inactivity =
    customer.inactiveDays !== null
      ? customer.inactiveDays === 0
        ? "Active today"
        : `Inactive for ${customer.inactiveDays} day${customer.inactiveDays === 1 ? "" : "s"}`
      : null;
  return (
    <article className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{customer.displayName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{customer.programName}</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
          {statusLabels[customer.status]}
        </span>
      </div>

      <dl className="mt-5 grid gap-4 border-y border-border py-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Current day
          </dt>
          <dd className="mt-1 font-semibold">
            {customer.currentDay
              ? `Day ${customer.currentDay} of 28`
              : customer.status === "completed"
                ? "Complete"
                : "Not started"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Last completed
          </dt>
          <dd className="mt-1 font-semibold">
            {customer.lastCompletedDay
              ? `Day ${customer.lastCompletedDay} · ${formatDate(customer.lastCompletedAt)}`
              : "No completed workout yet"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Run</dt>
          <dd className="mt-1 font-semibold">
            {customer.runNumber
              ? `Run ${customer.runNumber} · ${customer.completedDays} of 28`
              : "No run yet"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 space-y-1.5">
        <MeasurementLine label="Starting" values={customer.measurements.starting} />
        <MeasurementLine label="Latest" values={customer.measurements.latest} />
        <MeasurementLine label="Final" values={customer.measurements.final} />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {inactivity ?? `Last activity ${formatDate(customer.lastActivityAt)}`} · Enrolled{" "}
        {formatDate(customer.enrolledAt)}
      </p>
    </article>
  );
}

function PrivateCustomerProgress() {
  const loadCustomerProgress = useServerFn(getPrivateCustomerProgress);
  const [result, setResult] = useState<PrivateCustomerProgressResult | null>(null);
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void loadCustomerProgress({ data: {} })
      .then((next) => {
        if (active) setResult(next);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [loadCustomerProgress]);

  const customers = useMemo(() => {
    if (!result?.ok) return [];
    if (filter === "all") return result.customers;
    if (filter === "inactive") {
      return result.customers.filter(
        (customer) => customer.inactiveDays !== null && customer.inactiveDays >= 4,
      );
    }
    return result.customers.filter((customer) => customer.status === filter);
  }, [filter, result]);

  if (result && !result.ok) {
    return (
      <PlatformPage
        kicker="Private view"
        title="Customer Progress"
        description="This page is available only to the private Gen X Jumps operations account."
      >
        <section className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
          This account does not have access to customer progress.
        </section>
      </PlatformPage>
    );
  }

  return (
    <PlatformPage
      kicker="Private view"
      title="Customer Progress"
      description="Read-only Accelerator progress. This view does not change customer programs, payments, reminders, or access."
    >
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Customer progress could not be loaded. Refresh and try again.
        </p>
      ) : result === null ? (
        <p className="text-sm text-muted-foreground">Loading customer progress...</p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2" aria-label="Customer progress filters">
            {filters.map((item) => (
              <Button
                key={item.value}
                type="button"
                size="sm"
                variant={filter === item.value ? "default" : "outline"}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {customers.length ? (
            <div className="space-y-4">
              {customers.map((customer) => (
                <CustomerCard key={customer.customerId} customer={customer} />
              ))}
            </div>
          ) : (
            <section className="rounded-lg border border-dashed border-border bg-muted/35 p-8 text-center">
              <p className="text-sm font-semibold">No matching Accelerator customers</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Customer progress will appear here after Accelerator ownership is created.
              </p>
            </section>
          )}
        </>
      )}
    </PlatformPage>
  );
}
