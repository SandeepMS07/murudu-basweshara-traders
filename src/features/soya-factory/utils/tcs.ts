import { round2 } from "@/features/soya/lib/money";

/**
 * TCS the factory charges on a purchase: 0.1% of whatever this bill takes the
 * factory's total for the financial year past Rs 50 lakh (the customer's rule,
 * from the old Income-tax s.206C(1H)).
 *
 * The total is per factory, per company (each firm is a separate buyer), and
 * restarts every April. The value counted is the bill amount including GST —
 * s.206C(1H) taxed the full consideration, with no GST deduction.
 *
 *   before the bill   this bill    TCS
 *   Rs 45 L           Rs 10 L      0.1% of Rs 5 L  = Rs 500
 *   Rs 60 L           Rs 10 L      0.1% of Rs 10 L = Rs 1,000
 *   Rs 20 L           Rs 10 L      0
 */
export const TCS_THRESHOLD = 5_000_000;
export const TCS_PERCENT = 0.1;

export function computeThresholdTcs(yearToDate: number, billValue: number): number {
  const before = Math.max(yearToDate, 0);
  const after = before + Math.max(billValue, 0);
  const taxable =
    Math.max(after - TCS_THRESHOLD, 0) - Math.max(before - TCS_THRESHOLD, 0);
  return round2((taxable * TCS_PERCENT) / 100);
}
