import { describe, expect, it } from "vitest";

import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

describe("number-format helpers", () => {
  it("formats value in Indian digit grouping", () => {
    expect(
      formatNumberIN(104220, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    ).toBe("1,04,220");
  });

  it("clamps fraction digits and avoids range errors", () => {
    expect(() =>
      formatNumberIN(1234.56789, {
        minimumFractionDigits: 25,
        maximumFractionDigits: 30,
      })
    ).not.toThrow();
  });

  it("prefixes rupee symbol for currency", () => {
    expect(
      formatCurrencyINR(12881.6, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    ).toBe("₹12,881.60");
  });
});
