"use server";

import { requireRole } from "@/features/auth/lib/session";
import {
  soyaTradeSchema,
  type SoyaTradeInput,
} from "@/features/soya-trade/schemas";
import {
  createSoyaPurchase,
  deleteSoyaPurchase,
  getNextSoyaPurchaseIdentifiersForDate,
  updateSoyaPurchase,
} from "@/features/soya-purchases/service/soya-purchase.service";
import { companyPaymentSchema } from "@/features/companies/schemas";
import {
  createSoyaSupplierPayment,
  deleteSoyaSupplierPayment,
} from "@/features/soya-purchases/service/soya-purchase.service";
import {
  soyaCompanySchema,
  type SoyaCompanyDraft,
} from "@/features/soya-companies/schemas";
import {
  createSoyaCompany,
  deleteSoyaCompany,
  updateSoyaCompany,
} from "@/features/soya-companies/service/soya-company.service";

export async function createSoyaPurchaseAction(data: SoyaTradeInput) {
  const parsed = soyaTradeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid purchase data",
    };
  }
  try {
    const record = await createSoyaPurchase(parsed.data);
    return { success: true as const, sale: record };
  } catch (error) {
    console.error("createSoyaPurchaseAction failed:", error);
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Failed to create purchase",
    };
  }
}

export async function updateSoyaPurchaseAction(id: string, data: SoyaTradeInput) {
  const parsed = soyaTradeSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid purchase data",
    };
  }
  try {
    const record = await updateSoyaPurchase(id, parsed.data);
    return { success: true as const, sale: record };
  } catch (error) {
    console.error("updateSoyaPurchaseAction failed:", error);
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Failed to update purchase",
    };
  }
}

export async function deleteSoyaPurchaseAction(id: string) {
  if (!id?.trim()) {
    return { success: false as const, message: "Purchase id is required" };
  }
  try {
    await deleteSoyaPurchase(id.trim());
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Failed to delete purchase",
    };
  }
}

export async function getNextSoyaPurchaseBillNumberAction(
  saleDate: string,
  issuerCompanyId: string | null,
) {
  await requireRole(["admin"]);
  const { nextBillNumber } = await getNextSoyaPurchaseIdentifiersForDate(
    saleDate,
    issuerCompanyId,
  );
  return nextBillNumber;
}

export async function createSoyaSupplierAction(data: SoyaCompanyDraft) {
  const parsed = soyaCompanySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid supplier data",
    };
  }
  try {
    const company = await createSoyaCompany(parsed.data);
    return { success: true as const, company };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Failed to create supplier",
    };
  }
}

export async function updateSoyaSupplierAction(id: string, data: SoyaCompanyDraft) {
  const parsed = soyaCompanySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid supplier data",
    };
  }
  try {
    const company = await updateSoyaCompany(id, parsed.data);
    return { success: true as const, company };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Failed to update supplier",
    };
  }
}

export async function deleteSoyaSupplierAction(id: string) {
  try {
    const result = await deleteSoyaCompany(id);
    return { success: true as const, ...result };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Failed to delete supplier",
    };
  }
}

export async function createSoyaSupplierPaymentAction(
  data: Parameters<typeof createSoyaSupplierPayment>[0],
) {
  const parsed = companyPaymentSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid payment data");
  }
  return createSoyaSupplierPayment(parsed.data);
}

export async function deleteSoyaSupplierPaymentAction(id: string) {
  await deleteSoyaSupplierPayment(id);
}
