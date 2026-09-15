import { randomUUID } from "crypto";

import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { getSoyaCompanyById } from "@/features/soya-companies/service/soya-company.service";
import {
  computeInvoice,
  invoiceFyStartYear,
  nextInvoiceNumber,
} from "@/features/soya-invoices/lib/invoice-math";
import {
  buildEInvoicePayload,
  checkEInvoiceReady,
  type EInvoiceSeller,
} from "@/features/soya-invoices/lib/einvoice-payload";
import { cancelIrn, generateIrn } from "@/features/soya-invoices/service/irp-client";
import {
  isInvoiceLocked,
  soyaInvoiceSchema,
  type EInvoiceStatus,
  type SoyaInvoice,
  type SoyaInvoiceInput,
  type SoyaInvoiceItem,
} from "@/features/soya-invoices/schemas";

/**
 * Soya tax invoices.
 *
 * Admin-only, like the rest of the Soya line. Nothing here reads or writes a
 * maize table — in particular the maize invoice counter
 * (next_company_invoice_seq) is not touched, so a Soya invoice can never
 * consume a maize number.
 */
const INVOICES = "soya_invoices";
const LINES = "soya_invoice_items";

function n(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function s(value: string | null | undefined): string {
  return value ?? "";
}

type Row = Record<string, unknown>;

function toLine(row: Row): SoyaInvoiceItem {
  return {
    id: String(row.id),
    invoice_id: String(row.invoice_id),
    line_no: Math.trunc(n(row.line_no as number)) || 1,
    item_id: s(row.item_id as string),
    item_name: s(row.item_name as string),
    description: s(row.description as string),
    hsn: s(row.hsn as string),
    unit: s(row.unit as string) || "MTS",
    quantity: n(row.quantity as number),
    rate: n(row.rate as number),
    discount: n(row.discount as number),
    gst_rate: n(row.gst_rate as number),
    amount: n(row.amount as number),
    taxable_value: n(row.taxable_value as number),
    cgst: n(row.cgst as number),
    sgst: n(row.sgst as number),
    igst: n(row.igst as number),
    cess: n(row.cess as number),
    total_value: n(row.total_value as number),
  };
}

function toInvoice(row: Row, lines: SoyaInvoiceItem[]): SoyaInvoice {
  return {
    id: String(row.id),
    company_id: s(row.company_id as string),
    invoice_no: s(row.invoice_no as string),
    invoice_date: String(row.invoice_date ?? "").slice(0, 10),
    fy_start_year: Math.trunc(n(row.fy_start_year as number)),
    doc_type: (s(row.doc_type as string) || "INV") as SoyaInvoice["doc_type"],
    supply_type: s(row.supply_type as string) || "B2B",
    reverse_charge: Boolean(row.reverse_charge),

    party_id: s(row.party_id as string),
    party_name: s(row.party_name as string),
    party_legal_name: s(row.party_legal_name as string),
    party_gstin: s(row.party_gstin as string),
    party_state_code: s(row.party_state_code as string),
    party_registration_type: s(row.party_registration_type as string) || "regular",
    bill_to_address: s(row.bill_to_address as string),
    bill_to_place: s(row.bill_to_place as string),
    bill_to_pincode: s(row.bill_to_pincode as string),
    party_phone: s(row.party_phone as string),
    party_email: s(row.party_email as string),

    ship_to_name: s(row.ship_to_name as string),
    ship_to_gstin: s(row.ship_to_gstin as string),
    ship_to_address: s(row.ship_to_address as string),
    ship_to_place: s(row.ship_to_place as string),
    ship_to_pincode: s(row.ship_to_pincode as string),
    ship_to_state_code: s(row.ship_to_state_code as string),

    dispatch_from_name: s(row.dispatch_from_name as string),
    dispatch_from_address: s(row.dispatch_from_address as string),
    dispatch_from_place: s(row.dispatch_from_place as string),
    dispatch_from_pincode: s(row.dispatch_from_pincode as string),
    dispatch_from_state_code: s(row.dispatch_from_state_code as string),

    place_of_supply_code: s(row.place_of_supply_code as string),

    taxable_value: n(row.taxable_value as number),
    cgst: n(row.cgst as number),
    sgst: n(row.sgst as number),
    igst: n(row.igst as number),
    cess: n(row.cess as number),
    other_charges: n(row.other_charges as number),
    round_off: n(row.round_off as number),
    total_value: n(row.total_value as number),

    transporter_name: s(row.transporter_name as string),
    transporter_id: s(row.transporter_id as string),
    transport_mode: s(row.transport_mode as string),
    vehicle_no: s(row.vehicle_no as string),
    vehicle_type: s(row.vehicle_type as string),
    distance_km: Math.trunc(n(row.distance_km as number)),
    transport_doc_no: s(row.transport_doc_no as string),
    transport_doc_date: String(row.transport_doc_date ?? "").slice(0, 10),

    einvoice_status: (s(row.einvoice_status as string) || "pending") as EInvoiceStatus,
    irn: s(row.irn as string),
    ack_no: s(row.ack_no as string),
    ack_date: s(row.ack_date as string),
    signed_qr: s(row.signed_qr as string),
    einvoice_error: s(row.einvoice_error as string),
    irn_cancelled_at: s(row.irn_cancelled_at as string),
    irn_cancel_reason: s(row.irn_cancel_reason as string),

    ewb_status: (s(row.ewb_status as string) || "pending") as EInvoiceStatus,
    ewb_no: s(row.ewb_no as string),
    ewb_date: s(row.ewb_date as string),
    ewb_valid_until: s(row.ewb_valid_until as string),
    ewb_error: s(row.ewb_error as string),
    ewb_cancelled_at: s(row.ewb_cancelled_at as string),

    notes: s(row.notes as string),
    items: lines.sort((a, b) => a.line_no - b.line_no),
    created_at: (row.created_at as string) ?? undefined,
    updated_at: (row.updated_at as string) ?? undefined,
  };
}

/** The seller block, read from the company master. */
export async function sellerForCompany(companyId: string): Promise<EInvoiceSeller> {
  const company = await getSoyaCompanyById(companyId);
  if (!company) throw new Error("Company not found");
  return {
    gstin: company.gstin,
    legal_name: company.legal_name,
    name: company.name,
    address: company.address,
    place: company.place,
    pincode: company.pincode,
    state_code: company.state_code,
    phone: company.phone,
    email: company.email,
    aato_over_10cr: company.aato_over_10cr,
  };
}

export async function getSoyaInvoices(companyId?: string): Promise<SoyaInvoice[]> {
  let query = supabaseServer
    .from(INVOICES)
    .select("*")
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (companyId) query = query.eq("company_id", companyId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];

  // One query for every line rather than one per invoice.
  const { data: lineRows, error: lineError } = await supabaseServer
    .from(LINES)
    .select("*")
    .in("invoice_id", rows.map((row) => String(row.id)));
  if (lineError) throw new Error(lineError.message);

  const byInvoice = new Map<string, SoyaInvoiceItem[]>();
  for (const row of (lineRows ?? []) as Row[]) {
    const line = toLine(row);
    const existing = byInvoice.get(line.invoice_id);
    if (existing) existing.push(line);
    else byInvoice.set(line.invoice_id, [line]);
  }

  return rows.map((row) => toInvoice(row, byInvoice.get(String(row.id)) ?? []));
}

export async function getSoyaInvoiceById(id: string): Promise<SoyaInvoice | null> {
  const { data, error } = await supabaseServer
    .from(INVOICES)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: lineRows, error: lineError } = await supabaseServer
    .from(LINES)
    .select("*")
    .eq("invoice_id", id);
  if (lineError) throw new Error(lineError.message);

  return toInvoice(data as Row, ((lineRows ?? []) as Row[]).map(toLine));
}

