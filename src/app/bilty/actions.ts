"use server";

import {
  createBilty,
  createBiltyPartyPayment,
  getBiltyById,
  getBiltyParties,
  getBiltyPartyPayments,
  deleteBilty,
  deleteBiltyParty,
  deleteBiltyPartyPayment,
  updateBiltyParty,
  updateBilty,
  updateBiltyPaymentThrough,
  isBiltyBillNoAvailable,
  upsertBiltyPartyByName,
} from "@/features/bilty/service/bilty.service";
import {
  biltyPartyPaymentSchema,
  biltySchema,
  type BiltyInput,
  type BiltyPartyPaymentInput,
} from "@/features/bilty/schemas";
import { type PaymentMethod } from "@/features/bilty/schemas";
import { upsertBillById } from "@/features/bills/service/bill.service";
import { istTodayIso } from "@/lib/date";

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
    // Stamp the bill with the date it is generated (today, IST), not the
    // original bilty/record date.
    bill_date: istTodayIso(),
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

export async function createBiltyPartyAction(
  name: string,
  place?: string,
  mob?: string
) {
  const party = await upsertBiltyPartyByName(name, { place, mob });
  if (!party) {
    throw new Error("Party name is required");
  }
  return party;
}

export async function deleteBiltyPartyAction(id: string) {
  return deleteBiltyParty(id);
}

export async function updateBiltyPartyAction(
  id: string,
  name: string,
  place?: string,
  mob?: string
) {
  return updateBiltyParty(id, name, place, mob);
}

export async function getBiltyPartyPaymentsAction(partyId?: string) {
  return getBiltyPartyPayments(partyId);
}

export async function createBiltyPartyPaymentAction(data: BiltyPartyPaymentInput) {
  const parsed = biltyPartyPaymentSchema.parse(data);
  return createBiltyPartyPayment(parsed);
}

export async function deleteBiltyPartyPaymentAction(id: string) {
  return deleteBiltyPartyPayment(id);
}
