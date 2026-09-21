import "server-only";

/**
 * Reads every row of a query, paging past PostgREST's response cap.
 *
 * WHY THIS EXISTS
 * Supabase caps a single REST response at `db-max-rows` — 1000 on this
 * project, confirmed against audit_logs, which holds 2597 rows and returns
 * exactly 1000 with `Content-Range: 0-999/*`.
 *
 * The cap does not error. It silently returns a short list, and the caller
 * cannot tell a truncated read from a complete one. For this app that would
 * mean a dashboard total quietly dropping rows, a statement missing bills, and
 * FIFO payment allocation matching payments against a partial sale history —
 * wrong numbers, with nothing in the logs.
 *
 * At the time of writing the largest table the app reads is sales_invoices at
 * 352 rows, so nothing is truncated yet; purchases grows by roughly 300 a year.
 * This removes the deadline rather than tracking it.
 *
 * Pass a builder that takes a row window, so ordering and filters stay with the
 * caller:
 *
 *   const rows = await selectAll((from, to) =>
 *     supabaseServer.from("sales").select("*").order("sale_date").range(from, to),
 *   );
 */

/** Matches the server's cap. A larger page is silently trimmed to it anyway. */
const PAGE_SIZE = 1000;

/**
 * Guards against a runaway loop if a query somehow never returns a short page
 * (a view whose row count changes under us, say). One million rows is far
 * beyond anything this business will hold, so hitting it means something is
 * wrong and should be loud.
 */
const MAX_PAGES = 1000;

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

export async function selectAll<T>(
  build: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const all: T[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE;
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    all.push(...rows);

    // A short page is the end of the data. A full page might be the end too,
    // so the next request settles it — one extra round trip on an exact
    // multiple of the page size is cheaper than guessing wrong.
    if (rows.length < PAGE_SIZE) break;
  }

  return all;
}
