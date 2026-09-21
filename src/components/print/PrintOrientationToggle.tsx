"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  applyPrintOrientation,
  readStoredOrientation,
  storeOrientation,
  subscribeOrientation,
  type PrintOrientation,
} from "@/lib/print-orientation";
import { cn } from "@/lib/utils";

interface UsePrintOrientationOptions {
  /** localStorage key suffix, so each printable surface keeps its own choice. */
  storageKey: string;
  defaultOrientation?: PrintOrientation;
  /** Page margin for the unnamed `@page`. */
  margin?: string;
}

/**
 * The remembered orientation for one printable surface, without touching the
 * page. Use this where the choice is made in one document but applied in
 * another — a dialog that prints a hidden iframe, say, which receives the
 * choice as `?orient=`.
 */
export function usePrintOrientationChoice({
  storageKey,
  defaultOrientation = "portrait",
}: Omit<UsePrintOrientationOptions, "margin">) {
  const orientation = useSyncExternalStore(
    subscribeOrientation,
    () => readStoredOrientation(storageKey, defaultOrientation),
    () => defaultOrientation,
  );

  const setOrientation = useCallback(
    (next: PrintOrientation) => storeOrientation(storageKey, next),
    [storageKey],
  );

  return { orientation, setOrientation };
}

/**
 * Owns the orientation of the document it runs in. Statement views are also
 * rendered inside a print iframe, in which case `document` here is the
 * iframe's own document — which is exactly the one the browser prints.
 */
export function usePrintOrientation({
  storageKey,
  defaultOrientation = "portrait",
  margin = "10mm",
}: UsePrintOrientationOptions) {
  const { orientation, setOrientation } = usePrintOrientationChoice({
    storageKey,
    defaultOrientation,
  });

  useEffect(() => {
    applyPrintOrientation(document, orientation, margin);
  }, [orientation, margin]);

  return { orientation, setOrientation };
}

interface PrintOrientationToggleProps {
  orientation: PrintOrientation;
  onChange: (orientation: PrintOrientation) => void;
  /** Statement pages print on white; dialogs sit on the app's dark chrome. */
  tone?: "light" | "dark";
  className?: string;
}

export function PrintOrientationToggle({
  orientation,
  onChange,
  tone = "light",
  className,
}: PrintOrientationToggleProps) {
  const isDark = tone === "dark";

  return (
    <div
      role="group"
      aria-label="Page orientation"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-lg border p-0.5 print:hidden",
        isDark
          ? "border-[#2a2d34] bg-[#1b1e24]"
          : "border-zinc-300 bg-white",
        className,
      )}
    >
      {(["portrait", "landscape"] as const).map((value) => {
        const active = orientation === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={cn(
              "cursor-pointer rounded-md px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
              active
                ? "bg-[#ff6a3d] text-white"
                : isDark
                  ? "text-zinc-400 hover:bg-[#23262e] hover:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
            )}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}
