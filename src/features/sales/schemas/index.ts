import { z } from "zod";

export const saleSourceEnum = z.enum(["manual", "import"]);

export const saleSchema = z.object({
  id: z.string().optional(),
  sl_no: z.number().int().nullable().default(null),
  bill_number: z.string().trim().min(1, "Bill number is required"),
  sale_date: z.string().min(1, "Date is required"),
  lorry_number: z.string().trim().default(""),
  party: z.string().trim().min(1, "Party is required"),
  payment_terms: z.string().trim().default(""),
  bags: z.number().min(0).default(0),
  net_weight: z.number().min(0).default(0),
  factory_weight: z.number().min(0).default(0),
  rate: z.number().min(0).default(0),
  flight: z.number().min(0).default(0),
  bag_avg: z.number().min(0).optional(),
  factory_rate: z.number().min(0).default(0),
  source: saleSourceEnum.default("manual"),
});

export type SaleInput = z.infer<typeof saleSchema>;

export interface Sale extends Omit<SaleInput, "bag_avg"> {
  id: string;
  bag_avg: number;
  amount: number;
  factory_amount: number;
  pending_amount: number;
  created_at?: string;
  updated_at?: string;
}

export type SalesImportSummary = {
  inserted: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
};
