import { z } from "zod";

const paymentMethodEnum = z.enum(["RTGS", "UPI", "none"]);
export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

const normalizedMobile = z
  .string()
  .default("")
  .transform((value) => {
    if (!value) return "";
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return value;
  })
  .refine((value) => !value || /^\+91\d{10}$/.test(value), {
    message: "Mobile number must include +91 followed by 10 digits",
  });

export const purchaseSchema = z.object({
  id: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  name: z.string().default(""),
  place: z.string().default(""),
  mob: normalizedMobile,
  bags: z.number().min(0, "Bags must be positive").default(0),
  weight: z.number().min(0, "Weight must be positive"),
  less_percent: z.number().min(0).max(100).default(0),
  rate: z.number().min(0, "Rate must be positive"),
  bag_less: z.number().min(0).default(0),
  add_amount: z.number().min(0).default(0),
  cash_paid: z.number().min(0).default(0),
  upi_paid: z.number().min(0).default(0),
  source: z.enum(["manual", "app"]).default("app"),
  payment_through: paymentMethodEnum.default("none"),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;

export interface Purchase extends PurchaseInput {
  id: string; // Enforced after creation
  bill_no: number;
  less_weight: number;
  net_weight: number;
  amount: number;
  final_total: number;
  bag_avg: number;
}
