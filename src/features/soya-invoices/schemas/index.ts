import { z } from "zod";

import { isValidHsn, isKnownUqc, isValidVehicleNo, normalizeVehicleNo } from "@/features/soya/lib/einvoice-codes";
import { checkGstin } from "@/features/soya/lib/gst";

/**
 * Soya tax invoices — the document we issue, print, and file with the
 * government.
 *
 * Distinct from soya_party_entries, which is the trading ledger the business
 * already keeps. An entry records that goods moved and money is owed; an
 * invoice is the legal document about it. One entry may eventually carry an
 * invoice reference, but the two are not the same record and are not merged
 * here — a filed invoice must stay frozen while a ledger row stays editable.
 */

/* ------------------------------------------------------------------ items */

export const soyaItemSchema = z
  .object({
    id: z.string().optional(),
    company_id: z.string().trim().min(1, "Choose a company"),
    name: z.string().trim().min(1, "Item name is required"),
    hsn: z.string().trim().default(""),
    unit: z.string().trim().default("MTS"),
    gst_rate: z.coerce.number().min(0, "Rate cannot be negative").max(100).default(0),
    default_rate: z.coerce.number().min(0).default(0),
    description: z.string().trim().default(""),
    is_active: z.boolean().default(true),
  })
  .superRefine((item, ctx) => {
    // HSN is optional while setting up, but the portal rejects a line without
    // one — so a wrong HSN is worse than a blank, and only blank is allowed.
    if (item.hsn && !isValidHsn(item.hsn)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "HSN must be 4, 6 or 8 digits",
        path: ["hsn"],
      });
    }
    if (item.unit && !isKnownUqc(item.unit)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${item.unit} is not a unit the e-Invoice portal accepts`,
        path: ["unit"],
      });
    }
  });

export type SoyaItemInput = z.infer<typeof soyaItemSchema>;

export interface SoyaItem extends Omit<SoyaItemInput, "id"> {
  id: string;
  created_at?: string;
  updated_at?: string;
}

/* --------------------------------------------------------- invoice lines */

export const soyaInvoiceItemSchema = z.object({
  id: z.string().optional(),
  line_no: z.coerce.number().int().min(1).default(1),
  item_id: z.string().trim().default(""),
  item_name: z.string().trim().min(1, "Item is required"),
  description: z.string().trim().default(""),
  hsn: z.string().trim().default(""),
  unit: z.string().trim().default("MTS"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  rate: z.coerce.number().min(0, "Rate cannot be negative"),
  discount: z.coerce.number().min(0).default(0),
  gst_rate: z.coerce.number().min(0).max(100).default(0),
});

export type SoyaInvoiceItemInput = z.infer<typeof soyaInvoiceItemSchema>;

export interface SoyaInvoiceItem extends SoyaInvoiceItemInput {
  id: string;
  invoice_id: string;
  amount: number;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  total_value: number;
}

/* -------------------------------------------------------------- invoices */

const addressBlock = {
  address: z.string().trim().default(""),
  place: z.string().trim().default(""),
  pincode: z.string().trim().default(""),
};

export const soyaInvoiceSchema = z
  .object({
    id: z.string().optional(),
    company_id: z.string().trim().min(1, "Choose a company"),

    /** Blank means "allocate the next number in this company's series". */
    invoice_no: z.string().trim().default(""),
    invoice_date: z.string().trim().min(1, "Invoice date is required"),

    doc_type: z.enum(["INV", "CRN", "DBN"]).default("INV"),
    supply_type: z
      .enum(["B2B", "SEZWP", "SEZWOP", "EXPWP", "EXPWOP", "DEXP"])
      .default("B2B"),
    reverse_charge: z.boolean().default(false),

    party_id: z.string().trim().default(""),
    party_name: z.string().trim().min(1, "Party is required"),
    party_legal_name: z.string().trim().default(""),
    party_gstin: z
      .string()
      .trim()
      .default("")
      .transform((value) => value.toUpperCase()),
    party_state_code: z.string().trim().default(""),
    party_registration_type: z
      .enum(["regular", "composition", "unregistered", "consumer"])
      .default("regular"),
    bill_to_address: addressBlock.address,
    bill_to_place: addressBlock.place,
    bill_to_pincode: addressBlock.pincode,
    party_phone: z.string().trim().default(""),
    party_email: z.string().trim().default(""),

    // Blank ship-to means "same as bill-to"; the payload builder fills it in.
    ship_to_name: z.string().trim().default(""),
    ship_to_gstin: z
      .string()
      .trim()
      .default("")
      .transform((value) => value.toUpperCase()),
    ship_to_address: addressBlock.address,
    ship_to_place: addressBlock.place,
    ship_to_pincode: addressBlock.pincode,
    ship_to_state_code: z.string().trim().default(""),

    // Blank dispatch-from means "our own premises".
    dispatch_from_name: z.string().trim().default(""),
    dispatch_from_address: addressBlock.address,
    dispatch_from_place: addressBlock.place,
    dispatch_from_pincode: addressBlock.pincode,
    dispatch_from_state_code: z.string().trim().default(""),

    place_of_supply_code: z.string().trim().default(""),
    other_charges: z.coerce.number().default(0),

    transporter_name: z.string().trim().default(""),
    transporter_id: z
      .string()
      .trim()
      .default("")
      .transform((value) => value.toUpperCase()),
    transport_mode: z.string().trim().default(""),
    vehicle_no: z
      .string()
      .trim()
      .default("")
      .transform((value) => normalizeVehicleNo(value)),
    vehicle_type: z.string().trim().default(""),
    distance_km: z.coerce.number().int().min(0).default(0),
    transport_doc_no: z.string().trim().default(""),
    transport_doc_date: z.string().trim().default(""),

    notes: z.string().trim().default(""),

    items: z.array(soyaInvoiceItemSchema).min(1, "Add at least one item"),
  })
  .superRefine((invoice, ctx) => {
    if (invoice.party_gstin) {
      const result = checkGstin(invoice.party_gstin);
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.reason,
          path: ["party_gstin"],
        });
      }
    } else if (
      invoice.party_registration_type === "regular" ||
      invoice.party_registration_type === "composition"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A regular or composition dealer must have a GSTIN",
        path: ["party_gstin"],
      });
    }

    if (invoice.ship_to_gstin && !checkGstin(invoice.ship_to_gstin).valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: checkGstin(invoice.ship_to_gstin).valid
          ? ""
          : "Ship-to GSTIN is not valid",
        path: ["ship_to_gstin"],
      });
    }

    // Without this the tax split silently falls back to inter-state, which
    // would file the money to the wrong government rather than fail loudly.
    if (!invoice.place_of_supply_code) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Place of supply is required — it decides CGST+SGST versus IGST",
        path: ["place_of_supply_code"],
      });
    }

    for (const [index, pincode] of [
      ["bill_to_pincode", invoice.bill_to_pincode],
      ["ship_to_pincode", invoice.ship_to_pincode],
      ["dispatch_from_pincode", invoice.dispatch_from_pincode],
    ] as const) {
      if (pincode && !/^\d{6}$/.test(pincode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Pincode must be 6 digits",
          path: [index],
        });
      }
    }

    if (invoice.vehicle_no && !isValidVehicleNo(invoice.vehicle_no)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a valid vehicle number (e.g. KA28AB3276)",
        path: ["vehicle_no"],
      });
    }
  });

export type SoyaInvoiceInput = z.infer<typeof soyaInvoiceSchema>;
export type SoyaInvoiceDraft = z.input<typeof soyaInvoiceSchema>;

export type EInvoiceStatus =
  | "pending"
  | "generated"
  | "cancelled"
  | "failed"
  | "not_applicable";

export interface SoyaInvoice {
  id: string;
  company_id: string;
  invoice_no: string;
  invoice_date: string;
  fy_start_year: number;
  doc_type: "INV" | "CRN" | "DBN";
  supply_type: string;
  reverse_charge: boolean;

  party_id: string;
  party_name: string;
  party_legal_name: string;
  party_gstin: string;
  party_state_code: string;
  party_registration_type: string;
  bill_to_address: string;
  bill_to_place: string;
  bill_to_pincode: string;
  party_phone: string;
  party_email: string;

  ship_to_name: string;
  ship_to_gstin: string;
  ship_to_address: string;
  ship_to_place: string;
  ship_to_pincode: string;
  ship_to_state_code: string;

  dispatch_from_name: string;
  dispatch_from_address: string;
  dispatch_from_place: string;
  dispatch_from_pincode: string;
  dispatch_from_state_code: string;

  place_of_supply_code: string;

  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  other_charges: number;
  round_off: number;
  total_value: number;

  transporter_name: string;
  transporter_id: string;
  transport_mode: string;
  vehicle_no: string;
  vehicle_type: string;
  distance_km: number;
  transport_doc_no: string;
  transport_doc_date: string;

  einvoice_status: EInvoiceStatus;
  irn: string;
  ack_no: string;
  ack_date: string;
  signed_qr: string;
  einvoice_error: string;
  irn_cancelled_at: string;
  irn_cancel_reason: string;

  ewb_status: EInvoiceStatus;
  ewb_no: string;
  ewb_date: string;
  ewb_valid_until: string;
  ewb_error: string;
  ewb_cancelled_at: string;

  notes: string;
  items: SoyaInvoiceItem[];
  created_at?: string;
  updated_at?: string;
}

/**
 * A filed invoice is frozen. Once an IRN exists the document has been reported
 * to the government and any change makes our copy disagree with theirs — the
 * route back is to cancel within 24 hours, or raise a credit note after.
 */
export function isInvoiceLocked(invoice: Pick<SoyaInvoice, "einvoice_status">): boolean {
  return invoice.einvoice_status === "generated";
}
