import { describe, expect, it } from "vitest";

import {
  effectiveRegistrationType,
  checkGstin,
  computeTaxSplit,
  roundOffTotal,
  stateCodeFromGstin,
  stateNameForCode,
} from "@/features/soya/lib/gst";

describe("checkGstin", () => {
  // Real GSTINs from the customer's own company and buyer records.
  const real = [
    ["29QWAPS4490E1ZU", "29", "Karnataka"],
    ["29AETPM9487N1Z0", "29", "Karnataka"],
    ["29AAWCA5892P1ZB", "29", "Karnataka"],
    ["29CVOPS8598C1ZJ", "29", "Karnataka"],
    ["37ABECS8196H1ZQ", "37", "Andhra Pradesh"],
    ["29ABBCS1449N1ZV", "29", "Karnataka"],
    ["29AKEPR0242H5Z3", "29", "Karnataka"],
  ] as const;

  it.each(real)("accepts %s and reads its state", (gstin, code, name) => {
    const result = checkGstin(gstin);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.stateCode).toBe(code);
    expect(result.stateName).toBe(name);
  });

  it("lowercase and padded input still validates", () => {
    expect(checkGstin("  29aawca5892p1zb  ").valid).toBe(true);
  });

  it("rejects a PAN in the GSTIN field", () => {
    // This is live data today: SANTHOSH POULTRY FARM's "GSTIN" is a PAN.
    const result = checkGstin("BVMPS6534F");
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toMatch(/PAN/);
  });

  it("rejects a single-character typo via the check digit", () => {
    // 29AAWCA5892P1ZB with the last character bumped.
    const result = checkGstin("29AAWCA5892P1ZC");
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toMatch(/[Cc]heck digit/);
  });

  it("rejects an impossible state code", () => {
    const result = checkGstin("99AAWCA5892P1ZB");
    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason).toMatch(/state code/);
  });

  it("rejects empty and malformed input without throwing", () => {
    expect(checkGstin("").valid).toBe(false);
    expect(checkGstin("not a gstin at all").valid).toBe(false);
    expect(checkGstin("291234567890123").valid).toBe(false);
  });

  it("stateCodeFromGstin returns empty rather than guessing", () => {
    expect(stateCodeFromGstin("29AAWCA5892P1ZB")).toBe("29");
    expect(stateCodeFromGstin("BVMPS6534F")).toBe("");
    expect(stateCodeFromGstin("")).toBe("");
  });

  it("names a state from its code", () => {
    expect(stateNameForCode("29")).toBe("Karnataka");
    expect(stateNameForCode("23")).toBe("Madhya Pradesh");
    expect(stateNameForCode("")).toBe("");
  });
});

