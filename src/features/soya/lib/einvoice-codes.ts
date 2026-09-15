/**
 * Code lists the NIC e-Invoice / e-Way Bill portal accepts.
 *
 * These are not our choices. The portal validates each field against a fixed
 * master list and rejects the whole document on a mismatch, so the values here
 * are the portal's own codes and the labels are only for our dropdowns. Where a
 * list is long we carry the subset this business can actually use, marked as
 * such, rather than a truncated version of the full list pretending to be
 * complete.
 */

/** Unit Quantity Codes. The portal's list is ~100 long; these are the ones
 *  agricultural commodity trading uses. Extend as needed — an unlisted UQC is
 *  rejected outright, so guessing one is worse than adding it here. */
export const UQC_OPTIONS = [
  { value: "MTS", label: "MTS — Metric Tonne" },
  { value: "KGS", label: "KGS — Kilograms" },
  { value: "QTL", label: "QTL — Quintal" },
  { value: "BAG", label: "BAG — Bags" },
  { value: "LTR", label: "LTR — Litres" },
  { value: "NOS", label: "NOS — Numbers" },
  { value: "TON", label: "TON — Tonnes" },
  { value: "OTH", label: "OTH — Others" },
] as const;

export type UqcCode = (typeof UQC_OPTIONS)[number]["value"];

export function isKnownUqc(value: string): boolean {
  return UQC_OPTIONS.some((option) => option.value === value);
}

/** DOCTYP. A credit note is how a filed invoice gets corrected — an IRN can
 *  only be cancelled within 24 hours, after which a CRN is the only route. */
export const DOC_TYPE_OPTIONS = [
  { value: "INV", label: "Tax Invoice" },
  { value: "CRN", label: "Credit Note" },
  { value: "DBN", label: "Debit Note" },
] as const;

/** SUPTYP. B2B covers everything this business does today; the export codes
 *  are here so the field does not have to be reopened later. */
export const SUPPLY_TYPE_OPTIONS = [
  { value: "B2B", label: "B2B — Business to Business" },
  { value: "SEZWP", label: "SEZ with payment of tax" },
  { value: "SEZWOP", label: "SEZ without payment of tax" },
  { value: "EXPWP", label: "Export with payment of tax" },
  { value: "EXPWOP", label: "Export without payment of tax" },
  { value: "DEXP", label: "Deemed Export" },
] as const;

/** TransMode on the e-Way Bill. */
export const TRANSPORT_MODE_OPTIONS = [
  { value: "1", label: "1 — Road" },
  { value: "2", label: "2 — Rail" },
  { value: "3", label: "3 — Air" },
  { value: "4", label: "4 — Ship" },
] as const;

/** VehType. Over-dimensional cargo gets a longer validity per kilometre. */
export const VEHICLE_TYPE_OPTIONS = [
  { value: "R", label: "R — Regular" },
  { value: "O", label: "O — Over Dimensional Cargo" },
] as const;

/** The portal's fixed cancellation reasons. Free text is not accepted. */
export const IRN_CANCEL_REASONS = [
  { value: "1", label: "Duplicate" },
  { value: "2", label: "Data entry mistake" },
  { value: "3", label: "Order cancelled" },
  { value: "4", label: "Other" },
] as const;

/**
 * e-Way Bill is required once the consignment value crosses this. Below it the
 * e-Invoice is still required but the transport block is optional, which is why
 * the form only insists on a vehicle number above the threshold.
 */
export const EWB_THRESHOLD_RUPEES = 50000;

/**
 * Vehicle numbers are validated by the portal against this shape. Accepts the
 * current format (KA28AB3276), the older series (KA28A3276) and bharat-series
 * registrations (22BH1234AA).
 */
const VEHICLE_NO_SHAPE =
  /^(?:[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}|[0-9]{2}BH[0-9]{4}[A-Z]{1,2})$/;

export function normalizeVehicleNo(input: string): string {
  return (input || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidVehicleNo(input: string): boolean {
  return VEHICLE_NO_SHAPE.test(normalizeVehicleNo(input));
}

/**
 * HSN must be 4, 6 or 8 digits. The portal also accepts 2 for a few services,
 * but goods never use it, so a 2-digit code here is a typo rather than a
 * shorter classification.
 */
export function isValidHsn(input: string): boolean {
  const hsn = (input || "").trim();
  return /^[0-9]{4}$|^[0-9]{6}$|^[0-9]{8}$/.test(hsn);
}

/** Common agricultural HSN codes, offered as suggestions rather than a limit. */
export const HSN_SUGGESTIONS = [
  { hsn: "2304", label: "Soya bean oil-cake and other solid residues (DOC / meal)" },
  { hsn: "1201", label: "Soya beans, whether or not broken" },
  { hsn: "1507", label: "Soya-bean oil and its fractions" },
  { hsn: "1005", label: "Maize (corn)" },
  { hsn: "2302", label: "Bran, sharps and other residues" },
] as const;
