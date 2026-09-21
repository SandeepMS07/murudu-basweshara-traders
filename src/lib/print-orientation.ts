/**
 * Paper orientation for everything this app prints.
 *
 * Every printable surface used to hard-code `@page { size: A4 portrait }`,
 * which suited the tall statements but squeezed the wide ledgers. The choice
 * now lives at runtime: one `<style>` element, rewritten in place, owns the
 * `@page` rules for whichever document is about to be printed.
 */

export type PrintOrientation = "portrait" | "landscape";

export const PRINT_ORIENTATIONS: readonly PrintOrientation[] = [
  "portrait",
  "landscape",
];

const STYLE_ID = "print-orientation";
const STORAGE_PREFIX = "print-orientation:";

/**
 * The named pages declared in globals.css. A `page: purchase-sheet` element
 * ignores the unnamed `@page`, so the named sheets have to be re-declared
 * alongside it — their margins stay as globals.css set them.
 */
const NAMED_SHEET_MARGINS: Record<string, string> = {
  "purchase-sheet": "4mm",
  "sales-sheet": "5mm",
};

export function isPrintOrientation(value: unknown): value is PrintOrientation {
  return value === "portrait" || value === "landscape";
}

/**
 * Writes the `@page` rules into `doc`. Safe to call repeatedly: the style
 * element is reused, and re-appended so it stays last in the head and wins
 * over the static `@page` in globals.css.
 */
export function applyPrintOrientation(
  doc: Document | null | undefined,
  orientation: PrintOrientation,
  margin = "10mm",
) {
  if (!doc?.head) return;

  const named = Object.entries(NAMED_SHEET_MARGINS)
    .map(
      ([name, sheetMargin]) =>
        `@page ${name} { size: A4 ${orientation}; margin: ${sheetMargin}; }`,
    )
    .join("\n");

  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement("style");
    style.id = STYLE_ID;
  }
  style.textContent = `@page { size: A4 ${orientation}; margin: ${margin}; }\n${named}`;
  doc.head.appendChild(style);
  doc.documentElement.dataset.printOrientation = orientation;
}

export function readStoredOrientation(
  key: string,
  fallback: PrintOrientation,
): PrintOrientation {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(STORAGE_PREFIX + key);
    return isPrintOrientation(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

export function storeOrientation(key: string, orientation: PrintOrientation) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, orientation);
  } catch {
    // Private mode / blocked storage: the choice just won't be remembered.
  }
  for (const listener of listeners) listener();
}

/**
 * The stored choice is the single source of truth, so the toggles read it
 * through useSyncExternalStore rather than mirroring it into component state.
 * `storage` events cover other tabs; the listener set covers this one.
 */
const listeners = new Set<() => void>();

export function subscribeOrientation(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}
