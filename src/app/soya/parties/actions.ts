"use server";

import { revalidatePath } from "next/cache";

import {
  soyaPartyEntrySchema,
  soyaPartyPaymentSchema,
  type SoyaPartyEntryInput,
} from "@/features/soya-parties/schemas";
import {
  createSoyaParty,
  createSoyaPartyEntry,
  createSoyaPartyPayment,
  deleteSoyaParty,
  deleteSoyaPartyEntry,
  deleteSoyaPartyPayment,
  getNextSoyaPartyIdentifiers,
  isSoyaPartyBillNoAvailable,
  updateSoyaParty,
  updateSoyaPartyEntry,
} from "@/features/soya-parties/service/soya-party.service";

const LIST_PATH = "/soya/parties";
const MASTER_PATH = "/soya/parties/companies";

// ------------------------------------------------------------------- entries

export async function createSoyaPartyEntryAction(data: SoyaPartyEntryInput) {
  const parsed = soyaPartyEntrySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid entry data",
    };
  }
  try {
    const entry = await createSoyaPartyEntry(parsed.data);
    revalidatePath(LIST_PATH);
    revalidatePath(MASTER_PATH);
    return { success: true as const, entry };
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
  data: SoyaPartyEntryInput,
) {
  const parsed = soyaPartyEntrySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid entry data",
    };
  }
  try {
    const entry = await updateSoyaPartyEntry(id, parsed.data);
    revalidatePath(LIST_PATH);
    revalidatePath(MASTER_PATH);
    return { success: true as const, entry };
  } catch (error) {
    console.error("updateSoyaPartyEntryAction failed:", error);
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to update entry",
    };
  }
}

/** Throws on failure — the row action surfaces the message as a toast. */
export async function deleteSoyaPartyEntryAction(id: string) {
  await deleteSoyaPartyEntry(id);
  revalidatePath(LIST_PATH);
  revalidatePath(MASTER_PATH);
}

export async function getNextSoyaPartyIdentifiersAction(date: string) {
  return getNextSoyaPartyIdentifiers(date);
}

export async function checkSoyaPartyBillNoAction(
  billNo: string,
  date: string,
  excludeId?: string,
) {
  return isSoyaPartyBillNoAvailable(billNo, date, excludeId);
}

// -------------------------------------------------------------- party master

export async function createSoyaPartyAction(name: string) {
  await createSoyaParty(name);
  revalidatePath(MASTER_PATH);
  revalidatePath(LIST_PATH);
}

export async function updateSoyaPartyAction(id: string, name: string) {
  await updateSoyaParty(id, name);
  revalidatePath(MASTER_PATH);
  revalidatePath(LIST_PATH);
}

export async function deleteSoyaPartyAction(id: string) {
  await deleteSoyaParty(id);
  revalidatePath(MASTER_PATH);
  revalidatePath(LIST_PATH);
}

// ------------------------------------------------------------ party payments

export async function createSoyaPartyPaymentAction(draft: {
  ownerId: string;
  paid_on: string;
  bank: string;
  amount: number;
  remarks: string;
}) {
  const parsed = soyaPartyPaymentSchema.parse({
    party_id: draft.ownerId,
    paid_on: draft.paid_on,
    bank: draft.bank,
    amount: draft.amount,
    remarks: draft.remarks,
  });
  await createSoyaPartyPayment(parsed);
  revalidatePath(MASTER_PATH);
}

export async function deleteSoyaPartyPaymentAction(id: string) {
  await deleteSoyaPartyPayment(id);
  revalidatePath(MASTER_PATH);
}
