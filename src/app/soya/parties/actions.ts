"use server";

import { requireRole } from "@/features/auth/lib/session";
import {
  soyaTradeSchema,
  type SoyaTradeInput,
} from "@/features/soya-trade/schemas";
import {
  createSoyaPartyEntry,
  createSoyaPartyPayment,
  deleteSoyaPartyEntry,
  deleteSoyaPartyPayment,
  getNextSoyaPartyIdentifiersForDate,
  updateSoyaPartyEntry,
} from "@/features/soya-parties/service/soya-party.service";
import {
  companyPaymentSchema,
  issuerCompanySchema,
} from "@/features/companies/schemas";
import {
  soyaCompanySchema,
  type SoyaCompanyDraft,
} from "@/features/soya-companies/schemas";
import {
  createSoyaCompany,
  deleteSoyaCompany,
  updateSoyaCompany,
} from "@/features/soya-companies/service/soya-company.service";

export async function createSoyaPartyEntryAction(data: SoyaTradeInput) {
  const parsed = soyaTradeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid entry data",
    };
  }
  try {
    const record = await createSoyaPartyEntry(parsed.data);
    return { success: true as const, sale: record };
  } catch (error) {
    console.error("createSoyaPartyEntryAction failed:", error);
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to create entry",
    };
  }
}

export async function updateSoyaPartyEntryAction(
  id: string,
  data: SoyaTradeInput,
) {
  const parsed = soyaTradeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid entry data",
    };
  }
  try {
    const record = await updateSoyaPartyEntry(id, parsed.data);
    return { success: true as const, sale: record };
  } catch (error) {
    console.error("updateSoyaPartyEntryAction failed:", error);
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to update entry",
    };
  }
}

export async function deleteSoyaPartyEntryAction(id: string) {
  if (!id?.trim()) {
    return { success: false as const, message: "Entry id is required" };
  }
  try {
    await deleteSoyaPartyEntry(id.trim());
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to delete entry",
    };
  }
}

export async function getNextSoyaPartyBillNumberAction(
  saleDate: string,
  issuerCompanyId: string | null,
) {
  await requireRole(["admin"]);
  const { nextBillNumber } = await getNextSoyaPartyIdentifiersForDate(
    saleDate,
    issuerCompanyId,
  );
  return nextBillNumber;
}

export async function createSoyaPartyAction(data: SoyaCompanyDraft) {
  const parsed = soyaCompanySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid party data",
    };
  }
  try {
    const company = await createSoyaCompany(parsed.data);
    return { success: true as const, company };
  } catch (error) {
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to create party",
    };
  }
}

/*
 * The three actions below mirror the maize /companies action contract exactly —
 * they throw on invalid input and return the entity rather than a result object.
 * That is what the party ledger screen (copied from CompaniesManager) expects,
 * so its logic works unchanged. createSoyaPartyAction above keeps the
 * result-object shape instead, because the entry form renders the message
 * inline rather than throwing.
 */
export async function createSoyaPartyCompanyAction(data: unknown) {
  const parsed = soyaCompanySchema.parse(data);
  if (parsed.type === "issuer") {
    issuerCompanySchema.parse(parsed);
  }
  return createSoyaCompany(parsed);
}

export async function updateSoyaPartyCompanyAction(id: string, data: unknown) {
  const parsed = soyaCompanySchema.parse(data);
  if (parsed.type === "issuer") {
    issuerCompanySchema.parse(parsed);
  }
  return updateSoyaCompany(id, parsed);
}

export async function deleteSoyaPartyCompanyAction(id: string) {
  return deleteSoyaCompany(id);
}

// `unknown` in, parsed here: the schema supplies defaults for payment_mode and
// rtgs_name, which callers omit. Same contract as the maize payment action.
export async function createSoyaPartyPaymentAction(data: unknown) {
  const parsed = companyPaymentSchema.parse(data);
  return createSoyaPartyPayment(parsed);
}

export async function deleteSoyaPartyPaymentAction(id: string) {
  await deleteSoyaPartyPayment(id);
}