/** The next number in a company's series for the financial year of `isoDate`. */
export async function suggestInvoiceNumber(
  companyId: string,
  isoDate: string,
): Promise<string> {
  const company = await getSoyaCompanyById(companyId);
  if (!company) throw new Error("Company not found");
  const fyStartYear = invoiceFyStartYear(isoDate);

  const { data, error } = await supabaseServer
    .from(INVOICES)
    .select("invoice_no")
    .eq("company_id", companyId)
    .eq("fy_start_year", fyStartYear);
  if (error) throw new Error(error.message);

  return nextInvoiceNumber(
    company.invoice_prefix,
    fyStartYear,
    ((data ?? []) as { invoice_no: string }[]).map((row) => row.invoice_no),
  );
}

/**
 * Computes the money from the lines and writes invoice + lines.
 *
 * Totals are never taken from the caller. The form shows them, but what is
 * stored is recomputed here from quantity, rate and the company's state, so a
 * tampered or stale client cannot file a figure the arithmetic does not
 * support.
 */
async function persist(
  id: string,
  parsed: SoyaInvoiceInput,
  existing: SoyaInvoice | null,
): Promise<SoyaInvoice> {
  const company = await getSoyaCompanyById(parsed.company_id);
  if (!company) throw new Error("Company not found");

  const totals = computeInvoice(
    parsed.items.map((item) => ({
      quantity: item.quantity,
      rate: item.rate,
      discount: item.discount,
      gst_rate: item.gst_rate,
    })),
    company.state_code,
    parsed.place_of_supply_code,
    parsed.other_charges,
  );

  const fyStartYear = invoiceFyStartYear(parsed.invoice_date);
  const invoiceNo =
    parsed.invoice_no ||
    existing?.invoice_no ||
    (await suggestInvoiceNumber(parsed.company_id, parsed.invoice_date));

  const now = new Date().toISOString();
  const payload = {
    company_id: parsed.company_id,
    invoice_no: invoiceNo,
    invoice_date: parsed.invoice_date,
    fy_start_year: fyStartYear,
    doc_type: parsed.doc_type,
    supply_type: parsed.supply_type,
    reverse_charge: parsed.reverse_charge,

    party_id: parsed.party_id || null,
    party_name: parsed.party_name,
    party_legal_name: parsed.party_legal_name,
    party_gstin: parsed.party_gstin,
    party_state_code: parsed.party_state_code,
    party_registration_type: parsed.party_registration_type,
    bill_to_address: parsed.bill_to_address,
    bill_to_place: parsed.bill_to_place,
    bill_to_pincode: parsed.bill_to_pincode,
    party_phone: parsed.party_phone,
    party_email: parsed.party_email,

    ship_to_name: parsed.ship_to_name,
    ship_to_gstin: parsed.ship_to_gstin,
    ship_to_address: parsed.ship_to_address,
    ship_to_place: parsed.ship_to_place,
    ship_to_pincode: parsed.ship_to_pincode,
    ship_to_state_code: parsed.ship_to_state_code,

    dispatch_from_name: parsed.dispatch_from_name,
    dispatch_from_address: parsed.dispatch_from_address,
    dispatch_from_place: parsed.dispatch_from_place,
    dispatch_from_pincode: parsed.dispatch_from_pincode,
    dispatch_from_state_code: parsed.dispatch_from_state_code,

    place_of_supply_code: parsed.place_of_supply_code,

    taxable_value: totals.taxable_value,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    cess: totals.cess,
    other_charges: totals.other_charges,
    round_off: totals.round_off,
    total_value: totals.total_value,

    transporter_name: parsed.transporter_name,
    transporter_id: parsed.transporter_id,
    transport_mode: parsed.transport_mode,
    vehicle_no: parsed.vehicle_no,
    vehicle_type: parsed.vehicle_type,
    distance_km: parsed.distance_km,
    transport_doc_no: parsed.transport_doc_no,
    transport_doc_date: parsed.transport_doc_date || null,

    notes: parsed.notes,
    updated_at: now,
  };

  if (existing) {
    const { error } = await supabaseServer.from(INVOICES).update(payload).eq("id", id);
    if (error) throw translate(error);
    // Lines are replaced wholesale rather than diffed: an invoice is small, and
    // a diff has to get line_no reuse right to avoid tripping the unique index.
    const { error: clearError } = await supabaseServer.from(LINES).delete().eq("invoice_id", id);
    if (clearError) throw new Error(clearError.message);
  } else {
    const { error } = await supabaseServer
      .from(INVOICES)
      .insert({ id, ...payload, created_at: now });
    if (error) throw translate(error);
  }

  const lineRows = parsed.items.map((item, index) => {
    const computed = totals.lines[index];
    return {
      id: randomUUID(),
      invoice_id: id,
      line_no: index + 1,
      item_id: item.item_id || null,
      item_name: item.item_name,
      description: item.description,
      hsn: item.hsn,
      unit: item.unit,
      quantity: item.quantity,
      rate: item.rate,
      discount: computed.discount,
      amount: computed.amount,
      taxable_value: computed.taxable_value,
      gst_rate: computed.gst_rate,
      cgst: computed.cgst,
      sgst: computed.sgst,
      igst: computed.igst,
      cess: computed.cess,
      total_value: computed.total_value,
      created_at: now,
    };
  });

  const { error: lineError } = await supabaseServer.from(LINES).insert(lineRows);
  if (lineError) throw new Error(lineError.message);

  const saved = await getSoyaInvoiceById(id);
  if (!saved) throw new Error("Invoice vanished immediately after saving");
  return saved;
}

