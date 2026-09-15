"use server";

import { revalidatePath } from "next/cache";

import {
  assignUnassignedCounterparties,
  counterpartyGstSchema,
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
