import { round2, round4 } from "@/features/soya/lib/money";
import {
  CGST_PERCENT,
  SGST_PERCENT,
  type SoyaPartyEntry,
  type SoyaPartyEntryInput,
} from "@/features/soya-parties/schemas";

/**
 * Columns 19, 20, 21 and 23 of the PARTIES half of the SALES sheet:
 *   AMOUNT    = NET WT x RATE
 *   2.5%CGST  = AMOUNT x 2.5%
 *   2.5%SGST  = AMOUNT x 2.5%
 *   AMOUNT    = AMOUNT + CGST + SGST + TCS
 *
 * FREIGHT and FRIGHT are not part of the invoice total in the source sheet, so
 * they are carried but not added here.
 */
export function calculateSoyaPartyEntry(
  input: SoyaPartyEntryInput,
  id: string,
): SoyaPartyEntry {
  const amount = round2(input.net_wt * input.rate);
  const cgst = round4((amount * CGST_PERCENT) / 100);
  const sgst = round4((amount * SGST_PERCENT) / 100);
  // round4, not round2: the workbook's totals carry 3 decimals (….515).
  const total_amount = round4(amount + cgst + sgst + input.tcs);

  return { ...input, id, amount, cgst, sgst, total_amount };
}
