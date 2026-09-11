"use client";

import { useMemo } from "react";
import {
  endOfMonth,
  format,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

import { cn } from "@/lib/utils";
import { getFinancialYearBounds } from "@/lib/financial-year";

/** Inclusive `yyyy-MM-dd` bounds. An empty string means "unbounded". */
export type DateRange = { from: string; to: string };

export type DateRangePresetKey =
  | "this_month"
  | "last_month"
  | "last_90"
  | "this_fy"
  | "all";

const ISO = "yyyy-MM-dd";

/**
 * Resolved against a caller-supplied "today" so the server and client agree —
 * this app works in IST, and the page already computes an IST-adjusted now.
 */
export function resolvePreset(key: DateRangePresetKey, today: Date): DateRange {
  switch (key) {
    case "this_month":
      return {
        from: format(startOfMonth(today), ISO),
        to: format(endOfMonth(today), ISO),
      };
    case "last_month": {
      const previous = subMonths(today, 1);
      return {
        from: format(startOfMonth(previous), ISO),
        to: format(endOfMonth(previous), ISO),
      };
    }
    case "last_90":
      return {
        from: format(subDays(today, 89), ISO),
        to: format(today, ISO),
      };
    case "this_fy": {
      const { start, end } = getFinancialYearBounds(today);
      return { from: start, to: end };
    }
    case "all":
      return { from: "", to: "" };
  }
}

const PRESETS: { key: DateRangePresetKey; label: string }[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_90", label: "Last 90 days" },
  { key: "this_fy", label: "This FY" },
  { key: "all", label: "All time" },
];

/** True when the range is exactly what a preset resolves to. */
function matchingPreset(
  range: DateRange,
  today: Date,
): DateRangePresetKey | null {
  for (const { key } of PRESETS) {
    const resolved = resolvePreset(key, today);
    if (resolved.from === range.from && resolved.to === range.to) return key;
  }
  return null;
}

/** Inclusive date test. An empty bound is open-ended. */
export function isWithinRange(date: string, range: DateRange): boolean {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** "Today" in the app's timezone, so presets match the server's view. */
  today: Date;
  className?: string;
}

export function DateRangeFilter({
  value,
  onChange,
  today,
  className,
}: DateRangeFilterProps) {
  const activePreset = useMemo(
    () => matchingPreset(value, today),
    [value, today],
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* shrink-0 + nowrap: the pills must stay on one line, so when space runs
          short the selects beside them shrink and this group wraps whole. */}
      <div className="flex h-9 shrink-0 items-center gap-0.5 overflow-x-auto rounded-lg bg-[#0f1115] p-1 ring-1 ring-inset ring-[#242832]">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => onChange(resolvePreset(preset.key, today))}
              aria-pressed={isActive}
              className={cn(
                "cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "bg-[#ff6a3d] text-white shadow-[0_1px_6px_rgba(255,106,61,0.35)]"
                  : "text-zinc-400 hover:bg-[#1b1e25] hover:text-zinc-100",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-[#0f1115] px-2.5 ring-1 ring-inset ring-[#242832]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          From
        </span>
        <input
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          aria-label="From date"
          className="w-30 cursor-pointer rounded bg-transparent text-xs text-zinc-100 outline-none focus-visible:ring-1 focus-visible:ring-[#ff6a3d]"
        />
        <span className="h-4 w-px bg-[#242832]" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          To
        </span>
        <input
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          aria-label="To date"
          className="w-30 cursor-pointer rounded bg-transparent text-xs text-zinc-100 outline-none focus-visible:ring-1 focus-visible:ring-[#ff6a3d]"
        />
        {activePreset === null ? (
          <span className="ml-0.5 whitespace-nowrap rounded bg-[#2a2412] px-1.5 py-0.5 text-[10px] font-medium text-[#f7e3b0]">
            Custom
          </span>
        ) : null}
      </div>
    </div>
  );
}
