import { describe, expect, it } from "vitest";

import type { CompanyPayment } from "@/features/companies/schemas";
import type { Sale } from "@/features/sales/schemas";

import { sliceStatementPeriod } from "./statement-period";

const sale = (id: string, sale_date: string, pending_amount: number) =>
  ({ id, sale_date, pending_amount }) as Sale;
const payment = (id: string, paid_on: string) =>
  ({ id, paid_on }) as CompanyPayment;

const sales = [
  sale("old-unpaid", "2026-03-10", 500),
  sale("old-paid", "2026-03-20", 0),
  sale("in", "2026-04-05", 200),
  sale("after", "2026-05-01", 900),
];
const payments = [payment("p1", "2026-03-31"), payment("p2", "2026-04-10")];

describe("sliceStatementPeriod", () => {
  it("returns everything untouched for all time", () => {
    const result = sliceStatementPeriod(sales, payments, {}, { from: "", to: "" });
    expect(result.sales).toBe(sales);
    expect(result.payments).toBe(payments);
    expect(result.earlierOutstanding).toBeNull();
  });

  it("keeps rows inside the inclusive range", () => {
    const result = sliceStatementPeriod(sales, payments, {}, {
      from: "2026-04-01",
      to: "2026-04-30",
    });
    expect(result.sales.map((s) => s.id)).toEqual(["in"]);
    expect(result.payments.map((p) => p.id)).toEqual(["p2"]);
  });

  it("sums only unpaid bills before the start date", () => {
    const result = sliceStatementPeriod(sales, payments, {}, {
      from: "2026-04-01",
      to: "2026-04-30",
    });
    expect(result.earlierOutstanding).toEqual({ amount: 500, count: 1 });
  });

  it("prefers FIFO pending over the stored pending amount", () => {
    const result = sliceStatementPeriod(
      sales,
      payments,
      { "old-unpaid": 0, "old-paid": 75 },
      { from: "2026-04-01", to: "" },
    );
    expect(result.earlierOutstanding).toEqual({ amount: 75, count: 1 });
  });

  it("has no earlier figure when only an end date is set", () => {
    const result = sliceStatementPeriod(sales, payments, {}, {
      from: "",
      to: "2026-03-31",
    });
    expect(result.sales.map((s) => s.id)).toEqual(["old-unpaid", "old-paid"]);
    expect(result.earlierOutstanding).toBeNull();
  });
});
