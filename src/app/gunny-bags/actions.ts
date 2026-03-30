"use server";

import {
  gunnyBagPaymentSchema,
  gunnyBagPurchaseSchema,
} from "@/features/gunny-bags/schemas";
import {
  createGunnyBagPayment,
  createGunnyBagPurchase,
  deleteGunnyBagPayment,
  deleteGunnyBagPurchase,
  updateGunnyBagPayment,
  updateGunnyBagPurchase,
} from "@/features/gunny-bags/service/gunny-bag.service";

export async function createGunnyBagPurchaseAction(data: unknown) {
  const parsed = gunnyBagPurchaseSchema.parse(data);
  return createGunnyBagPurchase(parsed);
}

export async function createGunnyBagPaymentAction(data: unknown) {
  const parsed = gunnyBagPaymentSchema.parse(data);
  return createGunnyBagPayment(parsed);
}

export async function updateGunnyBagPurchaseAction(id: string, data: unknown) {
  const parsed = gunnyBagPurchaseSchema.parse(data);
  return updateGunnyBagPurchase(id, parsed);
}

export async function updateGunnyBagPaymentAction(id: string, data: unknown) {
  const parsed = gunnyBagPaymentSchema.parse(data);
  return updateGunnyBagPayment(id, parsed);
}

export async function deleteGunnyBagPurchaseAction(id: string) {
  return deleteGunnyBagPurchase(id);
}

export async function deleteGunnyBagPaymentAction(id: string) {
  return deleteGunnyBagPayment(id);
}
