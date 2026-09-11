import {
  endOfMonth,
  format,
  startOfMonth,
  subDays,
  subMonths,
} from "date-fns";

import { getFinancialYearBounds } from "@/lib/financial-year";

/**
 * Pure range helpers, kept out of `DateRangeFilter.tsx` so that server
 * components (the Sales statement route) can call them too — a function
 * exported from a `"use client"` module reaches the server only as a client
 * reference, not as something callable.
 */

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

export const DATE_RANGE_PRESETS: {
  key: DateRangePresetKey;
  label: string;
}[] = [
  { key: "this_month", label: "This month" },
  { key: "last_month", label: "Last month" },
  { key: "last_90", label: "Last 90 days" },
  { key: "this_fy", label: "This FY" },
  { key: "all", label: "All time" },
];

/** True when the range is exactly what a preset resolves to. */
export function matchingPreset(
  range: DateRange,
  today: Date,
): DateRangePresetKey | null {
  for (const { key } of DATE_RANGE_PRESETS) {
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

/** "01-04-2026 → 31-03-2027", or an open-ended equivalent. */
export function formatRangeLabel(range: DateRange): string {
  const pretty = (iso: string) => {
    const [year, month, day] = iso.split("-");
    return day && month && year ? `${day}-${month}-${year}` : iso;
  };
  if (!range.from && !range.to) return "All time";
  if (!range.from) return `Up to ${pretty(range.to)}`;
  if (!range.to) return `From ${pretty(range.from)}`;
  return `${pretty(range.from)} to ${pretty(range.to)}`;
}
