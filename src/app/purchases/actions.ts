"use server";

import {
  createPurchase,
  getPurchaseById,
  deletePurchase,
  updatePurchase,
  updatePurchasePaymentThrough,
} from "@/features/purchases/service/purchase.service";
import { purchaseSchema, PurchaseInput, PaymentMethod } from "@/features/purchases/schemas";
import { upsertBillById } from "@/features/bills/service/bill.service";

export async function createPurchaseAction(data: PurchaseInput) {
  const parsed = purchaseSchema.parse(data);
  return createPurchase(parsed);
}

export async function updatePurchaseAction(id: string, data: PurchaseInput) {
  const parsed = purchaseSchema.parse(data);
  return updatePurchase(id, parsed);
}

export async function deletePurchaseAction(id: string) {
  return deletePurchase(id);
}

export async function generateBillFromPurchaseAction(purchaseId: string) {
  const purchase = await getPurchaseById(purchaseId);
  if (!purchase) {
    throw new Error("Purchase not found");
  }

  const billId = `PUR_BILL_${purchaseId}`;
  const bill = await upsertBillById(billId, {
    bill_date: purchase.date,
    net_weight: purchase.net_weight,
    rate: purchase.rate,
    freight: 0,
    payment_term_days: 0,
    source: "app",
  });

  return bill;
}

export async function updatePurchasePaymentThroughAction(
  purchaseId: string,
  paymentThrough: PaymentMethod
) {
  return updatePurchasePaymentThrough(purchaseId, paymentThrough);
}
