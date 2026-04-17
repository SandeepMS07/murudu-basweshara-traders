"use server";

import {
  createBilty,
  getBiltyById,
  getBiltyParties,
  deleteBilty,
  deleteBiltyParty,
  updateBilty,
  updateBiltyPaymentThrough,
  isBiltyBillNoAvailable,
  upsertBiltyPartyByName,
} from "@/features/bilty/service/bilty.service";
import { biltySchema, type BiltyInput } from "@/features/bilty/schemas";
import { type PaymentMethod } from "@/features/bilty/schemas";
import { upsertBillById } from "@/features/bills/service/bill.service";

export async function createBiltyAction(data: BiltyInput) {
  const parsed = biltySchema.parse(data);
  return createBilty(parsed);
}

export async function updateBiltyAction(id: string, data: BiltyInput) {
  const parsed = biltySchema.parse(data);
  return updateBilty(id, parsed);
}

export async function deleteBiltyAction(id: string) {
  return deleteBilty(id);
}

export async function generateBillFromBiltyAction(biltyId: string) {
  const bilty = await getBiltyById(biltyId);
  if (!bilty) {
    throw new Error("Bilty not found");
  }

  const billId = `BILTY_BILL_${biltyId}`;
  return upsertBillById(billId, {
    bill_date: bilty.date,
    net_weight: bilty.net_weight,
    rate: bilty.rate,
    freight: 0,
    payment_term_days: 0,
    source: "app",
  });
}

export async function updateBiltyPaymentThroughAction(
  biltyId: string,
  paymentThrough: PaymentMethod,
  paymentDate?: string | null
) {
  return updateBiltyPaymentThrough(biltyId, paymentThrough, paymentDate);
}

export async function checkBiltyBillNoAvailabilityAction(
  billNo: number,
  billDate: string,
  excludeBiltyId?: string
) {
  return isBiltyBillNoAvailable(billNo, billDate, excludeBiltyId);
}

export async function getBiltyPartiesAction() {
  return getBiltyParties();
}

export async function createBiltyPartyAction(name: string) {
  const party = await upsertBiltyPartyByName(name);
  if (!party) {
    throw new Error("Party name is required");
  }
  return party;
}

export async function deleteBiltyPartyAction(id: string) {
  return deleteBiltyParty(id);
}
