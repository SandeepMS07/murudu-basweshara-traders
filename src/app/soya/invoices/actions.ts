"use server";

import { revalidatePath } from "next/cache";

import {
  cancelSoyaInvoiceIrn,
  createSoyaInvoice,
  deleteSoyaInvoice,
  fileSoyaInvoice,
  sellerForCompany,
  suggestInvoiceNumber,
  updateSoyaInvoice,
} from "@/features/soya-invoices/service/soya-invoice.service";
import { soyaInvoiceSchema } from "@/features/soya-invoices/schemas";
import { requireRole } from "@/features/auth/lib/session";

export async function createSoyaInvoiceAction(data: unknown) {
  const parsed = soyaInvoiceSchema.parse(data);
  const created = await createSoyaInvoice(parsed);
  revalidatePath("/soya/invoices");
  return { id: created.id, invoice_no: created.invoice_no };
}

export async function updateSoyaInvoiceAction(id: string, data: unknown) {
  const parsed = soyaInvoiceSchema.parse(data);
  const updated = await updateSoyaInvoice(id, parsed);
  revalidatePath("/soya/invoices");
  revalidatePath(`/soya/invoices/${id}`);
  return { id: updated.id, invoice_no: updated.invoice_no };
}

export async function deleteSoyaInvoiceAction(id: string) {
  await deleteSoyaInvoice(id);
  revalidatePath("/soya/invoices");
}

export async function suggestInvoiceNumberAction(companyId: string, isoDate: string) {
  await requireRole(["admin"]);
  return suggestInvoiceNumber(companyId, isoDate);
}

/**
 * Files with the portal. Returns a plain object rather than the invoice, so the
 * client can show the payload it would have sent when credentials are missing.
 */
export async function fileSoyaInvoiceAction(id: string) {
  const result = await fileSoyaInvoice(id);
  revalidatePath("/soya/invoices");
  revalidatePath(`/soya/invoices/${id}`);
  return {
    ok: result.ok,
    preview: result.preview,
    message: result.message,
    payload: result.payload,
    irn: result.invoice.irn,
    ackNo: result.invoice.ack_no,
    ewbNo: result.invoice.ewb_no,
  };
}

export async function cancelSoyaInvoiceIrnAction(
  id: string,
  reasonCode: string,
  remark: string,
) {
  const result = await cancelSoyaInvoiceIrn(id, reasonCode, remark);
  revalidatePath("/soya/invoices");
  revalidatePath(`/soya/invoices/${id}`);
  return result;
}

/** The seller block, for the readiness panel on the client. */
export async function sellerForCompanyAction(companyId: string) {
  await requireRole(["admin"]);
  return sellerForCompany(companyId);
}
