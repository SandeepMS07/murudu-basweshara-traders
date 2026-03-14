"use server";

import { companySchema, issuerCompanySchema } from "@/features/companies/schemas";
import {
  createCompany,
  deleteCompany,
  updateCompany,
} from "@/features/companies/service/company.service";

export async function createCompanyAction(data: unknown) {
  const parsed = companySchema.parse(data);
  if (parsed.type === "issuer") {
    issuerCompanySchema.parse(parsed);
  }
  return createCompany(parsed);
}

export async function updateCompanyAction(id: string, data: unknown) {
  const parsed = companySchema.parse(data);
  if (parsed.type === "issuer") {
    issuerCompanySchema.parse(parsed);
  }
  return updateCompany(id, parsed);
}

export async function deleteCompanyAction(id: string) {
  return deleteCompany(id);
}
