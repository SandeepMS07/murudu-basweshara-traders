"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { formatRangeLabel, type DateRange } from "@/lib/date-range";
import { cn } from "@/lib/utils";

interface DashboardFilterBarProps {
  range: DateRange;
  customer: string;
  customers: string[];
  /** IST "today" from the server, so presets resolve the same on both sides. */
  today: string;
  /** Rows the current filter matches, for the "n of m" readout. */
  matched: number;
  total: number;
}

/**
 * Dashboard filters, held in the URL rather than component state.
 *
 * The URL is the source of truth so a filtered dashboard can be bookmarked,
 * shared, or reloaded without losing the view — and so the page stays a server
 * component that aggregates the already-filtered data, rather than shipping
 * every purchase, sale and bilty to the browser to filter there.
 */
export function DashboardFilterBar({
  range,
  customer,
  customers,
  today,
  matched,
  total,
}: DashboardFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const apply = (next: { range?: DateRange; customer?: string }) => {
    const params = new URLSearchParams();
    const resolvedRange = next.range ?? range;
    const resolvedCustomer = next.customer ?? customer;

    // Only non-default values go in the URL, so the common case stays a clean
    // /dashboard link.
    if (resolvedRange.from) params.set("from", resolvedRange.from);
    if (resolvedRange.to) params.set("to", resolvedRange.to);
    // An explicitly empty range is "All time", which is NOT the default, so it
    // needs a marker of its own to survive a reload.
    if (!resolvedRange.from && !resolvedRange.to) params.set("range", "all");
    if (resolvedCustomer) params.set("customer", resolvedCustomer);

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-2xl border border-[#1f2229] bg-[#14161b] p-3",
        isPending && "opacity-60",
      )}
    >
      <DateRangeFilter
        value={range}
        onChange={(nextRange) => apply({ range: nextRange })}
        today={new Date(`${today}T00:00:00`)}
      />

      <select
        value={customer}
        onChange={(event) => apply({ customer: event.target.value })}
        aria-label="Filter by customer"
        className="h-9 min-w-48 max-w-full cursor-pointer rounded-lg bg-[#0f1115] px-2.5 text-sm text-zinc-200 ring-1 ring-inset ring-[#242832]"
      >
        <option value="">All customers</option>
        {customers.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <span className="ml-auto text-xs text-zinc-500">
        {isPending ? "Updating…" : `${matched} of ${total} sales · ${formatRangeLabel(range)}`}
      </span>
    </div>
  );
}
