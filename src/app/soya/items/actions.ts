"use server";

import { revalidatePath } from "next/cache";

import {
  createSoyaItem,
  deleteSoyaItem,
  updateSoyaItem,
} from "@/features/soya-invoices/service/soya-item.service";
import { soyaItemSchema } from "@/features/soya-invoices/schemas";

export async function createSoyaItemAction(data: unknown) {
  const parsed = soyaItemSchema.parse(data);
  const created = await createSoyaItem(parsed);
  revalidatePath("/soya/items");
  revalidatePath("/soya/invoices");
  return created;
}

export async function updateSoyaItemAction(id: string, data: unknown) {
  const parsed = soyaItemSchema.parse(data);
  const updated = await updateSoyaItem(id, parsed);
  revalidatePath("/soya/items");
  revalidatePath("/soya/invoices");
  return updated;
}

export async function deleteSoyaItemAction(id: string) {
  await deleteSoyaItem(id);
  revalidatePath("/soya/items");
}
