import { describe, expect, it } from "vitest";

import {
  filterRecords,
  ledgerFilterFromParams,
  ledgerFilterToParams,
  partyOptions,
  summariseRecords,
  type LedgerFilter,
  type LedgerRecord,
} from "@/features/purchases/lib/record-filter";

type Row = LedgerRecord & { name: string };

const row = (overrides: Partial<Row> & { id: string }): Row => ({
  bill_no: 1,
  date: "2026-05-10",
  name: "SANTHOSH POULTRY FARM",
  bags: 100,
  weight: 5100,
  less_weight: 100,
  net_weight: 5000,
  rate: 20,
  amount: 100000,
  add_amount: 0,
  cash_paid: 0,
  upi_paid: 0,
  final_total: 100000,
  payment_through: "none",
  ...overrides,
});

const nameOf = (r: Row) => r.name;
const ALL: LedgerFilter = { range: { from: "", to: "" }, party: "" };

describe("filterRecords", () => {
  const rows = [
    row({ id: "a", date: "2026-03-31" }),
    row({ id: "b", date: "2026-04-01" }),
    row({ id: "c", date: "2027-03-31", name: "B nd M FARM" }),
    row({ id: "d", date: "2027-04-01" }),
  ];

  it("includes both range bounds", () => {
    const result = filterRecords(
      rows,
      { ...ALL, range: { from: "2026-04-01", to: "2027-03-31" } },
      nameOf,
    );
    expect(result.map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("treats an empty bound as open-ended", () => {
    expect(
      filterRecords(rows, { ...ALL, range: { from: "2027-01-01", to: "" } }, nameOf).map(
        (r) => r.id,
      ),
    ).toEqual(["c", "d"]);
  });

  it("matches the party case-insensitively", () => {
    // These names are free text, not ids, so casing varies between entries.
    expect(
      filterRecords(rows, { ...ALL, party: "b nd m farm" }, nameOf).map((r) => r.id),
    ).toEqual(["c"]);
    expect(
      filterRecords(rows, { ...ALL, party: "  B ND M FARM " }, nameOf).map((r) => r.id),
    ).toEqual(["c"]);
  });

  it("combines the party and the range", () => {
    expect(
      filterRecords(
        rows,
        { range: { from: "2026-04-01", to: "2027-03-31" }, party: "B nd M FARM" },
        nameOf,
      ).map((r) => r.id),
    ).toEqual(["c"]);
  });
});

describe("summariseRecords", () => {
  it("sums every column and weights the average rate", () => {
    const totals = summariseRecords([
      row({ id: "a", bags: 100, weight: 5100, less_weight: 100, net_weight: 5000, amount: 100000, add_amount: 500, final_total: 100500 }),
      row({ id: "b", bags: 40, weight: 2050, less_weight: 50, net_weight: 2000, amount: 50000, add_amount: 0, final_total: 50000 }),
    ]);
    expect(totals.count).toBe(2);
    expect(totals.bags).toBe(140);
    expect(totals.weight).toBe(7150);
    expect(totals.lessWeight).toBe(150);
    expect(totals.netWeight).toBe(7000);
    expect(totals.amount).toBe(150000);
    expect(totals.addAmount).toBe(500);
    expect(totals.total).toBe(150500);
    expect(totals.paid).toBe(0);
    // 150500 / 7000 — final_total over net weight, which is what the live
    // "Average Rate" card shows; weighted, not the mean of the row rates.
    expect(totals.averageRate).toBeCloseTo(21.5, 4);
  });

  it("sums cash and upi into one paid figure", () => {
    const totals = summariseRecords([
      row({ id: "a", cash_paid: 1000, upi_paid: 250 }),
      row({ id: "b", cash_paid: 0, upi_paid: 500 }),
    ]);
    expect(totals.cashPaid).toBe(1000);
    expect(totals.upiPaid).toBe(750);
    expect(totals.paid).toBe(1750);
  });

  it("reconciles total = amount - bag less + add - paid", () => {
    // The formula calculatePurchase uses; the statement prints each term.
    const amount = 100000, bagLess = 300, add = 500, cash = 2000, upi = 1000;
    const totals = summariseRecords([
      row({
        id: "a",
        amount,
        add_amount: add,
        cash_paid: cash,
        upi_paid: upi,
        final_total: amount - bagLess + add - cash - upi,
      }),
    ]);
    expect(totals.amount - bagLess + totals.addAmount - totals.paid).toBe(
      totals.total,
    );
  });

  it("does not divide by zero on an empty selection", () => {
    const totals = summariseRecords([]);
    expect(totals.count).toBe(0);
    expect(totals.averageRate).toBe(0);
  });
});

describe("partyOptions", () => {
  it("de-duplicates case-insensitively, keeping the first spelling", () => {
    const options = partyOptions(
      [
        row({ id: "a", name: "B nd M FARM" }),
        row({ id: "b", name: "b nd m farm" }),
        row({ id: "c", name: "ANNAM FARMS" }),
        row({ id: "d", name: "   " }),
      ],
      nameOf,
    );
    expect(options).toEqual(["ANNAM FARMS", "B nd M FARM"]);
  });
});

describe("filter params round-trip", () => {
  it("omits anything left at its default", () => {
    expect(ledgerFilterToParams(ALL).toString()).toBe("");
  });

  it("parses back to the same filter", () => {
    const filter: LedgerFilter = {
      range: { from: "2026-04-01", to: "2027-03-31" },
      party: "B nd M FARM",
    };
    const params = ledgerFilterToParams(filter);
    expect(
      ledgerFilterFromParams({
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
        party: params.get("party") ?? undefined,
      }),
    ).toEqual(filter);
  });

  it("rejects dates that are well-formed but impossible", () => {
    expect(
      ledgerFilterFromParams({ from: "2026-13-99", to: "2026-02-30" }).range,
    ).toEqual({ from: "", to: "" });
    expect(ledgerFilterFromParams({}).range).toEqual({ from: "", to: "" });
  });
});
