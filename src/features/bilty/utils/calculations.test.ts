import { describe, expect, it } from "vitest";

import { calculateBilty } from "@/features/bilty/utils/calculations";

describe("calculateBilty", () => {
  it("derives weights and totals from the bilty input", () => {
    const bilty = calculateBilty(
      {
        bill_no: 12,
        date: "2026-04-10",
        party: "Test Party",
        bags: 25,
        weight: 2500,
        less_percent: 3,
        rate: 21,
        add_amount: 75,
        cash_paid: 100,
        upi_paid: 50,
        payment_date: null,
        source: "app",
        payment_through: "none",
      },
      "bilty-1"
    );

    expect(bilty.less_weight).toBe(75);
    expect(bilty.net_weight).toBe(2425);
    expect(bilty.amount).toBe(509.25);
    expect(bilty.final_total).toBe(434.25);
    expect(bilty.bag_avg).toBe(97);
  });
});
