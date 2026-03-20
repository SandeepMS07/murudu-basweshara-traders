"use server";

import { companyPaymentSchema, companySchema, issuerCompanySchema } from "@/features/companies/schemas";
import {
  createCompanyPayment,
  createCompany,
  deleteCompanyPayment,
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

export async function createCompanyPaymentAction(data: unknown) {
  const parsed = companyPaymentSchema.parse(data);
  return createCompanyPayment(parsed);
}

export async function deleteCompanyPaymentAction(id: string) {
  return deleteCompanyPayment(id);
}
