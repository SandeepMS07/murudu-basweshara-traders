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

export interface Company extends CompanyInput {
  id: string;
  created_at?: string;
  updated_at?: string;
}
