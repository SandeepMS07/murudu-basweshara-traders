"use server";

import { revalidatePath } from "next/cache";

import {
  soyaFactoryEntrySchema,
  soyaFactoryPaymentSchema,
  type SoyaFactoryEntryInput,
} from "@/features/soya-factory/schemas";
import {
  createSoyaFactory,
  createSoyaFactoryEntry,
  createSoyaFactoryPayment,
  deleteSoyaFactory,
  deleteSoyaFactoryEntry,
  deleteSoyaFactoryPayment,
  getNextSoyaFactorySlNo,
  updateSoyaFactory,
  updateSoyaFactoryEntry,
} from "@/features/soya-factory/service/soya-factory.service";

const LIST_PATH = "/soya/factory";
const MASTER_PATH = "/soya/factory/parties";

// There is deliberately no generateBill action here: the maize bilty bill flow
// writes public.bills, whose sequence is shared with maize Purchases, so a Soya
// bill would consume a maize bill number. See supabase/soya-factory.sql.

// ------------------------------------------------------------------- entries

export async function createSoyaFactoryEntryAction(
  data: SoyaFactoryEntryInput,
) {
  const parsed = soyaFactoryEntrySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid entry data",
    };
  }
  try {
    const entry = await createSoyaFactoryEntry(parsed.data);
    revalidatePath(LIST_PATH);
    revalidatePath(MASTER_PATH);
    return { success: true as const, entry };
  } catch (error) {
    console.error("createSoyaFactoryEntryAction failed:", error);
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to create entry",
    };
  }
}

export async function updateSoyaFactoryEntryAction(
  id: string,
  data: SoyaFactoryEntryInput,
) {
  const parsed = soyaFactoryEntrySchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false as const,
      message: parsed.error.issues[0]?.message ?? "Invalid entry data",
    };
  }
  try {
    const entry = await updateSoyaFactoryEntry(id, parsed.data);
    revalidatePath(LIST_PATH);
    revalidatePath(MASTER_PATH);
    return { success: true as const, entry };
  } catch (error) {
    console.error("updateSoyaFactoryEntryAction failed:", error);
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to update entry",
    };
  }
}

/** Throws on failure — the row action surfaces the message as a toast. */
export async function deleteSoyaFactoryEntryAction(id: string) {
  await deleteSoyaFactoryEntry(id);
  revalidatePath(LIST_PATH);
  revalidatePath(MASTER_PATH);
}

export async function getNextSoyaFactorySlNoAction(date: string) {
  return getNextSoyaFactorySlNo(date);
}

// ------------------------------------------------------------ factory master

export async function createSoyaFactoryAction(name: string) {
  await createSoyaFactory(name);
  revalidatePath(MASTER_PATH);
  revalidatePath(LIST_PATH);
}

export async function updateSoyaFactoryAction(id: string, name: string) {
  await updateSoyaFactory(id, name);
  revalidatePath(MASTER_PATH);
  revalidatePath(LIST_PATH);
}

export async function deleteSoyaFactoryAction(id: string) {
  await deleteSoyaFactory(id);
  revalidatePath(MASTER_PATH);
  revalidatePath(LIST_PATH);
}

// ---------------------------------------------------------- factory payments

export async function createSoyaFactoryPaymentAction(draft: {
  ownerId: string;
  paid_on: string;
  bank: string;
  amount: number;
}) {
  const parsed = soyaFactoryPaymentSchema.parse({
    factory_id: draft.ownerId,
    paid_on: draft.paid_on,
    bank: draft.bank,
    amount: draft.amount,
  });
  await createSoyaFactoryPayment(parsed);
  revalidatePath(MASTER_PATH);
}

export async function deleteSoyaFactoryPaymentAction(id: string) {
  await deleteSoyaFactoryPayment(id);
  revalidatePath(MASTER_PATH);
}
