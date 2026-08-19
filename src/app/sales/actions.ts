"use server";

import { requireAuth } from "@/features/auth/lib/session";
import {
  generateSalesInvoiceSchema,
  saleSchema,
  SaleInput,
} from "@/features/sales/schemas";
import {
  createSale,
  deleteSale,
  getNextSaleIdentifiersForDate,
  importSalesFromBillWorkbook,
  updateSale,
} from "@/features/sales/service/sale.service";
import { generateSalesInvoice } from "@/features/sales/service/sales-invoice.service";

export async function createSaleAction(data: SaleInput) {
  const parsed = saleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid sale data",
    };
  }
  try {
    const sale = await createSale(parsed.data);
    return { success: true as const, sale };
  } catch (error) {
    // Surface the real reason instead of the redacted production digest.
    console.error("createSaleAction failed:", error);
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to create sale",
    };
  }
}

export async function getNextSaleBillNumberAction(
  saleDate: string,
  issuerCompanyId: string | null
) {
  await requireAuth();
  const { nextBillNumber } = await getNextSaleIdentifiersForDate(
    saleDate,
    issuerCompanyId
  );
  return nextBillNumber;
}

export async function updateSaleAction(id: string, data: SaleInput) {
  const parsed = saleSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid sale data",
    };
  }
  try {
    const sale = await updateSale(id, parsed.data);
    return { success: true as const, sale };
  } catch (error) {
    console.error("updateSaleAction failed:", error);
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to update sale",
    };
  }
}

export async function deleteSaleAction(id: string) {
  if (!id?.trim()) {
    return { success: false as const, message: "Sale id is required" };
  }

  try {
    await deleteSale(id.trim());
    return { success: true as const };
  } catch (error: unknown) {
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to delete sale",
    };
  }
}

export async function importSalesFromBillAction(formData: FormData) {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Only admin can import BILL sheet");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new Error("Please select an XLSX file");
  }

  const name = file.name.toLowerCase();
  if (!name.endsWith(".xlsx")) {
    throw new Error("Only .xlsx files are supported");
  }

  const arrayBuffer = await file.arrayBuffer();
  return importSalesFromBillWorkbook(Buffer.from(arrayBuffer));
}

export async function generateSalesInvoiceAction(data: {
  saleIds: string[];
  issuerCompanyId: string;
  issuedOn?: string;
}) {
  const parsed = generateSalesInvoiceSchema.parse(data);
  return generateSalesInvoice(parsed);
}