function translate(error: { code?: string; message: string }): Error {
  if (error.code === "23505" && error.message.includes("invoice_no")) {
    return new Error(
      "That invoice number is already used by this company this financial year",
    );
  }
  return new Error(error.message);
}

export async function createSoyaInvoice(input: SoyaInvoiceInput): Promise<SoyaInvoice> {
  await requireRole(["admin"]);
  const parsed = soyaInvoiceSchema.parse(input);
  return persist(randomUUID(), parsed, null);
}

export async function updateSoyaInvoice(
  id: string,
  input: SoyaInvoiceInput,
): Promise<SoyaInvoice> {
  await requireRole(["admin"]);
  const existing = await getSoyaInvoiceById(id);
  if (!existing) throw new Error("Invoice not found");
  if (isInvoiceLocked(existing)) {
    throw new Error(
      "This invoice has been filed with an IRN and cannot be edited. Cancel it within 24 hours of filing, or raise a credit note.",
    );
  }
  const parsed = soyaInvoiceSchema.parse(input);
  return persist(id, parsed, existing);
}

export async function deleteSoyaInvoice(id: string): Promise<void> {
  await requireRole(["admin"]);
  const existing = await getSoyaInvoiceById(id);
  if (!existing) return;
  if (isInvoiceLocked(existing)) {
    throw new Error(
      "This invoice has been filed with an IRN and cannot be deleted. Cancel it on the portal first.",
    );
  }
  // Lines go with it: the foreign key is ON DELETE CASCADE.
  const { error } = await supabaseServer.from(INVOICES).delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface FileResult {
  ok: boolean;
  /** True when no credentials are configured and nothing was sent. */
  preview: boolean;
  message: string;
  payload: unknown;
  invoice: SoyaInvoice;
}

/**
 * Files the invoice with the portal, which returns the IRN and — when the
 * payload carries a transport block — the e-Way Bill in the same response.
 *
 * Blocked problems are checked before anything is sent, because each rejected
 * attempt is a wasted round trip against a rate-limited portal.
 */
export async function fileSoyaInvoice(id: string): Promise<FileResult> {
  await requireRole(["admin"]);
  const invoice = await getSoyaInvoiceById(id);
  if (!invoice) throw new Error("Invoice not found");
  const seller = await sellerForCompany(invoice.company_id);

  const blocking = checkEInvoiceReady(invoice, seller).filter(
    (problem) => problem.severity === "blocking",
  );
  if (blocking.length > 0) {
    return {
      ok: false,
      preview: false,
      message: blocking.map((problem) => problem.message).join("\n"),
      payload: null,
      invoice,
    };
  }

  const payload = buildEInvoicePayload(invoice, seller);
  const result = await generateIrn(payload, seller);

  if (!result.ok) {
    await supabaseServer
      .from(INVOICES)
      .update({
        einvoice_status: "failed",
        einvoice_error: `${result.code}: ${result.message}`.slice(0, 2000),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    const refreshed = await getSoyaInvoiceById(id);
    return {
      ok: false,
      preview: false,
      message: result.message,
      payload: result.payload,
      invoice: refreshed ?? invoice,
    };
  }

  // Nothing was sent — no credentials. Leave the invoice untouched so a preview
  // can never be mistaken for a filing.
  if (result.preview) {
    return {
      ok: true,
      preview: true,
      message:
        "Preview only — no portal credentials are configured, so nothing was filed. This is the exact payload that would be sent.",
      payload: result.payload,
      invoice,
    };
  }

  const hasEwb = Boolean(result.ewbNo);
  const { error } = await supabaseServer
    .from(INVOICES)
    .update({
      einvoice_status: "generated",
      irn: result.irn,
      ack_no: result.ackNo,
      ack_date: result.ackDate || new Date().toISOString(),
      signed_qr: result.signedQr,
      einvoice_error: "",
      ewb_status: hasEwb ? "generated" : "not_applicable",
      ewb_no: result.ewbNo,
      ewb_date: result.ewbDate || null,
      ewb_valid_until: result.ewbValidUntil || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  const refreshed = await getSoyaInvoiceById(id);
  return {
    ok: true,
    preview: false,
    message: hasEwb
      ? "e-Invoice and e-Way Bill generated successfully"
      : "e-Invoice generated successfully",
    payload: result.payload,
    invoice: refreshed ?? invoice,
  };
}

/** Cancels the IRN on the portal. Only possible within 24 hours of filing. */
export async function cancelSoyaInvoiceIrn(
  id: string,
  reasonCode: string,
  remark: string,
): Promise<{ ok: boolean; message: string }> {
  await requireRole(["admin"]);
  const invoice = await getSoyaInvoiceById(id);
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.einvoice_status !== "generated" || !invoice.irn) {
    return { ok: false, message: "This invoice has no IRN to cancel" };
  }

  const filedAt = invoice.ack_date ? Date.parse(invoice.ack_date) : NaN;
  if (Number.isFinite(filedAt) && Date.now() - filedAt > 24 * 60 * 60 * 1000) {
    return {
      ok: false,
      message:
        "The portal's 24-hour cancellation window has closed. Raise a credit note instead.",
    };
  }

  const seller = await sellerForCompany(invoice.company_id);
  const result = await cancelIrn(invoice.irn, reasonCode, remark, seller);
  if (!result.ok) return { ok: false, message: result.message };

  if (result.preview) {
    return {
      ok: true,
      message: "Preview only — no portal credentials are configured, so nothing was cancelled.",
    };
  }

  const { error } = await supabaseServer
    .from(INVOICES)
    .update({
      einvoice_status: "cancelled",
      irn_cancelled_at: new Date().toISOString(),
      irn_cancel_reason: remark.slice(0, 200),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true, message: "IRN cancelled on the portal" };
}
