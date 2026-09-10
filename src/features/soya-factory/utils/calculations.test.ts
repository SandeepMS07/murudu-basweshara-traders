import { describe, expect, it } from "vitest";

import { calculateSoyaFactoryEntry } from "@/features/soya-factory/utils/calculations";

const base = {
  sl_no: 3,
  factory: "ADM",
  date: "2026-04-03",
  pb_no: "MI/75",
  lorry: "KA-28-AA-1747",
  bags: 718,
  tcs: 0,
  party: "ANNAM",
};

describe("calculateSoyaFactoryEntry", () => {
  // Numbers taken from row 10 of the SALES sheet in the customer's workbook.
  it("matches the workbook for the ADM 03*04*2026 row", () => {
    const entry = calculateSoyaFactoryEntry(
      { ...base, weight: 34850, rate: 42.5 },
      "f1",
    );

    expect(entry.amount).toBe(1481125);
    expect(entry.gst_amount).toBe(74056.25);
    expect(entry.total_amount).toBe(1555181.25);
  });

  // Row 15 — GHOWATH, a different rate, and no bags recorded.
  it("matches the workbook for the GHOWATH 24*04*2026 row", () => {
    const entry = calculateSoyaFactoryEntry(
      { ...base, factory: "GHOWATH", bags: 0, weight: 30520, rate: 43.5 },
      "f2",
    );

    expect(entry.amount).toBe(1327620);
    expect(entry.gst_amount).toBe(66381);
    expect(entry.total_amount).toBe(1394001);
  });

  it("adds TCS into the invoice total", () => {
    const entry = calculateSoyaFactoryEntry(
      { ...base, weight: 1000, rate: 10, tcs: 25 },
      "f3",
    );

    expect(entry.amount).toBe(10000);
    expect(entry.gst_amount).toBe(500);
    expect(entry.total_amount).toBe(10525);
  });

  it("is zero-safe when weight and rate are not filled in yet", () => {
    const entry = calculateSoyaFactoryEntry(
      { ...base, bags: 0, weight: 0, rate: 0 },
      "f4",
    );

    expect(entry.amount).toBe(0);
    expect(entry.gst_amount).toBe(0);
    expect(entry.total_amount).toBe(0);
  });
});
