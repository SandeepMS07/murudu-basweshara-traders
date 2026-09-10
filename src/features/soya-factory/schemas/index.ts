import { z } from "zod";

/**
 * Soya Factory — the buy side, modelled column-for-column on the FACTORY half
 * of the SALES sheet in the customer's workbook (columns 1-12) plus the PARTY
 * column the per-factory ledger tabs carry:
 *
 *   1 SL NO · 2 FACTORY · 3 DATE · 4 P B NO · 5 LORRY · 6 BAGS · 7 WEIGHT
 *   8 RATE · 9 AMOUNT · 10 GST 5 % · 11 TCS · 12 AMOUNT
 *
 * AMOUNT appears twice in the sheet: column 9 is the taxable value and column
 * 12 the invoice total. They are `amount` and `total_amount` here.
 *
 * P B NO is text, not a number — the workbook has values like "MI/75".
 */
export const GST_PERCENT = 5;

export const soyaFactoryEntrySchema = z.object({
  id: z.string().optional(),
  sl_no: z.number().int().nullable().optional().default(null),
  factory: z.string().trim().min(1, "Factory is required"),
  date: z.string().min(1, "Date is required"),
  pb_no: z.string().trim().default(""),
  lorry: z.string().trim().default(""),
  bags: z.number().min(0, "Bags must be positive").default(0),
  weight: z.number().min(0, "Weight must be positive"),
  rate: z.number().min(0, "Rate must be positive"),
  /** Manual entry: every row in the source workbook is 0 or blank. */
  tcs: z.number().min(0).default(0),
  /** Which party this lorry was sold on to; the ledger tabs record it. */
  party: z.string().trim().default(""),
});

export type SoyaFactoryEntryInput = z.infer<typeof soyaFactoryEntrySchema>;

/** Pre-defaults shape, for form values. */
export type SoyaFactoryEntryDraft = z.input<typeof soyaFactoryEntrySchema>;

export interface SoyaFactoryEntry extends SoyaFactoryEntryInput {
  id: string;
  /** Column 9 — WEIGHT x RATE. */
  amount: number;
  /** Column 10 — GST 5 %. */
  gst_amount: number;
  /** Column 12 — amount + GST + TCS. */
  total_amount: number;
}

/** The factory master. The workbook tracks nothing but the name. */
export const soyaFactorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Factory name is required"),
});

export type SoyaFactoryInput = z.infer<typeof soyaFactorySchema>;

export interface SoyaFactory {
  id: string;
  name: string;
}

/**
 * Payments made to a factory. The per-factory ledger tabs use a four-column
 * block: SL NO · DATE · BANK · AMOUNT.
 */
export const soyaFactoryPaymentSchema = z.object({
  id: z.string().optional(),
  factory_id: z.string().trim().min(1, "Factory is required"),
  paid_on: z.string().trim().min(1, "Payment date is required"),
  bank: z.string().trim().default(""),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
});

export type SoyaFactoryPaymentInput = z.infer<typeof soyaFactoryPaymentSchema>;

export interface SoyaFactoryPayment {
  id: string;
  factory_id: string;
  paid_on: string;
  bank: string;
  amount: number;
  created_at?: string;
  updated_at?: string;
}
