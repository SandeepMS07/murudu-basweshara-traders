"use server";

import {
  gunnyRecordSchema,
  gunnySellerPaymentSchema,
  gunnySellerSchema,
} from "@/features/gunny/schemas";
import {
  createGunnyRecord,
  createGunnySeller,
  createGunnySellerPayment,
  deleteGunnyRecord,
  deleteGunnySeller,
  deleteGunnySellerPayment,
  updateGunnyRecord,
  updateGunnySeller,
} from "@/features/gunny/service/gunny.service";

export async function createGunnyRecordAction(data: unknown) {
  const parsed = gunnyRecordSchema.parse(data);
  return createGunnyRecord(parsed);
}

export async function updateGunnyRecordAction(id: string, data: unknown) {
  const parsed = gunnyRecordSchema.parse(data);
  return updateGunnyRecord(id, parsed);
}

export async function deleteGunnyRecordAction(id: string) {
  return deleteGunnyRecord(id);
}

export async function createGunnySellerAction(data: unknown) {
  const parsed = gunnySellerSchema.parse(data);
  return createGunnySeller(parsed);
}

export async function updateGunnySellerAction(id: string, data: unknown) {
  const parsed = gunnySellerSchema.parse(data);
  return updateGunnySeller(id, parsed);
}

export async function deleteGunnySellerAction(id: string) {
  return deleteGunnySeller(id);
}

export async function createGunnySellerPaymentAction(data: unknown) {
  const parsed = gunnySellerPaymentSchema.parse(data);
  return createGunnySellerPayment(parsed);
}

export async function deleteGunnySellerPaymentAction(id: string) {
  return deleteGunnySellerPayment(id);
}
