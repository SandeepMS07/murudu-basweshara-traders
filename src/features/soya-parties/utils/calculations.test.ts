import { describe, expect, it } from "vitest";

import { calculateSoyaPartyEntry } from "@/features/soya-parties/utils/calculations";

const base = {
  sl_no: 3,
  date: "2026-04-03",
  bill_no: "3",
  lorry_no: "KA-28-AA-1747",
  bags: 718,
  tcs: 0,
  freight: 260,
  fright: 90480,
  party: "ANNAM",
  factory: "ADM",
};

describe("calculateSoyaPartyEntry", () => {
  // Numbers taken from row 10 of the SALES sheet in the customer's workbook —
  // the case that pins the unrounded 4-decimal tax components.
  it("matches the workbook for the ANNAM 03*04*2026 row", () => {
    const entry = calculateSoyaPartyEntry(
      { ...base, net_wt: 34850, rate: 47.238 },
      "p1",
    );

    expect(entry.amount).toBe(1646244.3);
    expect(entry.cgst).toBe(41156.1075);
    expect(entry.sgst).toBe(41156.1075);
    expect(entry.total_amount).toBe(1728556.515);
  });

  // Row 11 — OM SHAKTHI, a whole-number rate.
  it("matches the workbook for the OM SHAKTHI 07*04*2026 row", () => {
    const entry = calculateSoyaPartyEntry(
      { ...base, party: "OM SHAKTHI", net_wt: 35940, rate: 42.5 },
      "p2",
    );

    expect(entry.amount).toBe(1527450);
    expect(entry.cgst).toBe(38186.25);
    expect(entry.sgst).toBe(38186.25);
    expect(entry.total_amount).toBe(1603822.5);
  });

  it("carries FREIGHT and FRIGHT without adding them to the invoice total", () => {
    const entry = calculateSoyaPartyEntry(
      { ...base, net_wt: 1000, rate: 10, freight: 270, fright: 5000 },
      "p3",
    );

    expect(entry.amount).toBe(10000);
    expect(entry.total_amount).toBe(10500);
    expect(entry.freight).toBe(270);
    expect(entry.fright).toBe(5000);
  });

  it("adds TCS into the invoice total", () => {
    const entry = calculateSoyaPartyEntry(
      { ...base, net_wt: 1000, rate: 10, tcs: 7.5 },
      "p4",
    );

    expect(entry.total_amount).toBe(10507.5);
  });
});
