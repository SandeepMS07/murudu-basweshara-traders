"use server";

import {
  gunnyBagPartySchema,
  gunnyBagPaymentSchema,
  gunnyBagPurchaseSchema,
  gunnyBagSaleSchema,
} from "@/features/gunny-bags/schemas";
import {
  createGunnyBagParty,
  createGunnyBagPayment,
  createGunnyBagPurchase,
  createGunnyBagSale,
  deleteGunnyBagPayment,
  deleteGunnyBagPurchase,
  deleteGunnyBagSale,
  updateGunnyBagParty,
  updateGunnyBagPayment,
  updateGunnyBagPurchase,
  updateGunnyBagSale,
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

export async function createGunnyBagSaleAction(data: unknown) {
  const parsed = gunnyBagSaleSchema.parse(data);
  return createGunnyBagSale(parsed);
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

export async function updateGunnyBagSaleAction(id: string, data: unknown) {
  const parsed = gunnyBagSaleSchema.parse(data);
  return updateGunnyBagSale(id, parsed);
}

export async function deleteGunnyBagPurchaseAction(id: string) {
  return deleteGunnyBagPurchase(id);
}

export async function deleteGunnyBagPaymentAction(id: string) {
  return deleteGunnyBagPayment(id);
}

export async function deleteGunnyBagSaleAction(id: string) {
  return deleteGunnyBagSale(id);
}
