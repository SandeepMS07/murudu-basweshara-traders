"use server";

import { requireAuth } from "@/features/auth/lib/session";
import { saleSchema, SaleInput } from "@/features/sales/schemas";
import {
  createSale,
  importSalesFromBillWorkbook,
  updateSale,
} from "@/features/sales/service/sale.service";

export async function createSaleAction(data: SaleInput) {
  const parsed = saleSchema.parse(data);
  return createSale(parsed);
}

export async function updateSaleAction(id: string, data: SaleInput) {
  const parsed = saleSchema.parse(data);
  return updateSale(id, parsed);
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
