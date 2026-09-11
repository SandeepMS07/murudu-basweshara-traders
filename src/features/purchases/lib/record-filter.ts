import type { PaymentMethod } from "@/features/purchases/schemas";
import { isWithinRange, type DateRange } from "@/lib/date-range";

/**
 * The shape Purchases and Bilty have in common. Both `Purchase` and `Bilty`
 * satisfy it structurally, which is what lets the overview filter bar, the
 * totals and the printable statement be written once and used by both — the
 * same reuse the column factory already relies on.
 *
 * The counterparty is NOT part of this shape: Purchases keeps it in `name` and
 * Bilty in `party`, so callers pass a `partyOf` accessor instead.
 */
export interface LedgerRecord {
  id: string;
  bill_no: number;
  date: string;
  bags: number;
  weight: number;
  less_weight: number;
  net_weight: number;
  rate: number;
  amount: number;
  add_amount: number;
  cash_paid: number;
  upi_paid: number;
  final_total: number;
  payment_through: PaymentMethod;
  payment_date?: string | null;
}

export type PartyOf<T> = (record: T) => string;

export type LedgerFilter = {
  range: DateRange;
  /** Matched on the counterparty name. Empty string means "all". */
  party: string;
};

export function filterRecords<T extends LedgerRecord>(
  records: T[],
  filter: LedgerFilter,
  partyOf: PartyOf<T>,
): T[] {
  return records.filter((record) => {
    if (!isWithinRange(record.date, filter.range)) return false;
    // Case-insensitive: these names are free text, not ids from a master list,
    // so the same seller can be stored as "B nd M Farm" and "B ND M FARM".
    if (
      filter.party &&
      (partyOf(record) || "").trim().toLowerCase() !==
        filter.party.trim().toLowerCase()
    ) {
      return false;
    }
    return true;
  });
}

export type LedgerTotals = {
  count: number;
  bags: number;
  weight: number;
  lessWeight: number;
  netWeight: number;
  amount: number;
  addAmount: number;
  cashPaid: number;
  upiPaid: number;
  /** cash + upi, the figure the statement shows as one PAID column. */
  paid: number;
  /** `final_total`: amount - bag_less + add - paid, i.e. the balance. */
  total: number;
  /**
   * Weighted across the selection. Deliberately `total / netWeight` — that is
   * what the live Purchases and Bilty "Average Rate" card has always shown,
   * and this helper now feeds that card.
   */
  averageRate: number;
};

export function summariseRecords(records: LedgerRecord[]): LedgerTotals {
  const totals = {
    count: records.length,
    bags: 0,
    weight: 0,
    lessWeight: 0,
    netWeight: 0,
    amount: 0,
    addAmount: 0,
    cashPaid: 0,
    upiPaid: 0,
    paid: 0,
    total: 0,
    averageRate: 0,
  };

  for (const record of records) {
    totals.bags += record.bags;
    totals.weight += record.weight;
    totals.lessWeight += record.less_weight;
    totals.netWeight += record.net_weight;
    totals.amount += record.amount;
    totals.addAmount += record.add_amount;
    totals.cashPaid += record.cash_paid;
    totals.upiPaid += record.upi_paid;
    totals.total += record.final_total;
  }

  totals.paid = totals.cashPaid + totals.upiPaid;
  totals.averageRate =
    totals.netWeight > 0 ? totals.total / totals.netWeight : 0;

  return totals;
}

/** Distinct counterparty names, for the filter dropdown. */
export function partyOptions<T extends LedgerRecord>(
  records: T[],
  partyOf: PartyOf<T>,
): string[] {
  const seen = new Map<string, string>();
  for (const record of records) {
    const name = (partyOf(record) || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Query string for the statement route, omitting anything left at "all". */
export function ledgerFilterToParams(filter: LedgerFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (filter.range.from) params.set("from", filter.range.from);
  if (filter.range.to) params.set("to", filter.range.to);
  if (filter.party) params.set("party", filter.party);
  return params;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Shape alone is not enough — "2026-13-99" matches the pattern but is not a
 * date, and would print as "99-13-2026" in the statement header.
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
export function ledgerFilterFromParams(params: {
  from?: string;
  to?: string;
  party?: string;
}): LedgerFilter {
  const date = (value: string | undefined) =>
    value && isRealIsoDate(value) ? value : "";
  return {
    range: { from: date(params.from), to: date(params.to) },
    party: params.party?.trim() || "",
  };
}
