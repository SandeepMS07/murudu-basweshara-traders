"use server";

import {
  createPurchase,
  getPurchaseById,
  deletePurchase,
  updatePurchase,
  updatePurchasePaymentThrough,
  isPurchaseBillNoAvailable,
} from "@/features/purchases/service/purchase.service";
import { purchaseSchema, PurchaseInput, PaymentMethod } from "@/features/purchases/schemas";
import { upsertBillById } from "@/features/bills/service/bill.service";
import { istTodayIso } from "@/lib/date";

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
    // Stamp the bill with the date it is generated (today, IST), not the
    // original purchase/record date.
    bill_date: istTodayIso(),
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
  paymentThrough: PaymentMethod,
  paymentDate?: string | null
) {
  return updatePurchasePaymentThrough(purchaseId, paymentThrough, paymentDate);
}

export async function checkPurchaseBillNoAvailabilityAction(
  billNo: number,
  billDate: string,
  excludePurchaseId?: string
) {
  return isPurchaseBillNoAvailable(billNo, billDate, excludePurchaseId);
}
