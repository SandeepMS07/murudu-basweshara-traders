import { z } from "zod";

export const companyTypeEnum = z.enum(["issuer", "buyer"]);

export const companySchema = z.object({
  id: z.string().optional(),
  type: companyTypeEnum,
  name: z.string().trim().min(1, "Company name is required"),
  display_name: z.string().trim().default(""),
  code: z.string().trim().default(""),
  address: z.string().trim().default(""),
  phone: z.string().trim().default(""),
  email: z.string().trim().default(""),
  gstin: z.string().trim().default(""),
  bank_name: z.string().trim().default(""),
  bank_account_no: z.string().trim().default(""),
  bank_branch_ifsc: z.string().trim().default(""),
  invoice_prefix: z.string().trim().default(""),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false),
});

export const issuerCompanySchema = companySchema.refine(
  (company) => company.type !== "issuer" || company.invoice_prefix.trim().length > 0,
  {
    message: "Invoice prefix is required for issuer company",
    path: ["invoice_prefix"],
  }
);

export type CompanyInput = z.infer<typeof companySchema>;
export type IssuerCompanyInput = z.infer<typeof issuerCompanySchema>;

export const companyPaymentSchema = z.object({
  id: z.string().optional(),
  company_id: z.string().trim().min(1, "Company id is required"),
  paid_on: z.string().trim().min(1, "Payment date is required"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  note: z.string().trim().default(""),
  allocations: z
    .array(
      z.object({
        sale_id: z.string().trim().min(1, "Sale id is required"),
        amount: z.coerce.number().positive("Allocation amount must be greater than zero"),
      })
    )
    .default([]),
});

export type CompanyPaymentInput = z.infer<typeof companyPaymentSchema>;

export interface Company extends CompanyInput {
  id: string;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyPayment {
  id: string;
  company_id: string;
  paid_on: string;
  amount: number;
  note: string;
  created_at?: string;
  updated_at?: string;
}

export interface CompanyPaymentAllocation {
  id: string;
  payment_id: string;
  sale_id: string;
  amount: number;
  created_at?: string;
  updated_at?: string;
}
