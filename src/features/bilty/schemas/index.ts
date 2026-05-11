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
  place: string;
  mob: string;
}

export const biltyPartyPaymentSchema = z
  .object({
    id: z.string().optional(),
    party_id: z.string().trim().min(1, "Party is required"),
    paid_on: z.string().trim().min(1, "Payment date is required"),
    amount: z.coerce.number().positive("Amount must be greater than zero"),
    payment_mode: z.enum(["none", "cash", "rtgs"]).default("none"),
    rtgs_name: z.string().trim().default(""),
    note: z.string().trim().default(""),
  })
  .superRefine((value, ctx) => {
    if (value.payment_mode === "rtgs" && value.rtgs_name.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "RTGS name is required for RTGS mode",
        path: ["rtgs_name"],
      });
    }
  });

export type BiltyPartyPaymentInput = z.infer<typeof biltyPartyPaymentSchema>;

export interface BiltyPartyPayment {
  id: string;
  party_id: string;
  paid_on: string;
  amount: number;
  payment_mode: "none" | "cash" | "rtgs";
  rtgs_name: string;
  note: string;
  created_at?: string;
  updated_at?: string;
}
