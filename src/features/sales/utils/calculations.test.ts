import { describe, expect, it } from "vitest";

import { calculateSale } from "@/features/sales/utils/calculations";

describe("calculateSale", () => {
  it("computes derived totals from rate, flight, and factory rate", () => {
    const sale = calculateSale(
      {
        bill_number: "B-100",
        sale_date: "2026-03-12",
        lorry_number: "KA-01-AB-1234",
        party: "Test Buyer",
        sale_company_id: "buyer-1",
        payment_terms: "Cash",
        bags: 54,
        net_weight: 5400,
        factory_weight: 5300,
        rate: 20,
        flight: 100,
        factory_rate: 18,
        source: "manual",
      },
      "sale-1"
    );

    expect(sale.amount).toBe(107900);
    expect(sale.factory_amount).toBe(97200);
    expect(sale.pending_amount).toBe(10700);
    expect(sale.bag_avg).toBe(100);
  });

  it("uses provided bag average instead of derived value", () => {
    const sale = calculateSale(
      {
        bill_number: "B-101",
        sale_date: "2026-03-12",
        lorry_number: "",
        party: "Test Buyer",
        sale_company_id: null,
        payment_terms: "7 days",
        bags: 10,
        net_weight: 95,
        factory_weight: 95,
        rate: 19.5,
        flight: 0,
        bag_avg: 9.75,
        factory_rate: 15.5,
        source: "manual",
      },
      "sale-2"
    );

    expect(sale.bag_avg).toBe(9.75);
    expect(sale.amount).toBe(1852.5);
    expect(sale.factory_amount).toBe(1472.5);
    expect(sale.pending_amount).toBe(380);
  });
});
