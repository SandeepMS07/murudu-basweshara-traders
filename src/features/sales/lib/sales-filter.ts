import type { Sale } from "@/features/sales/schemas";
import { isWithinRange, type DateRange } from "@/lib/date-range";

/**
 * The Sales overview filter, shared by the on-screen view and the printable
 * statement. Both sides run the same predicate and the same totals so a
 * statement can never disagree with the table it was opened from.
 */
export type SalesFilter = {
  range: DateRange;
  /** Empty string means "all". */
  issuerId: string;
  buyerId: string;
};

export function filterSales(sales: Sale[], filter: SalesFilter): Sale[] {
  const { range, issuerId, buyerId } = filter;
  return sales.filter((sale) => {
    if (!isWithinRange(sale.sale_date, range)) return false;
    if (issuerId && sale.issuer_company_id !== issuerId) return false;
    if (buyerId && sale.sale_company_id !== buyerId) return false;
    return true;
  });
}

export type SalesTotals = {
  count: number;
  bags: number;
  netWeight: number;
  factoryWeight: number;
  amount: number;
  pending: number;
  /** What has actually been settled against the bills in view. */
  received: number;
};

/**
 * `pendingBySaleId` must be the FIFO-effective pending computed across *all*
 * sales, not just the filtered ones — payments settle the oldest bill first,
 * so narrowing the allocator's input would move money between bills.
 */
export function summariseSales(
  sales: Sale[],
  pendingBySaleId: Record<string, number>,
): SalesTotals {
  let bags = 0;
  let netWeight = 0;
  let factoryWeight = 0;
  let amount = 0;
  let pending = 0;

  for (const sale of sales) {
    bags += sale.bags;
    netWeight += sale.net_weight;
    factoryWeight += sale.factory_weight;
    amount += sale.amount;
    pending += effectivePending(sale, pendingBySaleId);
  }

  return {
    count: sales.length,
    bags,
    netWeight,
    factoryWeight,
    amount,
    pending,
    received: amount - pending,
  };
}

/** Clamped at zero: an over-payment on one bill must not credit another. */
export function effectivePending(
  sale: Sale,
  pendingBySaleId: Record<string, number>,
): number {
  return Math.max(pendingBySaleId[sale.id] ?? sale.pending_amount, 0);
}

/** Query string for the statement route, omitting anything left at "all". */
export function salesFilterToParams(filter: SalesFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.range.from) params.set("from", filter.range.from);
  if (filter.range.to) params.set("to", filter.range.to);
  if (filter.issuerId) params.set("issuer", filter.issuerId);
  if (filter.buyerId) params.set("buyer", filter.buyerId);
  return params;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shape alone is not enough — "2026-13-99" matches the pattern but is not a
 * date, and would print as "99-13-2026" in the statement header. Requiring a
 * clean round-trip rejects impossible months and days.
 */
function isRealIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

/** Anything unparseable degrades to "unbounded"/"all" rather than throwing. */
export function salesFilterFromParams(params: {
  from?: string;
  to?: string;
  issuer?: string;
  buyer?: string;
}): SalesFilter {
  const date = (value: string | undefined) =>
    value && isRealIsoDate(value) ? value : "";
  return {
    range: { from: date(params.from), to: date(params.to) },
    issuerId: params.issuer?.trim() || "",
    buyerId: params.buyer?.trim() || "",
  };
}
