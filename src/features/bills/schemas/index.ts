import { z } from "zod";

export const billSchema = z.object({
  id: z.string().optional(),
  bill_date: z.string().min(1, "Date is required"),
  net_weight: z.number().min(0, "Net weight must be positive"),
  rate: z.number().min(0, "Rate must be positive"),
  freight: z.number().min(0).default(0),
  payment_term_days: z.number().int().min(0).default(0),
  source: z.enum(["manual", "app"]).default("app"),
});

export type BillInput = z.infer<typeof billSchema>;

export interface Bill extends BillInput {
  id: string;
  bill_no: number;
  amount: number;
  final_amount: number;
  due_date: string;
}
