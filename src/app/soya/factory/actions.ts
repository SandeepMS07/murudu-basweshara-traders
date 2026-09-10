"use server";

import {
  createSoyaFactoryPartyPayment,
  createSoyaFactoryRecord,
  deleteSoyaFactoryParty,
  deleteSoyaFactoryPartyPayment,
  deleteSoyaFactoryRecord,
  getSoyaFactoryParties,
  getSoyaFactoryPartyPayments,
  isSoyaFactoryBillNoAvailable,
  updateSoyaFactoryParty,
  updateSoyaFactoryPaymentThrough,
  updateSoyaFactoryRecord,
  upsertSoyaFactoryPartyByName,
} from "@/features/soya-factory/service/soya-factory.service";
import {
  biltyPartyPaymentSchema,
  biltySchema,
  type BiltyInput,
  type BiltyPartyPaymentInput,
  type PaymentMethod,
} from "@/features/bilty/schemas";

// There is deliberately no generateBill action here: the maize bilty bill flow
// writes public.bills, whose sequence is shared with maize Purchases, so a Soya
// bill would consume a maize bill number. See supabase/soya-factory.sql.

export async function createSoyaFactoryRecordAction(data: BiltyInput) {
  const parsed = biltySchema.parse(data);
  return createSoyaFactoryRecord(parsed);
}

export async function updateSoyaFactoryRecordAction(
  id: string,
  data: BiltyInput,
) {
  const parsed = biltySchema.parse(data);
  return updateSoyaFactoryRecord(id, parsed);
}

export async function deleteSoyaFactoryRecordAction(id: string) {
  return deleteSoyaFactoryRecord(id);
}

export async function updateSoyaFactoryPaymentThroughAction(
  id: string,
  paymentThrough: PaymentMethod,
  paymentDate?: string | null,
) {
  return updateSoyaFactoryPaymentThrough(id, paymentThrough, paymentDate);
}

export async function checkSoyaFactoryBillNoAvailabilityAction(
  billNo: number,
  billDate: string,
  excludeId?: string,
) {
  return isSoyaFactoryBillNoAvailable(billNo, billDate, excludeId);
}

export async function getSoyaFactoryPartiesAction() {
  return getSoyaFactoryParties();
}

export async function createSoyaFactoryPartyAction(
  name: string,
  place?: string,
  mob?: string,
) {
  const party = await upsertSoyaFactoryPartyByName(name, { place, mob });
  if (!party) {
    throw new Error("Party name is required");
  }
  return party;
}

export async function deleteSoyaFactoryPartyAction(id: string) {
  return deleteSoyaFactoryParty(id);
}

export async function updateSoyaFactoryPartyAction(
  id: string,
  name: string,
  place?: string,
  mob?: string,
) {
  return updateSoyaFactoryParty(id, name, place, mob);
}

export async function getSoyaFactoryPartyPaymentsAction(partyId?: string) {
  return getSoyaFactoryPartyPayments(partyId);
}

export async function createSoyaFactoryPartyPaymentAction(
  data: BiltyPartyPaymentInput,
) {
  const parsed = biltyPartyPaymentSchema.parse(data);
  return createSoyaFactoryPartyPayment(parsed);
}

export async function deleteSoyaFactoryPartyPaymentAction(id: string) {
  return deleteSoyaFactoryPartyPayment(id);
}
