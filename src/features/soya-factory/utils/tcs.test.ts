import { describe, expect, it } from "vitest";

import { computeThresholdTcs, TCS_THRESHOLD } from "./tcs";

describe("computeThresholdTcs", () => {
  it("is zero while the year stays under Rs 50 lakh", () => {
    expect(computeThresholdTcs(2_000_000, 1_000_000)).toBe(0);
    expect(computeThresholdTcs(4_000_000, 1_000_000)).toBe(0);
  });

  it("charges only the part of the crossing bill above Rs 50 lakh", () => {
    expect(computeThresholdTcs(4_500_000, 1_000_000)).toBe(500);
  });

  it("charges the whole bill once the year is past Rs 50 lakh", () => {
    expect(computeThresholdTcs(6_000_000, 1_000_000)).toBe(1000);
    expect(computeThresholdTcs(TCS_THRESHOLD, 2_144_216)).toBe(2144.22);
  });

  it("treats a first bill above Rs 50 lakh like any crossing bill", () => {
    expect(computeThresholdTcs(0, 6_000_000)).toBe(1000);
  });

  it("ignores negative inputs", () => {
    expect(computeThresholdTcs(-100, -5)).toBe(0);
  });
});
