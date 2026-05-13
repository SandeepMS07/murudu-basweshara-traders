import { z } from "zod";

export const gunnyPaymentModeEnum = z.enum(["none", "cash", "upi", "rtgs"]);
export type GunnyPaymentMode = z.infer<typeof gunnyPaymentModeEnum>;

export const gunnyRecordSchema = z.object({
  id: z.string().optional(),
  bill_no: z.number().int().min(1, "Bill number is required"),
  date: z.string().min(1, "Date is required"),
  seller: z.string().trim().min(1, "Seller is required"),
  bags: z.coerce.number().min(0, "Bags must be positive"),
  rate: z.coerce.number().min(0, "Rate must be positive"),
  amount: z.coerce.number().min(0, "Amount must be positive"),
  paid_amount: z.coerce.number().min(0).default(0),
  payment_mode: gunnyPaymentModeEnum.default("none"),
  upi_number: z.string().trim().default(""),
  rtgs_name: z.string().trim().default(""),
  note: z.string().trim().default(""),
  source: z.enum(["manual", "app"]).default("app"),
});

export type GunnyRecordInput = z.infer<typeof gunnyRecordSchema>;

export interface GunnyRecord extends Omit<GunnyRecordInput, "id"> {
  id: string;
  pending_amount: number;
  created_at?: string;
  updated_at?: string;
}

export interface GunnySeller {
  id: string;
  name: string;
  place: string;
  mob: string;
  created_at?: string;
  updated_at?: string;
}

export const gunnySellerSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Name is required"),
  place: z.string().trim().default(""),
  mob: z.string().trim().default(""),
});

export type GunnySellerInput = z.infer<typeof gunnySellerSchema>;

export const gunnySellerPaymentSchema = z.object({
  id: z.string().optional(),
  seller_id: z.string().trim().min(1, "Seller is required"),
  paid_on: z.string().trim().min(1, "Date is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  payment_mode: gunnyPaymentModeEnum.default("none"),
  upi_number: z.string().trim().default(""),
  rtgs_name: z.string().trim().default(""),
  note: z.string().trim().default(""),
  allocations: z
    .array(
      z.object({
        record_id: z.string().trim().min(1, "Record is required"),
        amount: z.coerce.number().positive("Amount must be greater than zero"),
      }),
    )
    .default([]),
});

export type GunnySellerPaymentInput = z.infer<typeof gunnySellerPaymentSchema>;

export interface GunnySellerPayment {
  id: string;
  seller_id: string;
  paid_on: string;
  amount: number;
  payment_mode: GunnyPaymentMode;
  upi_number: string;
  rtgs_name: string;
  note: string;
  created_at?: string;
  updated_at?: string;
}

export const gunnySellerPaymentAllocationSchema = z.object({
  payment_id: z.string().trim().min(1, "Payment is required"),
  record_id: z.string().trim().min(1, "Record is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
});

export type GunnySellerPaymentAllocationInput = z.infer<
  typeof gunnySellerPaymentAllocationSchema
>;

export interface GunnySellerPaymentAllocation {
  id: string;
  payment_id: string;
  record_id: string;
  amount: number;
  created_at?: string;
  updated_at?: string;
}
