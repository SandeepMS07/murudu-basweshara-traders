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
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#2a2d34] bg-[#14161b] p-1">
        {PRESETS.map((preset) => {
          const isActive = activePreset === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => onChange(resolvePreset(preset.key, today))}
              aria-pressed={isActive}
              className={cn(
                "cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-[#ff6a3d] text-white"
                  : "text-zinc-400 hover:bg-[#1d2026] hover:text-zinc-100",
              )}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[#2a2d34] bg-[#14161b] px-3 py-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          From
        </label>
        <input
          type="date"
          value={value.from}
          max={value.to || undefined}
          onChange={(event) => onChange({ ...value, from: event.target.value })}
          className="h-7 cursor-pointer rounded border border-transparent bg-transparent text-xs text-zinc-100 outline-none focus:border-[#2a2d34]"
        />
        <span className="text-zinc-600">|</span>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          To
        </label>
        <input
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(event) => onChange({ ...value, to: event.target.value })}
          className="h-7 cursor-pointer rounded border border-transparent bg-transparent text-xs text-zinc-100 outline-none focus:border-[#2a2d34]"
        />
        {activePreset === null ? (
          <span className="ml-1 whitespace-nowrap rounded border border-[#3d3418] bg-[#2a2412]/40 px-1.5 py-0.5 text-[10px] text-[#f7e3b0]">
            Custom
          </span>
        ) : null}
      </div>
    </div>
  );
}
