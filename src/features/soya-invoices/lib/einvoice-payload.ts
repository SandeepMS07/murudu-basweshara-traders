/**
 * Builds the JSON the NIC e-Invoice portal (IRP) expects, and says in advance
 * what would make it reject the document.
 *
 * Pure — no network, no database. That separation is the point: the payload can
 * be built, inspected and tested long before anyone has portal credentials, and
 * when a submission is rejected the payload can be reproduced offline from the
 * saved invoice rather than guessed at from a log.
 *
 * Schema: e-Invoice JSON 1.1, the version the portal has accepted since 2020.
 * Field names are the portal's abbreviations (PrdDesc, AssAmt, RndOffAmt) and
 * are deliberately NOT renamed to something readable — they have to match the
 * specification exactly, and a mapping layer would only add a place to get them
 * wrong.
 */

import { EWB_THRESHOLD_RUPEES, isValidHsn, isValidVehicleNo } from "@/features/soya/lib/einvoice-codes";
import { checkGstin } from "@/features/soya/lib/gst";
import type { SoyaInvoice } from "@/features/soya-invoices/schemas";

/** The seller half of the payload comes from the company master. */
export interface EInvoiceSeller {
  gstin: string;
  legal_name: string;
  name: string;
  address: string;
  place: string;
  pincode: string;
  state_code: string;
  phone: string;
  email: string;
  /**
   * Aggregate annual turnover >= Rs 10 crore.
   *
   * Only these filers are bound by the IRP's 30-day reporting window (in force
   * since 1 April 2025). Below it there is no deadline, so treating an older
   * invoice as unfilable would block a legal one.
   */
  aato_over_10cr?: boolean;
}

/** The portal wants dd/mm/yyyy, not ISO. */
export function toPortalDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || "");
  if (!match) return "";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Trims to the portal's max length rather than letting it reject the document. */
function cap(value: string, max: number): string {
  return (value || "").trim().slice(0, max);
}

/**
 * The portal requires Addr1 to be at least 1 character and rejects null. An
 * empty address is a real data problem, but it should surface as a validation
 * message from checkEInvoiceReady, not as a cryptic portal error code.
 */
function addr(value: string): string {
  return cap(value, 100) || "NA";
}

export interface EInvoicePayload {
  Version: string;
  TranDtls: Record<string, string>;
  DocDtls: Record<string, string>;
  SellerDtls: Record<string, string>;
  BuyerDtls: Record<string, string>;
  DispDtls?: Record<string, string>;
  ShipDtls?: Record<string, string>;
  ItemList: Record<string, string | number>[];
  ValDtls: Record<string, number>;
  EwbDtls?: Record<string, string | number>;
}

/**
 * Whether an e-Way Bill is required alongside the IRN.
 *
 * Above ₹50,000 consignment value it is mandatory. Below it the user may still
 * want one, and the portal accepts EwbDtls either way — so the real trigger is
 * "vehicle number present OR over the threshold", not the threshold alone.
 */
export function needsEwayBill(invoice: Pick<SoyaInvoice, "total_value" | "vehicle_no" | "transporter_id">): boolean {
  return (
    invoice.total_value >= EWB_THRESHOLD_RUPEES ||
    Boolean(invoice.vehicle_no) ||
    Boolean(invoice.transporter_id)
  );
}

export interface ReadinessProblem {
  field: string;
  message: string;
  /** blocking problems stop submission; warnings do not. */
  severity: "blocking" | "warning";
}

/**
 * Everything the portal would reject, checked before we send rather than after.
 *
 * The IRP returns numbered error codes with terse text, one at a time, and
 * every rejected attempt is a round trip. Checking here turns that into a list
 * the user can fix in one pass.
 */
