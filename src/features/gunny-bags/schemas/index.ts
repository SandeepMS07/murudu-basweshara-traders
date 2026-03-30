import { z } from "zod";

export const gunnyBagPurchaseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  party: z.string().trim().min(1, "Party is required"),
  bags: z.number().positive("Bags must be greater than zero"),
  rate: z.number().min(0, "Rate must be zero or more"),
  amount: z.number().min(0).optional(),
});

export const gunnyBagPaymentSchema = z.object({
  date: z.string().min(1, "Date is required"),
  party: z.string().trim().min(1, "Party is required"),
  mode: z.string().trim().min(1, "Mode is required"),
  amount: z.number().positive("Amount must be greater than zero"),
});

export type GunnyBagPurchaseInput = z.infer<typeof gunnyBagPurchaseSchema>;
export type GunnyBagPaymentInput = z.infer<typeof gunnyBagPaymentSchema>;
