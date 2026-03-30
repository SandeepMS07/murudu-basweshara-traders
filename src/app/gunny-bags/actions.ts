"use server";

import {
  gunnyBagPartySchema,
  gunnyBagPaymentSchema,
  gunnyBagPurchaseSchema,
} from "@/features/gunny-bags/schemas";
import {
  createGunnyBagParty,
  createGunnyBagPayment,
  createGunnyBagPurchase,
  deleteGunnyBagPayment,
  deleteGunnyBagPurchase,
  updateGunnyBagParty,
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

export async function createGunnyBagPartyAction(data: unknown) {
  const parsed = gunnyBagPartySchema.parse(data);
  return createGunnyBagParty(parsed);
}

export async function updateGunnyBagPurchaseAction(id: string, data: unknown) {
  const parsed = gunnyBagPurchaseSchema.parse(data);
  return updateGunnyBagPurchase(id, parsed);
}

export async function updateGunnyBagPaymentAction(id: string, data: unknown) {
  const parsed = gunnyBagPaymentSchema.parse(data);
  return updateGunnyBagPayment(id, parsed);
}

export async function updateGunnyBagPartyAction(id: string, data: unknown) {
  const parsed = gunnyBagPartySchema.parse(data);
  return updateGunnyBagParty(id, parsed);
}

export async function deleteGunnyBagPurchaseAction(id: string) {
  return deleteGunnyBagPurchase(id);
}

export async function deleteGunnyBagPaymentAction(id: string) {
  return deleteGunnyBagPayment(id);
}
