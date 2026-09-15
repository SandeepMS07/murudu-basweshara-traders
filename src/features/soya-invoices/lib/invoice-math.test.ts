import { describe, expect, it } from "vitest";

import {
  computeInvoice,
  formatFyLabel,
  invoiceFyStartYear,
  lineTaxableValue,
  nextInvoiceNumber,
} from "@/features/soya-invoices/lib/invoice-math";

describe("computeInvoice", () => {
  // Sales voucher 72, 12-Sep-2026, from the customer's own Tally:
  // SOYA MEAL, 620 bags, 30.430 MTS @ 54,190.00 = 16,49,001.70
  // CGST 41,225.04 + SGST 41,225.04, round off 0.22, total 17,31,452.
  const voucher72 = {
    quantity: 30.43,
    rate: 54190,
    gst_rate: 5,
  };

  it("reproduces voucher 72 exactly", () => {
    const totals = computeInvoice([voucher72], "29", "29");
    expect(totals.kind).toBe("intra");
    expect(totals.taxable_value).toBe(1649001.7);
    expect(totals.cgst).toBe(41225.04);
    expect(totals.sgst).toBe(41225.04);
    expect(totals.igst).toBe(0);
    expect(totals.round_off).toBe(0.22);
    expect(totals.total_value).toBe(1731452);
  });

  it("reproduces the earlier 13,47,625 voucher", () => {
    // 5% intra on 13,47,625 collects one paisa more than the same value
    // inter-state, because two halves each round up. Their books show this as
    // round-off (-)0.26 against (-)0.25.
    const line = { quantity: 1, rate: 1347625, gst_rate: 5 };
    const intra = computeInvoice([line], "29", "29");
    expect(intra.cgst).toBe(33690.63);
    expect(intra.sgst).toBe(33690.63);
    expect(intra.round_off).toBe(-0.26);
    expect(intra.total_value).toBe(1415006);

    const inter = computeInvoice([line], "29", "23");
    expect(inter.kind).toBe("inter");
    expect(inter.igst).toBe(67381.25);
    expect(inter.cgst).toBe(0);
    expect(inter.round_off).toBe(-0.25);
    expect(inter.total_value).toBe(1415006);
  });

  it("books a drop-ship by the two registrations, not by where goods ship from", () => {
    // Voucher 72's goods leave Latur, Maharashtra. Both GSTINs are Karnataka,
    // so it is still a local sale. Dispatch-from is not an argument here, and
    // this test is what keeps it from becoming one.
    expect(computeInvoice([voucher72], "29", "29").kind).toBe("intra");
  });

  describe("multi-line rounding", () => {
    // Three lines that each individually round up. Summing per-line tax would
    // exceed the tax on the bucket total by a paisa or two — the portal
    // compares the two and rejects the document on the difference.
    const lines = [
      { quantity: 1, rate: 100.05, gst_rate: 5 },
      { quantity: 1, rate: 100.05, gst_rate: 5 },
      { quantity: 1, rate: 100.05, gst_rate: 5 },
    ];

    it("taxes the rate bucket, not each line", () => {
      const totals = computeInvoice(lines, "29", "29");
      // 300.15 taxable; 2.5% is 7.50375 -> 7.50 each head.
      expect(totals.taxable_value).toBe(300.15);
      expect(totals.cgst).toBe(7.5);
      expect(totals.sgst).toBe(7.5);
    });

    it("line taxes sum exactly to the document tax", () => {
      const totals = computeInvoice(lines, "29", "29");
      const summed = (key: "cgst" | "sgst" | "igst") =>
        Number(
          totals.lines
            .reduce((running, line) => running + line[key], 0)
            .toFixed(2),
        );
      expect(summed("cgst")).toBe(totals.cgst);
      expect(summed("sgst")).toBe(totals.sgst);
      expect(summed("igst")).toBe(totals.igst);
    });

    it("gives the rounding remainder to the largest line", () => {
      const uneven = computeInvoice(
        [
          { quantity: 1, rate: 10, gst_rate: 5 },
          { quantity: 1, rate: 1000, gst_rate: 5 },
        ],
        "29",
        "23",
      );
      const summed = Number(
        uneven.lines.reduce((running, line) => running + line.igst, 0).toFixed(2),
      );
      expect(summed).toBe(uneven.igst);
      // The bigger line carries the bigger share, remainder included.
      expect(uneven.lines[1].igst).toBeGreaterThan(uneven.lines[0].igst);
    });
  });

  it("handles two different GST rates on one invoice", () => {
    const totals = computeInvoice(
      [
        { quantity: 1, rate: 1000, gst_rate: 5 },
        { quantity: 1, rate: 1000, gst_rate: 18 },
      ],
      "29",
      "29",
    );
    expect(totals.taxable_value).toBe(2000);
    // 2.5% of 1000 plus 9% of 1000.
    expect(totals.cgst).toBe(115);
    expect(totals.sgst).toBe(115);
    expect(totals.lines[0].cgst).toBe(25);
    expect(totals.lines[1].cgst).toBe(90);
  });

  it("subtracts a line discount before taxing", () => {
    const totals = computeInvoice(
      [{ quantity: 10, rate: 100, discount: 50, gst_rate: 5 }],
      "29",
      "29",
    );
    expect(totals.taxable_value).toBe(950);
    expect(totals.cgst).toBe(23.75);
  });

  it("adds other charges after tax, untaxed", () => {
    const totals = computeInvoice([{ quantity: 1, rate: 1000, gst_rate: 5 }], "29", "29", 100);
    expect(totals.taxable_value).toBe(1000);
    expect(totals.cgst).toBe(25);
    expect(totals.other_charges).toBe(100);
    expect(totals.total_value).toBe(1150);
  });

  it("treats an unknown place of supply as inter-state", () => {
    expect(computeInvoice([voucher72], "29", "").kind).toBe("inter");
  });

  it("returns zeroes for an invoice with no lines", () => {
    const totals = computeInvoice([], "29", "29");
    expect(totals.taxable_value).toBe(0);
    expect(totals.total_value).toBe(0);
    expect(totals.lines).toEqual([]);
  });

  it("handles a zero-rated line without dividing by zero", () => {
    const totals = computeInvoice([{ quantity: 1, rate: 1000, gst_rate: 0 }], "29", "29");
    expect(totals.cgst).toBe(0);
    expect(totals.total_value).toBe(1000);
  });
});

