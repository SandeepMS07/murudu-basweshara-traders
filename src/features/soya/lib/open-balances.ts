/**
 * What each counterparty still owes (Parties) or is still owed (Factories), for
 * the Soya dashboard.
 *
 * Soya payments are recorded against a counterparty, not against a bill, so a
 * counterparty's pending amount is simply everything billed minus everything
 * paid — the same balance its ledger shows. To say *which* bills are still
 * open, paid money clears the oldest bills first (FIFO), the way the maize
 * ledger allocates.
 *
 * Bills name their counterparty as text while payments carry its id, so both
 * are matched on the trimmed, lower-cased name, exactly as SoyaLedgerManager
 * does.
 *
 * Deliberately not date-filtered: money owed on an old bill is still owed.
 */
export type OpenBalanceBill = {
  owner: string;
  date: string;
  sl_no: number | null;
  total: number;
};

export type OpenBalancePayment = { ownerId: string; amount: number };

export type OpenBalanceRow = {
  /** Master id, when the name matches a master record — used for links. */
  id: string | null;
  name: string;
  pending: number;
  pendingBillCount: number;
  /** Date of the oldest bill not yet fully paid. */
  oldestOpenDate: string;
};

// Totals carry 4 decimals (see money.ts); anything under half a rupee is
// rounding, not an open bill.
const EPSILON = 0.5;

export function ownerKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function computeOpenBalances(
  masters: { id: string; name: string }[],
  bills: OpenBalanceBill[],
  payments: OpenBalancePayment[],
): OpenBalanceRow[] {
  const masterByKey = new Map(masters.map((m) => [ownerKey(m.name), m]));
  const keyById = new Map(masters.map((m) => [m.id, ownerKey(m.name)]));

  const paidByKey = new Map<string, number>();
  for (const payment of payments) {
    const k = keyById.get(payment.ownerId);
    if (!k) continue;
    paidByKey.set(k, (paidByKey.get(k) ?? 0) + payment.amount);
  }

  const billsByKey = new Map<string, { name: string; rows: OpenBalanceBill[] }>();
  for (const bill of bills) {
    const k = ownerKey(bill.owner);
    if (!k) continue;
    const group = billsByKey.get(k) ?? { name: bill.owner.trim(), rows: [] };
    group.rows.push(bill);
    billsByKey.set(k, group);
  }

  const result: OpenBalanceRow[] = [];
  for (const [k, group] of billsByKey) {
    const oldestFirst = [...group.rows].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.sl_no ?? 0) - (b.sl_no ?? 0),
    );

    let unallocated = paidByKey.get(k) ?? 0;
    let pending = 0;
    let pendingBillCount = 0;
    let oldestOpenDate = "";
    for (const bill of oldestFirst) {
      const cleared = Math.min(unallocated, bill.total);
      unallocated -= cleared;
      const open = bill.total - cleared;
      if (open > EPSILON) {
        pending += open;
        pendingBillCount += 1;
        oldestOpenDate ||= bill.date;
      }
    }

    if (pendingBillCount > 0) {
      const master = masterByKey.get(k);
      result.push({
        id: master?.id ?? null,
        name: master?.name ?? group.name,
        pending,
        pendingBillCount,
        oldestOpenDate,
      });
    }
  }

  return result.sort((a, b) => b.pending - a.pending);
}
