import { z } from "zod";

import { companySchema, type Company } from "@/features/companies/schemas";

/**
 * Soya keeps its own party directory in soya_companies, but the shape is the
 * maize one: issuers (our billing entities) and buyers (the counterparty).
 * The types are aliased rather than re-declared so the reused maize screens
 * (CompanyStatementView) accept Soya rows with no adapter, and so any future
 * change to the maize Company shape fails the build here instead of silently
 * diverging in production.
 */
export const soyaCompanyTypeEnum = z.enum(["issuer", "buyer"]);

export type SoyaCompanyType = z.infer<typeof soyaCompanyTypeEnum>;

export const soyaCompanySchema = companySchema.extend({
  type: soyaCompanyTypeEnum,
});

export type SoyaCompanyInput = z.infer<typeof soyaCompanySchema>;

/** Pre-validation shape: the schema fills the optional fields with defaults. */
export type SoyaCompanyDraft = z.input<typeof soyaCompanySchema>;

export type SoyaCompany = Company;
