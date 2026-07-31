import { Link, useRouterState } from "@tanstack/react-router";

/**
 * Compact sticky bottom navigation for private plan pages only.
 * Never rendered on the public landing page, assessment, or lead gate.
 */
export function PlanNav() {
  const { pathname, hash } = useRouterState({
    select: (s) => ({ pathname: s.location.pathname, hash: s.location.hash }),
  });

  const onHub = pathname === "/your-plan" || pathname === "/your-plan/";
  const active = {
    plan: onHub && !hash,
    current: onHub && hash === "current",
    guidance: onHub && hash === "guidance",
  };

  const base =
    "flex-1 rounded-md px-3 py-2 text-center text-xs font-medium uppercase tracking-widest transition-colors";

  return (
    <nav
      aria-label="Plan navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 py-2">
        <Link
          to="/your-plan"
          aria-current={active.plan ? "page" : undefined}
          className={`${base} ${active.plan ? "bg-muted text-foreground" : "text-muted-foreground"}`}
        >
          Plan
        </Link>
        <Link
          to="/your-plan"
          hash="current"
          aria-current={active.current ? "page" : undefined}
          className={`${base} ${active.current ? "bg-muted text-foreground" : "text-muted-foreground"}`}
        >
          Current
        </Link>
        <Link
          to="/your-plan"
          hash="guidance"
          aria-current={active.guidance ? "page" : undefined}
          className={`${base} ${active.guidance ? "bg-muted text-foreground" : "text-muted-foreground"}`}
        >
          Guidance
        </Link>
      </div>
    </nav>
  );
}
