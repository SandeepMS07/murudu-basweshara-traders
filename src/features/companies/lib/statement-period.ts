import type { CompanyPayment } from "@/features/companies/schemas";
import type { Sale } from "@/features/sales/schemas";
import { isWithinRange, type DateRange } from "@/lib/date-range";

/**
 * Narrows one customer's bills and payments to a date period.
 *
 * Shared by the Sale Companies screen (table + Excel export) and the printable
 * statement so the two can never disagree.
 *
 * `pendingBySaleId` must be computed over the customer's FULL history before
 * calling this: FIFO settles the oldest bill first, so narrowing the
 * allocator's input would move money between bills.
 */

export type EarlierOutstanding = { amount: number; count: number };

export type StatementPeriod = {
  sales: Sale[];
  payments: CompanyPayment[];
  /** Unpaid bills dated before `range.from`; null when there is no start date. */
  earlierOutstanding: EarlierOutstanding | null;
};

export function sliceStatementPeriod(
  sales: Sale[],
  payments: CompanyPayment[],
  pendingBySaleId: Record<string, number>,
  range: DateRange,
): StatementPeriod {
  if (!range.from && !range.to) {
    return { sales, payments, earlierOutstanding: null };
  }

  const inRange: Sale[] = [];
  const earlier: EarlierOutstanding = { amount: 0, count: 0 };

  for (const sale of sales) {
    if (isWithinRange(sale.sale_date, range)) {
      inRange.push(sale);
    } else if (range.from && sale.sale_date < range.from) {
      const pending = pendingBySaleId[sale.id] ?? sale.pending_amount;
      if (pending > 0) {
        earlier.amount += pending;
        earlier.count += 1;
      }
    }
  }

  return {
    sales: inRange,
    payments: payments.filter((p) => isWithinRange(p.paid_on, range)),
    earlierOutstanding: range.from ? earlier : null,
  };
}
