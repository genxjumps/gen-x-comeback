export const platformShellStyles = {
  shell:
    "gxj-platform-shell min-h-screen bg-[var(--pu-surface-page)] text-[var(--pu-text-primary)]",
  header:
    "gxj-platform-header sticky top-0 z-30 border-b border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] text-[var(--pu-text-primary)]",
  headerInner:
    "mx-auto flex h-[4.5rem] w-full max-w-[var(--pu-content-app)] items-center justify-between px-5 sm:px-8 lg:px-10",
  brand:
    "inline-flex min-h-11 shrink-0 items-center rounded-[var(--pu-radius-control)] border border-[var(--pu-border-strong)] px-3 text-xs font-bold uppercase leading-none tracking-[0.12em] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px]",
  desktopNav: "hidden items-center gap-1 lg:flex",
  desktopItemBase:
    "min-h-11 rounded-[var(--pu-radius-control)] px-3.5 py-3 text-sm font-bold transition-colors duration-[120ms] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[3px]",
  desktopItemActive: "bg-[var(--pu-surface-subtle)] text-[var(--pu-text-primary)]",
  desktopItemInactive:
    "text-[var(--pu-text-secondary)] hover:bg-[var(--pu-surface-subtle)] hover:text-[var(--pu-text-primary)]",
  main: "gxj-app-surface mx-auto w-full max-w-[var(--pu-content-app)] px-5 pb-28 sm:px-8 lg:px-10 lg:pb-14",
  mobileNav:
    "fixed inset-x-0 bottom-0 z-30 border-t border-[var(--pu-border-subtle)] bg-[var(--pu-surface-contained)] text-[var(--pu-text-primary)] pb-[env(safe-area-inset-bottom)] lg:hidden",
  mobileGrid: "mx-auto grid max-w-2xl grid-cols-4 gap-1 p-2",
  mobileItemBase:
    "flex min-h-[4.25rem] flex-col items-center justify-center gap-1 rounded-[var(--pu-radius-control)] px-1 text-xs font-bold transition-colors duration-[120ms] focus-visible:outline-[3px] focus-visible:outline-[var(--pu-action-primary)] focus-visible:outline-offset-[-1px]",
  mobileItemActive: "bg-[var(--pu-surface-subtle)] text-[var(--pu-text-primary)]",
  mobileItemInactive: "text-[var(--pu-text-secondary)]",
} as const;
