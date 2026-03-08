"use server";

import { createBill, updateBill } from "@/features/bills/service/bill.service";
import { billSchema, BillInput } from "@/features/bills/schemas";

export async function createBillAction(data: BillInput) {
  const parsed = billSchema.parse(data);
  return createBill(parsed);
}

export async function updateBillAction(id: string, data: BillInput) {
  const parsed = billSchema.parse(data);
  return updateBill(id, parsed);
}
