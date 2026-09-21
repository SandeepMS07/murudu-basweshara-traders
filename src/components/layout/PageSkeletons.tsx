import { AppShellSkeleton } from "@/components/layout/AppShellSkeleton";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared loading shapes for route-level `loading.tsx` files.
 *
 * Without a loading.tsx, a navigation to a server-rendered page shows the user
 * nothing at all until the data arrives — the old screen simply sits there, or
 * on a fresh load the window is blank. These give every route an immediate
 * response.
 *
 * Each shape is deliberately close to the real page's layout (cards where
 * cards will be, a wide block where the table will be), so the page does not
 * visibly jump when the content replaces it.
 */

/** Overview screens: KPI cards, a filter bar, then a table. */
export function ListPageSkeleton({
  cards = 4,
  showFilters = true,
}: {
  cards?: number;
  showFilters?: boolean;
}) {
  return (
    <AppShellSkeleton>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-10 w-36" />
      </div>
      {cards > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: cards }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      ) : null}
      {showFilters ? <Skeleton className="h-12 w-full" /> : null}
      <Skeleton className="h-[460px] w-full" />
    </AppShellSkeleton>
  );
}

/** Add / edit screens: a heading, then stacked field groups. */
export function FormPageSkeleton({ sections = 3 }: { sections?: number }) {
  return (
    <AppShellSkeleton>
      <Skeleton className="h-12 w-72" />
      {Array.from({ length: sections }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-2xl border border-[#1d1f24] p-4">
          <Skeleton className="h-4 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </AppShellSkeleton>
  );
}

/** Master screens with a record list beside a ledger. */
export function LedgerPageSkeleton() {
  return (
    <AppShellSkeleton>
      <Skeleton className="h-12 w-64" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-44" />
        ))}
      </div>
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-[420px] w-full" />
    </AppShellSkeleton>
  );
}

/**
 * Printable statements and invoices, which render on white and outside the
 * app shell — so this one carries no sidebar or dark chrome.
 */
export function PrintPageSkeleton() {
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-2 w-full animate-pulse rounded bg-zinc-200" />
        <div className="flex justify-between gap-6">
          <div className="h-16 w-64 animate-pulse rounded bg-zinc-200" />
          <div className="h-16 w-48 animate-pulse rounded bg-zinc-200" />
        </div>
        <div className="h-32 w-full animate-pulse rounded bg-zinc-100" />
        <div className="h-[520px] w-full animate-pulse rounded bg-zinc-100" />
      </div>
    </div>
  );
}