describe("computeTaxSplit", () => {
  // The two vouchers from the customer's Tally recording, to the rupee.
  const TAXABLE = 1347625;
  const RATE = 5;

  it("splits intra-state supply in half — the ANNAM FARM voucher", () => {
    const split = computeTaxSplit(TAXABLE, RATE, "29", "29");
    expect(split.kind).toBe("intra");
    expect(split.cgst).toBe(33690.63);
    expect(split.sgst).toBe(33690.63);
    expect(split.igst).toBe(0);
  });

  it("charges the full rate as IGST inter-state — the BETUL OIL voucher", () => {
    const split = computeTaxSplit(TAXABLE, RATE, "29", "23");
    expect(split.kind).toBe("inter");
    expect(split.cgst).toBe(0);
    expect(split.sgst).toBe(0);
    expect(split.igst).toBe(67381.25);
  });

  it("differs by exactly one paisa between the two splits", () => {
    // 2.5% of 13,47,625 is 33,690.625, which rounds up twice to 67,381.26,
    // while a single 5% step gives 67,381.25. That one paisa is real and shows
    // up in the customer's own vouchers as a round-off of (-)0.26 intra-state
    // against (-)0.25 inter-state. Reproducing it keeps our invoice total
    // identical to what their books already say.
    const intra = computeTaxSplit(TAXABLE, RATE, "29", "29");
    const inter = computeTaxSplit(TAXABLE, RATE, "29", "23");
    expect(intra.totalTax).toBe(67381.26);
    expect(inter.totalTax).toBe(67381.25);
    expect(roundOffTotal(TAXABLE + intra.totalTax).roundOff).toBe(-0.26);
    expect(roundOffTotal(TAXABLE + inter.totalTax).roundOff).toBe(-0.25);
    // Both still land on the same rupee total the vouchers show.
    expect(roundOffTotal(TAXABLE + intra.totalTax).rounded).toBe(1415006);
    expect(roundOffTotal(TAXABLE + inter.totalTax).rounded).toBe(1415006);
  });

  it("reproduces Sales voucher 72 to the paisa", () => {
    // From the customer's 12-Sep-2026 recording: SOYA MEAL, 620 bags,
    // 30.430 MTS @ 54,190.00/MTS = 16,49,001.70. Sree Guru Trading (29) to
    // Annam Farm Pvt Ltd (29), so CGST + SGST at 2.5% each.
    //
    // Kept alongside the 13,47,625 voucher because this one rounds the other
    // way: two halves of 41,225.0425 round DOWN, where the other rounded up.
    const taxable = 1649001.7;
    const split = computeTaxSplit(taxable, RATE, "29", "29");
    expect(split.cgst).toBe(41225.04);
    expect(split.sgst).toBe(41225.04);

    const { rounded, roundOff } = roundOffTotal(taxable + split.totalTax);
    expect(rounded).toBe(1731452);
    expect(roundOff).toBe(0.22);
  });

  it("ignores where the goods ship from — voucher 72 is a drop-ship", () => {
    // The goods on voucher 72 leave the mill at Latur, Maharashtra (27) and go
    // straight to the buyer at Mangaluru. Tally still books it as a LOCAL
    // sale, because both registrations are Karnataka. Dispatch-from is an
    // e-way bill address, never an input to the tax split — so it is not a
    // parameter of this function, and this test exists to keep it that way.
    const shipsFromMaharashtra = computeTaxSplit(1649001.7, RATE, "29", "29");
    expect(shipsFromMaharashtra.kind).toBe("intra");
  });

  it("treats an unknown place of supply as inter-state, not intra", () => {
    // Intra is the split that hides the mistake, so it must not be the default.
    expect(computeTaxSplit(TAXABLE, RATE, "29", "").kind).toBe("inter");
    expect(computeTaxSplit(TAXABLE, RATE, "", "29").kind).toBe("inter");
  });

  it("handles a zero rate and a zero value", () => {
    expect(computeTaxSplit(TAXABLE, 0, "29", "29").totalTax).toBe(0);
    expect(computeTaxSplit(0, RATE, "29", "29").totalTax).toBe(0);
  });
});

describe("roundOffTotal", () => {
  it("matches the round-off on the intra-state voucher", () => {
    // 13,47,625 + 33,690.63 + 33,690.63 = 14,15,006.26 -> 14,15,006
    const { rounded, roundOff } = roundOffTotal(1415006.26);
    expect(rounded).toBe(1415006);
    expect(roundOff).toBe(-0.26);
  });

  it("matches the round-off on the inter-state voucher", () => {
    const { rounded, roundOff } = roundOffTotal(1415006.25);
    expect(rounded).toBe(1415006);
    expect(roundOff).toBe(-0.25);
  });

  it("rounds up and reports a positive round-off", () => {
    const { rounded, roundOff } = roundOffTotal(1415005.6);
    expect(rounded).toBe(1415006);
    expect(roundOff).toBe(0.4);
  });
});

describe("effectiveRegistrationType", () => {
  it("treats a party with no GSTIN as URD, even when stored as regular", () => {
    expect(effectiveRegistrationType("", "regular")).toBe("unregistered");
    expect(effectiveRegistrationType("  ", "composition")).toBe("unregistered");
    expect(effectiveRegistrationType("", "")).toBe("unregistered");
  });

  it("keeps a consumer without a GSTIN as a consumer", () => {
    expect(effectiveRegistrationType("", "consumer")).toBe("consumer");
  });

  it("treats a party with a GSTIN as registered", () => {
    expect(effectiveRegistrationType("29AAWCA5892P1ZB", "unregistered")).toBe("regular");
    expect(effectiveRegistrationType("29AAWCA5892P1ZB", "consumer")).toBe("regular");
    expect(effectiveRegistrationType("29AAWCA5892P1ZB", "regular")).toBe("regular");
    expect(effectiveRegistrationType("29AAWCA5892P1ZB", "composition")).toBe("composition");
  });
});
