import { round2, round4 } from "@/features/soya/lib/money";
import {
  GST_PERCENT,
  type SoyaFactoryEntry,
  type SoyaFactoryEntryInput,
} from "@/features/soya-factory/schemas";

/**
 * Columns 9, 10 and 12 of the FACTORY half of the SALES sheet:
 *   AMOUNT   = WEIGHT x RATE
 *   GST 5 %  = AMOUNT x 5%
 *   AMOUNT   = AMOUNT + GST + TCS
 */
export function calculateSoyaFactoryEntry(
  input: SoyaFactoryEntryInput,
  id: string,
): SoyaFactoryEntry {
  const amount = round2(input.weight * input.rate);
  const gst_amount = round4((amount * GST_PERCENT) / 100);
  // round4, not round2: the workbook's totals carry 3 decimals (….515).
  const total_amount = round4(amount + gst_amount + input.tcs);

  return { ...input, id, amount, gst_amount, total_amount };
}
