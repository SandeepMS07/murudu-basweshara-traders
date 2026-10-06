/**
 * GST identity and tax-split rules for the Soya business line.
 *
 * Pure functions, no I/O — the tax on an invoice is *derived* here and never
 * typed by a user. Getting the intra/inter split wrong does not change what the
 * customer pays; it files the money to the wrong government, which is why this
 * is computed from state codes rather than entered.
 */

/** GST state codes, the first two digits of every GSTIN. */
export const GST_STATES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
};

/** Karnataka — where both trading firms are registered. */
export const HOME_STATE_CODE = "29";

export const GST_STATE_OPTIONS = Object.entries(GST_STATES)
  .map(([code, name]) => ({ code, name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function stateNameForCode(code: string): string {
  return GST_STATES[(code || "").trim()] ?? "";
}

/**
 * 15 characters: 2-digit state code, 10-character PAN, entity number, a
 * literal 'Z', then a checksum character.
 */
const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHECKSUM_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * The mod-36 check character the GST system appends. Shape alone is not
 * enough — it accepts transpositions and single-character typos that this
 * rejects.
 */
function gstinChecksumChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i += 1) {
    const value = CHECKSUM_ALPHABET.indexOf(first14[i]);
    if (value < 0) return "";
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHECKSUM_ALPHABET[(36 - (sum % 36)) % 36];
}

export type GstinCheck =
  | { valid: true; stateCode: string; stateName: string; pan: string }
  | { valid: false; reason: string };

/**
 * Validates a GSTIN and pulls the state out of it. This is what stops a PAN
 * being stored in the GSTIN field — the live maize data already has one
 * ("BVMPS6534F"), which would otherwise silently break the tax split.
 */
export function checkGstin(input: string): GstinCheck {
  const gstin = (input || "").trim().toUpperCase();
  if (!gstin) return { valid: false, reason: "GSTIN is empty" };
  if (gstin.length !== 15) {
    return {
      valid: false,
      reason:
        gstin.length === 10
          ? "That is a 10-character PAN, not a 15-character GSTIN"
          : `A GSTIN is 15 characters; this is ${gstin.length}`,
    };
  }
  if (!GSTIN_SHAPE.test(gstin)) {
    return { valid: false, reason: "Not in GSTIN format" };
  }
  const stateCode = gstin.slice(0, 2);
  if (!GST_STATES[stateCode]) {
    return { valid: false, reason: `${stateCode} is not a valid state code` };
  }
  if (gstinChecksumChar(gstin.slice(0, 14)) !== gstin[14]) {
    return { valid: false, reason: "Check digit does not match — likely a typo" };
  }
  return {
    valid: true,
    stateCode,
    stateName: GST_STATES[stateCode],
    pan: gstin.slice(2, 12),
  };
}

/** The state code a GSTIN implies, or "" when it cannot be trusted. */
export function stateCodeFromGstin(gstin: string): string {
  const result = checkGstin(gstin);
  return result.valid ? result.stateCode : "";
}

export type TaxKind = "intra" | "inter";

export type TaxSplit = {
  kind: TaxKind;
  /** Half the rate each, and 0 when inter-state. */
  cgst: number;
  sgst: number;
  /** The full rate, and 0 when intra-state. */
  igst: number;
  /** cgst + sgst + igst. */
  totalTax: number;
};

function round2(value: number): number {
  return Number((value || 0).toFixed(2));
}

/**
 * The whole rule, in one place.
 *
 * Supplier state equal to the place of supply is an intra-state supply, taxed
 * half to the centre and half to the state. Anything else is inter-state and
 * takes the full rate as IGST. Place of supply is passed in rather than read
 * off the buyer, because ship-to can differ from bill-to and the law follows
 * where the goods land.
 */
export function computeTaxSplit(
  taxableValue: number,
  ratePercent: number,
  supplierStateCode: string,
  placeOfSupplyStateCode: string,
): TaxSplit {
  const supplier = (supplierStateCode || "").trim();
  const place = (placeOfSupplyStateCode || "").trim();
  const base = taxableValue || 0;
  const rate = ratePercent || 0;

  // An unknown place of supply must not silently look intra-state, which is
  // the cheaper-looking of the two and the one that hides the error.
  const isIntra = Boolean(supplier) && Boolean(place) && supplier === place;

  if (isIntra) {
    const half = round2((base * (rate / 2)) / 100);
    return { kind: "intra", cgst: half, sgst: half, igst: 0, totalTax: round2(half * 2) };
  }

  const igst = round2((base * rate) / 100);
  return { kind: "inter", cgst: 0, sgst: 0, igst, totalTax: igst };
}

/** Invoice total, with the round-off the printed document shows separately. */
export function roundOffTotal(grossValue: number): {
  rounded: number;
  roundOff: number;
} {
  const rounded = Math.round(grossValue || 0);
  return { rounded, roundOff: round2(rounded - (grossValue || 0)) };
}

/** How a counterparty is registered — drives whether an IRN is required. */
export const GST_REGISTRATION_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "composition", label: "Composition" },
  { value: "unregistered", label: "Unregistered (URD)" },
  { value: "consumer", label: "Consumer" },
] as const;

export type GstRegistrationType =
  (typeof GST_REGISTRATION_TYPES)[number]["value"];

/**
 * The registration a counterparty actually has, given its GSTIN.
 *
 * The GSTIN decides: without one, a party is an unregistered dealer (URD) —
 * the customer's books label every no-GSTIN party that way — even though the
 * master defaults to "regular". Left as stored, a URD party carried "regular"
 * onto its invoice, which then failed validation for want of a GSTIN.
 * "consumer" (an end buyer, also without a GSTIN) is kept. With a GSTIN,
 * "unregistered" / "consumer" cannot be right, so it becomes "regular";
 * "composition" is kept.
 */
export function effectiveRegistrationType(
  gstin: string,
  registrationType: string,
): GstRegistrationType {
  if (!gstin.trim()) {
    return registrationType === "consumer" ? "consumer" : "unregistered";
  }
  return registrationType === "composition" ? "composition" : "regular";
}
