import { z } from "zod";

/**
 * Soya Parties — the sell side, modelled column-for-column on the PARTIES half
 * of the SALES sheet in the customer's workbook (columns 13-26) plus the LORRY
 * NO and FACTORY columns the per-party ledger tabs carry:
 *
 *   13 SL NO · 14 DATE · 15 BILL NO · 16 BAGS · 17 NET WT · 18 RATE
 *   19 AMOUNT · 20 2.5%CGST · 21 2.5%SGST · 22 TCS · 23 AMOUNT
 *   24 FREIGHT · 25 PARTY · 26 FRIGHT
 *
 * AMOUNT appears twice: column 19 is the taxable value and column 23 the
 * invoice total. They are `amount` and `total_amount` here.
 *
 * FREIGHT (24) and FRIGHT (26) are two separate columns in the sheet, not a
 * typo of one: 24 holds a per-trip rate (260, 270) and 26 a lump amount
 * (90480, 82080). Neither is derived from the other in the source data, so both
 * are plain manual fields.
 *
 * BILL NO is text, not a number — the workbook opens the year with "29*1".
 */
export const CGST_PERCENT = 2.5;
export const SGST_PERCENT = 2.5;

export const soyaPartyEntrySchema = z.object({
  id: z.string().optional(),
  sl_no: z.number().int().nullable().optional().default(null),
  date: z.string().min(1, "Date is required"),
  bill_no: z.string().trim().min(1, "Bill no is required"),
  lorry_no: z.string().trim().default(""),
  bags: z.number().min(0, "Bags must be positive").default(0),
  net_wt: z.number().min(0, "Net weight must be positive"),
  rate: z.number().min(0, "Rate must be positive"),
  /** Manual entry: every row in the source workbook is 0 or blank. */
  tcs: z.number().min(0).default(0),
  freight: z.number().min(0).default(0),
  fright: z.number().min(0).default(0),
  party: z.string().trim().min(1, "Party is required"),
  /** Which factory the goods came from; the ledger tabs record it. */
  factory: z.string().trim().default(""),
});

export type SoyaPartyEntryInput = z.infer<typeof soyaPartyEntrySchema>;

/** Pre-defaults shape, for form values. */
export type SoyaPartyEntryDraft = z.input<typeof soyaPartyEntrySchema>;

export interface SoyaPartyEntry extends SoyaPartyEntryInput {
  id: string;
  /** Column 19 — NET WT x RATE. */
  amount: number;
  /** Column 20 — 2.5%CGST. */
  cgst: number;
  /** Column 21 — 2.5%SGST. */
  sgst: number;
  /** Column 23 — amount + CGST + SGST + TCS. */
  total_amount: number;
}

/** The party master. The workbook tracks nothing but the name. */
export const soyaPartySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Party name is required"),
});

export type SoyaPartyInput = z.infer<typeof soyaPartySchema>;

export interface SoyaParty {
  id: string;
  name: string;
}

/**
 * Payments received from a party. The per-party ledger tabs use a five-column
 * block: SL NO · DATE · BANK · AMOUNT · REMRKS.
 */
export const soyaPartyPaymentSchema = z.object({
  id: z.string().optional(),
  party_id: z.string().trim().min(1, "Party is required"),
  paid_on: z.string().trim().min(1, "Payment date is required"),
  bank: z.string().trim().default(""),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  remarks: z.string().trim().default(""),
});

export type SoyaPartyPaymentInput = z.infer<typeof soyaPartyPaymentSchema>;

export interface SoyaPartyPayment {
  id: string;
  party_id: string;
  paid_on: string;
  bank: string;
  amount: number;
  remarks: string;
  created_at?: string;
  updated_at?: string;
}
