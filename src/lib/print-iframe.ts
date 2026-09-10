const TITLE_HOLD_MS = 4000;

/**
 * Prints a same-origin iframe's contents while suggesting `filename` as the
 * default "Save as PDF" name.
 *
 * Chrome derives that suggestion from the *parent* document's title, not the
 * iframe's own title — a known Chromium bug
 * (https://issues.chromium.org/issues/382394786) — and reads it
 * asynchronously after `print()` returns. Restoring the title on
 * "afterprint" fires too early (before Chrome reads it for the Save dialog),
 * so the override is instead held for a fixed window, guarded against being
 * overwritten in the meantime.
 */
export function printIframeAs(
  frameWindow: Window | null | undefined,
  filename: string,
) {
  if (!frameWindow) return;

  try {
    frameWindow.document.title = filename;
  } catch {
    // cross-origin frame; ignore
  }

  const previousTitle = document.title;
  document.title = filename;

  const titleEl = document.querySelector("title");
  const observer = titleEl
    ? new MutationObserver(() => {
        if (document.title !== filename) {
          document.title = filename;
        }
      })
    : null;
  observer?.observe(titleEl as Node, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  frameWindow.focus();
  frameWindow.print();

  setTimeout(() => {
    observer?.disconnect();
    document.title = previousTitle;
  }, TITLE_HOLD_MS);
}