export function checkEInvoiceReady(
  invoice: SoyaInvoice,
  seller: EInvoiceSeller,
): ReadinessProblem[] {
  const problems: ReadinessProblem[] = [];
  const block = (field: string, message: string) =>
    problems.push({ field, message, severity: "blocking" });
  const warn = (field: string, message: string) =>
    problems.push({ field, message, severity: "warning" });

  /* --- seller --- */
  if (!seller.gstin) block("seller.gstin", "The company has no GSTIN");
  else if (!checkGstin(seller.gstin).valid)
    block("seller.gstin", "The company's GSTIN is not valid");
  if (!seller.legal_name && !seller.name)
    block("seller.legal_name", "The company has no legal name to print");
  if (!/^\d{6}$/.test(seller.pincode))
    block("seller.pincode", "The company needs a 6-digit pincode");
  if (!seller.address) block("seller.address", "The company has no address");
  if (!seller.state_code) block("seller.state_code", "The company has no state");

  /* --- buyer --- */
  const registered =
    invoice.party_registration_type === "regular" ||
    invoice.party_registration_type === "composition";
  if (registered) {
    if (!invoice.party_gstin) block("party_gstin", "A registered buyer must have a GSTIN");
    else if (!checkGstin(invoice.party_gstin).valid)
      block("party_gstin", "The buyer's GSTIN is not valid");
  }
  if (!invoice.party_legal_name && !invoice.party_name)
    block("party_name", "The buyer has no name");
  if (invoice.bill_to_pincode && !/^\d{6}$/.test(invoice.bill_to_pincode))
    block("bill_to_pincode", "Bill-to pincode must be 6 digits");
  if (!invoice.bill_to_pincode)
    block("bill_to_pincode", "Bill-to pincode is required by the portal");
  if (!invoice.bill_to_address) block("bill_to_address", "Bill-to address is required");

  /* --- the supply itself --- */
  if (!invoice.place_of_supply_code)
    block("place_of_supply_code", "Place of supply decides the tax split and is required");
  if (!invoice.invoice_no) block("invoice_no", "Invoice number is required");
  if (invoice.invoice_no.length > 16)
    block("invoice_no", "The portal allows at most 16 characters in an invoice number");
  if (!/^[A-Za-z0-9/-]+$/.test(invoice.invoice_no))
    block("invoice_no", "Invoice number may only contain letters, digits, / and -");
  if (!toPortalDate(invoice.invoice_date)) block("invoice_date", "Invoice date is not a date");

  // The portal always refuses a document dated in the future.
  //
  // The 30-day limit is narrower than it is often described: it binds only
  // filers with aggregate annual turnover of Rs 10 crore or more, and only
  // since 1 April 2025. For anyone below that there is no deadline at all, so
  // this warns rather than blocks unless the company says the rule applies to
  // it — blocking a legal invoice is the worse failure of the two.
  const invoiceDay = new Date(`${invoice.invoice_date}T00:00:00`);
  if (!Number.isNaN(invoiceDay.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysOld = Math.floor((today.getTime() - invoiceDay.getTime()) / 86400000);
    if (daysOld < 0) {
      block("invoice_date", "The portal refuses an invoice dated in the future");
    } else if (daysOld > 30) {
      const message = `This invoice is ${daysOld} days old. The IRP's 30-day reporting window applies to filers with turnover of ₹10 crore or more.`;
      if (seller.aato_over_10cr) block("invoice_date", message);
      else warn("invoice_date", message);
    }
  }

  /* --- lines --- */
  if (invoice.items.length === 0) block("items", "An invoice needs at least one item");
  invoice.items.forEach((item, index) => {
    const where = `items.${index}`;
    if (!item.hsn) block(`${where}.hsn`, `${item.item_name || `Line ${index + 1}`}: HSN is required`);
    else if (!isValidHsn(item.hsn))
      block(`${where}.hsn`, `${item.item_name}: HSN must be 4, 6 or 8 digits`);
    if (!(item.quantity > 0))
      block(`${where}.quantity`, `${item.item_name}: quantity must be greater than zero`);
    if (!item.unit) block(`${where}.unit`, `${item.item_name}: unit is required`);
  });

  /* --- e-Way Bill half --- */
  if (needsEwayBill(invoice)) {
    const overThreshold = invoice.total_value >= EWB_THRESHOLD_RUPEES;
    if (!invoice.transport_mode)
      block("transport_mode", "Transport mode is required for the e-Way Bill");
    if (!invoice.vehicle_no && !invoice.transporter_id)
      block(
        "vehicle_no",
        overThreshold
          ? `Over ₹${EWB_THRESHOLD_RUPEES.toLocaleString("en-IN")} an e-Way Bill is required, so give a vehicle number or a transporter ID`
          : "Give a vehicle number or a transporter ID",
      );
    if (invoice.vehicle_no && !isValidVehicleNo(invoice.vehicle_no))
      block("vehicle_no", `${invoice.vehicle_no} is not a valid vehicle number`);
    if (!invoice.distance_km)
      warn(
        "distance_km",
        "Distance is 0 — the portal will compute it from the pincodes, which may not match the route",
      );
  }

  /* --- already filed --- */
  if (invoice.einvoice_status === "generated")
    block("irn", `Already filed: IRN ${invoice.irn.slice(0, 12)}…`);

  return problems;
}

/** Convenience: is this invoice submittable right now? */
export function isEInvoiceReady(invoice: SoyaInvoice, seller: EInvoiceSeller): boolean {
  return checkEInvoiceReady(invoice, seller).every(
    (problem) => problem.severity !== "blocking",
  );
}

/**
 * The payload itself.
 *
 * Builds unconditionally — it does not refuse an invoice that would be
 * rejected, because being able to look at a bad payload is how a rejection gets
 * diagnosed. Callers gate on checkEInvoiceReady before sending.
 */
export function buildEInvoicePayload(
  invoice: SoyaInvoice,
  seller: EInvoiceSeller,
): EInvoicePayload {
  const isIntra =
    Boolean(seller.state_code) &&
    Boolean(invoice.place_of_supply_code) &&
    seller.state_code === invoice.place_of_supply_code;

  const payload: EInvoicePayload = {
    Version: "1.1",
    TranDtls: {
      TaxSch: "GST",
      SupTyp: invoice.supply_type || "B2B",
      RegRev: invoice.reverse_charge ? "Y" : "N",
      // Y only in the rare case of IGST charged on an intra-state supply.
      IgstOnIntra: isIntra && invoice.igst > 0 ? "Y" : "N",
    },
    DocDtls: {
      Typ: invoice.doc_type || "INV",
      No: cap(invoice.invoice_no, 16),
      Dt: toPortalDate(invoice.invoice_date),
    },
    SellerDtls: {
      Gstin: seller.gstin,
      LglNm: cap(seller.legal_name || seller.name, 100),
      TrdNm: cap(seller.name || seller.legal_name, 100),
      Addr1: addr(seller.address),
      Loc: cap(seller.place, 50) || "NA",
      Pin: seller.pincode,
      Stcd: seller.state_code,
      Ph: cap(seller.phone.replace(/\D/g, ""), 12),
      Em: cap(seller.email, 100),
    },
    BuyerDtls: {
      // The portal's placeholder for an unregistered buyer.
      Gstin: invoice.party_gstin || "URP",
      LglNm: cap(invoice.party_legal_name || invoice.party_name, 100),
      TrdNm: cap(invoice.party_name || invoice.party_legal_name, 100),
      Pos: invoice.place_of_supply_code,
      Addr1: addr(invoice.bill_to_address),
      Loc: cap(invoice.bill_to_place, 50) || "NA",
      Pin: invoice.bill_to_pincode,
      Stcd: invoice.party_state_code || invoice.place_of_supply_code,
      Ph: cap(invoice.party_phone.replace(/\D/g, ""), 12),
      Em: cap(invoice.party_email, 100),
    },
    ItemList: invoice.items.map((item, index) => ({
      SlNo: String(item.line_no || index + 1),
      PrdDesc: cap(item.description || item.item_name, 300),
      // This business ships goods, never services.
      IsServc: "N",
      HsnCd: item.hsn,
      Qty: item.quantity,
      Unit: item.unit,
      UnitPrice: item.rate,
      TotAmt: item.amount,
      Discount: item.discount || 0,
      AssAmt: item.taxable_value,
      GstRt: item.gst_rate,
      IgstAmt: item.igst,
      CgstAmt: item.cgst,
      SgstAmt: item.sgst,
      CesRt: 0,
      CesAmt: 0,
      CesNonAdvlAmt: 0,
      StateCesRt: 0,
      StateCesAmt: 0,
      StateCesNonAdvlAmt: 0,
      OthChrg: 0,
      TotItemVal: item.total_value,
    })),
    ValDtls: {
      AssVal: invoice.taxable_value,
      CgstVal: invoice.cgst,
      SgstVal: invoice.sgst,
      IgstVal: invoice.igst,
      CesVal: invoice.cess || 0,
      StCesVal: 0,
      Discount: 0,
      OthChrg: invoice.other_charges || 0,
      RndOffAmt: invoice.round_off,
      TotInvVal: invoice.total_value,
    },
  };

  // Only sent when it genuinely differs — the portal treats a present-but-empty
  // block as a claim that the goods came from somewhere else, and validates it.
  if (invoice.dispatch_from_name || invoice.dispatch_from_address) {
    payload.DispDtls = {
      Nm: cap(invoice.dispatch_from_name || seller.name, 100),
      Addr1: addr(invoice.dispatch_from_address),
      Loc: cap(invoice.dispatch_from_place, 50) || "NA",
      Pin: invoice.dispatch_from_pincode,
      Stcd: invoice.dispatch_from_state_code,
    };
  }

  if (invoice.ship_to_name || invoice.ship_to_address) {
    payload.ShipDtls = {
      Gstin: invoice.ship_to_gstin || invoice.party_gstin || "URP",
      LglNm: cap(invoice.ship_to_name || invoice.party_legal_name || invoice.party_name, 100),
      TrdNm: cap(invoice.ship_to_name || invoice.party_name, 100),
      Addr1: addr(invoice.ship_to_address || invoice.bill_to_address),
      Loc: cap(invoice.ship_to_place || invoice.bill_to_place, 50) || "NA",
      Pin: invoice.ship_to_pincode || invoice.bill_to_pincode,
      Stcd: invoice.ship_to_state_code || invoice.party_state_code,
    };
  }

  if (needsEwayBill(invoice)) {
    payload.EwbDtls = {
      TransId: invoice.transporter_id,
      TransName: cap(invoice.transporter_name, 100),
      Distance: invoice.distance_km || 0,
      TransDocNo: cap(invoice.transport_doc_no, 15),
      TransDocDt: toPortalDate(invoice.transport_doc_date),
      VehNo: invoice.vehicle_no,
      VehType: invoice.vehicle_type || "R",
      TransMode: invoice.transport_mode,
    };
  }

  return payload;
}
