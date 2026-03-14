import { z } from "zod";

export const salesInvoiceItemSchema = z.object({
  id: z.string().optional(),
  sales_invoice_id: z.string().optional(),
  sale_id: z.string(),
  description: z.string().trim().default(""),
  bags: z.number().min(0).default(0),
  net_weight: z.number().min(0).default(0),
  rate: z.number().min(0).default(0),
  amount: z.number().default(0),
});

export const salesInvoiceSchema = z.object({
  id: z.string().optional(),
  issuer_company_id: z.string().min(1, "Issuer company is required"),
  buyer_company_id: z.string().min(1, "Buyer company is required"),
  invoice_no: z.string().min(1),
  invoice_seq: z.number().int().min(1),
  issued_on: z.string().min(1),
  subtotal: z.number().default(0),
  total_amount: z.number().default(0),
  snapshot_json: z.record(z.string(), z.unknown()).default({}),
});

export const generateSalesInvoiceSchema = z.object({
  saleIds: z.array(z.string().min(1)).min(1, "Select at least one sale"),
  issuerCompanyId: z.string().min(1, "Issuer company is required"),
  issuedOn: z.string().optional(),
});

export type SalesInvoiceItemInput = z.infer<typeof salesInvoiceItemSchema>;
export type SalesInvoiceInput = z.infer<typeof salesInvoiceSchema>;
export type GenerateSalesInvoiceInput = z.infer<typeof generateSalesInvoiceSchema>;

export interface SalesInvoiceItem extends SalesInvoiceItemInput {
  id: string;
  sales_invoice_id: string;
  created_at?: string;
  updated_at?: string;
}

export interface SalesInvoice extends SalesInvoiceInput {
  id: string;
  items?: SalesInvoiceItem[];
  created_at?: string;
  updated_at?: string;
}
