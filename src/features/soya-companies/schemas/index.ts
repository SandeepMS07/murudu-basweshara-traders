import { z } from "zod";

import { companySchema, type Company } from "@/features/companies/schemas";

/**
 * Soya keeps its own party directory. It adds "supplier" on top of the maize
 * issuer/buyer split, because the Soya Purchases module buys from suppliers
 * while Soya Sales bills buyers, and a firm can be both without the two
 * ledgers mixing.
 */
export const soyaCompanyTypeEnum = z.enum(["issuer", "buyer", "supplier"]);

export type SoyaCompanyType = z.infer<typeof soyaCompanyTypeEnum>;

export const soyaCompanySchema = companySchema.extend({
  type: soyaCompanyTypeEnum,
});

export type SoyaCompanyInput = z.infer<typeof soyaCompanySchema>;

/** Pre-validation shape: the schema fills the optional fields with defaults. */
export type SoyaCompanyDraft = z.input<typeof soyaCompanySchema>;

export interface SoyaCompany extends Omit<Company, "type"> {
  type: SoyaCompanyType;
}

/**
 * The reused CompanyStatementView only needs the party directory to look up
 * display names, and its prop type is the maize Company (issuer/buyer only).
 * Narrow explicitly rather than casting: for a statement's purposes a supplier
 * is simply the counterparty.
 */
export function toStatementCompanies(companies: SoyaCompany[]): Company[] {
  return companies.map(({ type, ...rest }) => ({
    ...rest,
    type: type === "issuer" ? "issuer" : "buyer",
  }));
}
