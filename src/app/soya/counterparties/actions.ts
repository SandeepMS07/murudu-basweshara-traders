"use server";

import { revalidatePath } from "next/cache";

import {
  assignUnassignedCounterparties,
  counterpartyGstSchema,
  softDeleteSoyaCounterparty,
  updateSoyaCounterpartyGst,
  type CounterpartyKind,
} from "@/features/soya/service/counterparty-gst.service";

export async function updateCounterpartyGstAction(
  kind: CounterpartyKind,
  id: string,
  data: unknown,
) {
  const parsed = counterpartyGstSchema.parse(data);
  const updated = await updateSoyaCounterpartyGst(kind, id, parsed);
  revalidatePath("/soya/factory/parties");
  revalidatePath("/soya/parties/companies");
  revalidatePath("/soya/invoices");
  return updated;
}

export async function assignUnassignedCounterpartiesAction(
  kind: CounterpartyKind,
  companyId: string,
) {
  const moved = await assignUnassignedCounterparties(kind, companyId);
  revalidatePath("/soya/factory/parties");
  revalidatePath("/soya/parties/companies");
  return moved;
}

/**
 * Returns the outcome rather than throwing: in a production build Next.js
 * replaces a thrown server-action message with a generic one, and the reason a
 * delete was refused ("it still has 5 bills") is the whole point.
 */
export async function softDeleteCounterpartyAction(kind: CounterpartyKind, id: string) {
  try {
    await softDeleteSoyaCounterparty(kind, id);
  } catch (error) {
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Could not delete",
    };
  }
  revalidatePath("/soya/factory/parties");
  revalidatePath("/soya/parties/companies");
  revalidatePath("/soya/factory");
  revalidatePath("/soya/parties");
  revalidatePath("/soya/invoices");
  revalidatePath("/soya/dashboard");
  return { success: true as const };
}
