/**
 * Invoice arithmetic. Pure — no I/O, no database, no React.
 *
 * Two consumers with different demands have to agree here:
 *
 *   - the PRINTED invoice, which must match what Tally already produces for the
 *     same figures, down to the paisa;
 *   - the e-INVOICE PAYLOAD, where the portal re-adds the line-level tax
 *     amounts and rejects the document if they do not reconcile with the
 *     document-level totals.
 *
 * Those pull in opposite directions. Tally computes each tax head on the TOTAL
 * taxable value of a rate bucket, so a 5% bucket is taxed once, not once per
 * line. Computing each line independently and summing gives a different figure
 * whenever two lines each round up. The portal, meanwhile, wants per-line
 * amounts that add up to the document total.
 *
 * So: compute the bucket total the way Tally does — that is the authoritative
 * figure — then distribute it across the lines and hand the rounding remainder
 * to the largest line. Line amounts are then per-line plausible AND sum exactly
 * to the document total, by construction rather than by luck.
 */

import { computeTaxSplit, roundOffTotal, type TaxKind } from "@/features/soya/lib/gst";

export function round2(value: number): number {
  return Number((value || 0).toFixed(2));
}

/** Quantities carry three decimals — 30.430 MTS on the 12-Sep-2026 voucher. */
export function round3(value: number): number {
  return Number((value || 0).toFixed(3));
}

export interface InvoiceLineInput {
  quantity: number;
  rate: number;
  discount?: number;
  /** Whole percent on the item master, e.g. 5. */
  gst_rate: number;
}

export interface InvoiceLineTotals {
  /** quantity x rate, before discount. */
  amount: number;
  discount: number;
  /** amount - discount. What tax is charged on. */
  taxable_value: number;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  /** taxable_value + every tax head on this line. */
  total_value: number;
}

export interface InvoiceTotals {
  kind: TaxKind;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  cess: number;
  other_charges: number;
  /** The difference between the gross and the whole rupee, as printed. */
  round_off: number;
  /** The whole-rupee figure the customer pays. */
  total_value: number;
  lines: InvoiceLineTotals[];
}

/** quantity x rate, less discount. Tax is not applied here. */
export function lineTaxableValue(line: InvoiceLineInput): number {
  const amount = round2((line.quantity || 0) * (line.rate || 0));
  const discount = round2(line.discount || 0);
  return round2(amount - discount);
}

/**
 * Spreads a bucket's tax across its lines in proportion to taxable value, with
 * the remainder going to the largest line.
 *
 * Proportional-then-largest-remainder rather than simply rounding each line:
 * rounding each line independently can drift from the bucket total by a paisa
 * per line, and the portal compares the two. Giving the remainder to the
 * largest line keeps the error relatively smallest where it lands.
 */
function distribute(total: number, weights: number[]): number[] {
  const sum = weights.reduce((running, weight) => running + weight, 0);
  if (weights.length === 0) return [];
  if (sum <= 0 || total === 0) return weights.map(() => 0);

  const shares = weights.map((weight) => round2((total * weight) / sum));
  const allocated = shares.reduce((running, share) => running + share, 0);
  const remainder = round2(total - allocated);

  if (remainder !== 0) {
    let largest = 0;
    for (let i = 1; i < weights.length; i += 1) {
      if (weights[i] > weights[largest]) largest = i;
    }
    shares[largest] = round2(shares[largest] + remainder);
  }
  return shares;
}

/**
 * The whole invoice, from its lines.
 *
 * `otherCharges` is added after tax — freight billed separately, and the like.
 * It is deliberately not taxed here: charging GST on it correctly depends on
 * whether it forms part of the composite supply, which is a judgement the user
 * makes by putting it on a line instead when it does.
 */
