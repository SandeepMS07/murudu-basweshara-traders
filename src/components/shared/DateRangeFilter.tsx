"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import {
  DATE_RANGE_PRESETS,
  matchingPreset,
  resolvePreset,
  type DateRange,
} from "@/lib/date-range";

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
        {DATE_RANGE_PRESETS.map((preset) => {
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
