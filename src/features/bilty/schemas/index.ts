import { z } from "zod";

const normalizedParty = z.string().trim().min(1, "Party is required");

const paymentMethodEnum = z.enum(["RTGS", "UPI", "CASH", "none"]);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

export const biltySchema = z.object({
  id: z.string().optional(),
  bill_no: z.number().int().min(1, "Bill number is required"),
  date: z.string().min(1, "Date is required"),
  party: normalizedParty,
  bags: z.number().min(0, "Bags must be positive").default(0),
  weight: z.number().min(0, "Weight must be positive"),
  less_percent: z.number().min(0).max(100).default(0),
  rate: z.number().min(0, "Rate must be positive"),
  bag_less: z.number().min(0).default(0),
  add_amount: z.number().min(0).default(0),
  cash_paid: z.number().min(0).default(0),
  upi_paid: z.number().min(0).default(0),
  payment_date: z.string().nullable().optional().default(null),
  source: z.enum(["manual", "app"]).default("app"),
  payment_through: paymentMethodEnum.default("none"),
});

export type BiltyInput = z.infer<typeof biltySchema>;

export interface Bilty extends BiltyInput {
  id: string;
  less_weight: number;
  net_weight: number;
  amount: number;
  final_total: number;
  bag_avg: number;
  name: string;
  place: string;
  mob: string;
}

export interface BiltyParty {
  id: string;
  name: string;
}