describe("lineTaxableValue", () => {
  it("multiplies quantity by rate to the paisa", () => {
    expect(lineTaxableValue({ quantity: 30.43, rate: 54190, gst_rate: 5 })).toBe(1649001.7);
  });
});

describe("invoiceFyStartYear", () => {
  it("puts September in the year that started that April", () => {
    expect(invoiceFyStartYear("2026-09-12")).toBe(2026);
  });

  it("puts March in the previous year", () => {
    expect(invoiceFyStartYear("2026-03-31")).toBe(2025);
    expect(invoiceFyStartYear("2026-04-01")).toBe(2026);
  });

  it("throws rather than guessing on a bad date", () => {
    expect(() => invoiceFyStartYear("not-a-date")).toThrow();
  });

  it("labels the year the way the invoice prints it", () => {
    expect(formatFyLabel(2026)).toBe("2026-27");
    expect(formatFyLabel(2099)).toBe("2099-00");
  });
});

describe("nextInvoiceNumber", () => {
  it("starts a company's year at 0001", () => {
    expect(nextInvoiceNumber("SGT", 2026, [])).toBe("SGT/2026-27/0001");
  });

  it("continues from the highest number used", () => {
    const used = ["SGT/2026-27/0001", "SGT/2026-27/0002", "SGT/2026-27/0003"];
    expect(nextInvoiceNumber("SGT", 2026, used)).toBe("SGT/2026-27/0004");
  });

  it("continues from the highest, not the most recent", () => {
    // A deleted middle invoice must not cause a number to be reissued.
    const used = ["SGT/2026-27/0001", "SGT/2026-27/0009", "SGT/2026-27/0003"];
    expect(nextInvoiceNumber("SGT", 2026, used)).toBe("SGT/2026-27/0010");
  });

  it("ignores a hand-typed number that does not fit the pattern", () => {
    expect(nextInvoiceNumber("SGT", 2026, ["opening balance"])).toBe("SGT/2026-27/0001");
  });

  it("works without a prefix", () => {
    expect(nextInvoiceNumber("", 2026, [])).toBe("2026-27/0001");
  });

  it("uppercases the prefix and drops a trailing slash", () => {
    expect(nextInvoiceNumber("sgt/", 2026, [])).toBe("SGT/2026-27/0001");
  });
});