export function computeInvoice(
  lines: InvoiceLineInput[],
  supplierStateCode: string,
  placeOfSupplyStateCode: string,
  otherCharges = 0,
): InvoiceTotals {
  const taxables = lines.map(lineTaxableValue);

  // Group line indices by GST rate. Tally taxes the bucket, not the line.
  const buckets = new Map<number, number[]>();
  lines.forEach((line, index) => {
    const rate = line.gst_rate || 0;
    const existing = buckets.get(rate);
    if (existing) existing.push(index);
    else buckets.set(rate, [index]);
  });

  const cgstByLine = new Array<number>(lines.length).fill(0);
  const sgstByLine = new Array<number>(lines.length).fill(0);
  const igstByLine = new Array<number>(lines.length).fill(0);

  let kind: TaxKind = "inter";
  let cgstTotal = 0;
  let sgstTotal = 0;
  let igstTotal = 0;

  for (const [rate, indices] of buckets) {
    const bucketTaxable = round2(
      indices.reduce((running, index) => running + taxables[index], 0),
    );
    const split = computeTaxSplit(
      bucketTaxable,
      rate,
      supplierStateCode,
      placeOfSupplyStateCode,
    );
    kind = split.kind;

    const weights = indices.map((index) => taxables[index]);
    const cgstShares = distribute(split.cgst, weights);
    const sgstShares = distribute(split.sgst, weights);
    const igstShares = distribute(split.igst, weights);

    indices.forEach((index, position) => {
      cgstByLine[index] = cgstShares[position];
      sgstByLine[index] = sgstShares[position];
      igstByLine[index] = igstShares[position];
    });

    cgstTotal = round2(cgstTotal + split.cgst);
    sgstTotal = round2(sgstTotal + split.sgst);
    igstTotal = round2(igstTotal + split.igst);
  }

  const lineTotals: InvoiceLineTotals[] = lines.map((line, index) => {
    const amount = round2((line.quantity || 0) * (line.rate || 0));
    const discount = round2(line.discount || 0);
    return {
      amount,
      discount,
      taxable_value: taxables[index],
      gst_rate: line.gst_rate || 0,
      cgst: cgstByLine[index],
      sgst: sgstByLine[index],
      igst: igstByLine[index],
      cess: 0,
      total_value: round2(
        taxables[index] + cgstByLine[index] + sgstByLine[index] + igstByLine[index],
      ),
    };
  });

  const taxableTotal = round2(
    taxables.reduce((running, value) => running + value, 0),
  );
  const charges = round2(otherCharges || 0);
  const gross = round2(taxableTotal + cgstTotal + sgstTotal + igstTotal + charges);
  const { rounded, roundOff } = roundOffTotal(gross);

  return {
    kind,
    taxable_value: taxableTotal,
    cgst: cgstTotal,
    sgst: sgstTotal,
    igst: igstTotal,
    cess: 0,
    other_charges: charges,
    round_off: roundOff,
    total_value: rounded,
    lines: lineTotals,
  };
}

/**
 * The financial year an invoice belongs to, as its starting calendar year.
 * April-to-March, so 12-Sep-2026 is FY 2026-27 and returns 2026.
 *
 * Duplicated from the maize helper deliberately: this one takes a plain ISO
 * date string and must never change behaviour because the maize FY logic did.
 */
export function invoiceFyStartYear(isoDate: string): number {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Not a date: ${isoDate}`);
  }
  const year = date.getFullYear();
  return date.getMonth() < 3 ? year - 1 : year;
}

/** "2026-27", for display and for the invoice number. */
export function formatFyLabel(fyStartYear: number): string {
  return `${fyStartYear}-${String((fyStartYear + 1) % 100).padStart(2, "0")}`;
}

/**
 * The next number in a company's series: PREFIX/2026-27/0001.
 *
 * Callers pass the numbers already used in that company's year. The series has
 * to be unbroken for GST, so this is max+1 over what exists rather than a
 * database sequence, which would leave a gap on any rolled-back insert.
 */
export function nextInvoiceNumber(
  prefix: string,
  fyStartYear: number,
  existingNumbers: string[],
): string {
  const fy = formatFyLabel(fyStartYear);
  const cleanPrefix = (prefix || "").trim().toUpperCase().replace(/\/+$/, "");
  const head = cleanPrefix ? `${cleanPrefix}/${fy}/` : `${fy}/`;

  let highest = 0;
  for (const existing of existingNumbers) {
    // Only the trailing number matters; a hand-typed number that does not fit
    // the pattern is ignored rather than parsed loosely into a wrong maximum.
    const match = /(\d+)\s*$/.exec(existing || "");
    if (!match) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > highest) highest = value;
  }
  return `${head}${String(highest + 1).padStart(4, "0")}`;
}
