import { describe, expect, it } from "vitest";

import {
  effectivePending,
  filterSales,
  salesFilterFromParams,
  salesFilterToParams,
  summariseSales,
  type SalesFilter,
} from "@/features/sales/lib/sales-filter";
import type { Sale } from "@/features/sales/schemas";

const sale = (overrides: Partial<Sale> & { id: string }): Sale =>
  ({
    sl_no: null,
    bill_number: "1",
    sale_date: "2026-05-10",
    issuer_company_id: "issuer-a",
    dispatch_through: "TRUCK",
    lorry_number: "KA-01-AB-1234",
    goods_name: "MAIZE",
    destination: "",
    party: "Test Buyer",
    sale_company_id: "buyer-a",
    payment_terms: "30",
    bags: 100,
    net_weight: 5000,
    factory_weight: 4900,
    rate: 20,
    flight: 0,
    bag_avg: 50,
    factory_rate: 0,
    source: "manual",
    amount: 100000,
    factory_amount: 0,
    pending_amount: 100000,
    ...overrides,
  }) as Sale;

const ALL: SalesFilter = { range: { from: "", to: "" }, issuerId: "", buyerId: "" };

describe("filterSales", () => {
  const sales = [
    sale({ id: "a", sale_date: "2026-03-31" }),
    sale({ id: "b", sale_date: "2026-04-01" }),
    sale({ id: "c", sale_date: "2027-03-31", issuer_company_id: "issuer-b" }),
    sale({ id: "d", sale_date: "2027-04-01", sale_company_id: "buyer-b" }),
  ];

  it("includes both range bounds", () => {
    const result = filterSales(sales, {
      ...ALL,
      range: { from: "2026-04-01", to: "2027-03-31" },
    });
    expect(result.map((s) => s.id)).toEqual(["b", "c"]);
  });

  it("treats an empty bound as open-ended", () => {
    expect(
      filterSales(sales, { ...ALL, range: { from: "2027-01-01", to: "" } }).map(
        (s) => s.id,
      ),
    ).toEqual(["c", "d"]);
    expect(
      filterSales(sales, { ...ALL, range: { from: "", to: "2026-03-31" } }).map(
        (s) => s.id,
      ),
    ).toEqual(["a"]);
  });

  it("combines issuer and buyer filters with the range", () => {
    expect(
      filterSales(sales, { ...ALL, issuerId: "issuer-b" }).map((s) => s.id),
    ).toEqual(["c"]);
    expect(
      filterSales(sales, { ...ALL, buyerId: "buyer-b" }).map((s) => s.id),
    ).toEqual(["d"]);
    expect(
      filterSales(sales, {
        range: { from: "2026-04-01", to: "2027-03-31" },
        issuerId: "issuer-b",
        buyerId: "buyer-a",
      }).map((s) => s.id),
    ).toEqual(["c"]);
  });
});

describe("summariseSales", () => {
  const sales = [
    sale({ id: "a", amount: 100000, pending_amount: 100000, bags: 100, net_weight: 5000, factory_weight: 4900 }),
    sale({ id: "b", amount: 50000, pending_amount: 50000, bags: 40, net_weight: 2000, factory_weight: 1950 }),
  ];

  it("sums the quantity and money columns", () => {
    const totals = summariseSales(sales, {});
    expect(totals).toEqual({
      count: 2,
      bags: 140,
      netWeight: 7000,
      factoryWeight: 6850,
      amount: 150000,
      pending: 150000,
      received: 0,
    });
  });

  it("prefers the FIFO-effective pending over the stored column", () => {
    const totals = summariseSales(sales, { a: 25000, b: 0 });
    expect(totals.pending).toBe(25000);
    expect(totals.received).toBe(125000);
  });

  it("clamps an over-payment so one bill cannot credit another", () => {
    // A negative entry would otherwise inflate Received beyond what was billed.
    const totals = summariseSales(sales, { a: -10000, b: 50000 });
    expect(totals.pending).toBe(50000);
    expect(effectivePending(sales[0], { a: -10000 })).toBe(0);
  });
});

describe("filter params round-trip", () => {
  it("omits anything left at its default", () => {
    expect(salesFilterToParams(ALL).toString()).toBe("");
    expect(
      salesFilterToParams({
        range: { from: "2026-04-01", to: "2027-03-31" },
        issuerId: "issuer-a",
        buyerId: "",
      }).toString(),
    ).toBe("from=2026-04-01&to=2027-03-31&issuer=issuer-a");
  });

  it("parses back to the same filter", () => {
    const filter: SalesFilter = {
      range: { from: "2026-04-01", to: "2027-03-31" },
      issuerId: "issuer-a",
      buyerId: "buyer-b",
    };
    const params = salesFilterToParams(filter);
    expect(
      salesFilterFromParams({
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
        issuer: params.get("issuer") ?? undefined,
        buyer: params.get("buyer") ?? undefined,
      }),
    ).toEqual(filter);
  });

  it("rejects dates that are well-formed but impossible", () => {
    // "2026-13-99" matches the yyyy-MM-dd shape but would print as 99-13-2026.
    expect(
      salesFilterFromParams({ from: "2026-13-99", to: "2026-02-30" }).range,
    ).toEqual({ from: "", to: "" });
    expect(salesFilterFromParams({ from: "garbage" }).range.from).toBe("");
    expect(salesFilterFromParams({}).range).toEqual({ from: "", to: "" });
  });

  it("keeps a real leap day", () => {
    expect(salesFilterFromParams({ from: "2028-02-29" }).range.from).toBe(
      "2028-02-29",
    );
  });
});
