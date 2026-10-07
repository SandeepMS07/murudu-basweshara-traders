import { describe, expect, it } from "vitest";

import {
  computeOpenBalances,
  computeOpenBills,
  type OpenBalanceBill,
} from "@/features/soya/lib/open-balances";

const bill = (owner: string, date: string, total: number, sl_no = 1): OpenBalanceBill => ({
  owner,
  date,
  sl_no,
  total,
});

const masters = [
  { id: "a", name: "ANNAM" },
  { id: "b", name: "Betul Oil" },
];

describe("computeOpenBalances", () => {
  it("clears the oldest bills first and counts only the open ones", () => {
    const rows = computeOpenBalances(
      masters,
      [bill("ANNAM", "2026-06-01", 300), bill("ANNAM", "2026-04-01", 100), bill("ANNAM", "2026-05-01", 200)],
      [{ ownerId: "a", amount: 150 }],
    );

    // 150 clears the April bill (100) and half of May → May and June open.
    expect(rows).toEqual([
      { id: "a", name: "ANNAM", pending: 450, pendingBillCount: 2, oldestOpenDate: "2026-05-01" },
    ]);
  });

  it("breaks same-day ties on SL NO", () => {
    const rows = computeOpenBalances(
      masters,
      [bill("ANNAM", "2026-04-01", 100, 2), bill("ANNAM", "2026-04-01", 100, 1)],
      [{ ownerId: "a", amount: 100 }],
    );
    expect(rows[0]).toMatchObject({ pending: 100, pendingBillCount: 1 });
  });

  it("includes bills from earlier financial years", () => {
    const rows = computeOpenBalances(masters, [bill("ANNAM", "2025-11-10", 1000)], []);
    expect(rows[0]).toMatchObject({ pending: 1000, oldestOpenDate: "2025-11-10" });
  });

  it("matches bills to payments by name, ignoring case and spacing", () => {
    const rows = computeOpenBalances(
      masters,
      [bill("  betul   oil ", "2026-04-01", 500)],
      [{ ownerId: "b", amount: 500 }],
    );
    expect(rows).toEqual([]);
  });

  it("drops fully paid and overpaid counterparties, and ignores sub-rupee rounding", () => {
    const rows = computeOpenBalances(
      masters,
      [bill("ANNAM", "2026-04-01", 1728556.515), bill("Betul Oil", "2026-04-01", 100)],
      [
        { ownerId: "a", amount: 1728556.2 },
        { ownerId: "b", amount: 250 },
      ],
    );
    expect(rows).toEqual([]);
  });

  it("keeps a counterparty that has bills but no master record", () => {
    const rows = computeOpenBalances(masters, [bill("SRI GURU", "2026-04-01", 70)], []);
    expect(rows).toEqual([
      { id: null, name: "SRI GURU", pending: 70, pendingBillCount: 1, oldestOpenDate: "2026-04-01" },
    ]);
  });

  it("sorts the largest pending first", () => {
    const rows = computeOpenBalances(
      masters,
      [bill("ANNAM", "2026-04-01", 10), bill("Betul Oil", "2026-04-01", 90)],
      [],
    );
    expect(rows.map((row) => row.name)).toEqual(["Betul Oil", "ANNAM"]);
  });
});

describe("computeOpenBills", () => {
  const masters = [{ id: "p1", name: "ANNAM" }];
  const bills = [
    { id: "b2", owner: "ANNAM", date: "2026-09-10", sl_no: 2, total: 1000 },
    { id: "b1", owner: "annam ", date: "2026-09-01", sl_no: 1, total: 1000 },
    { id: "b3", owner: "ANNAM", date: "2026-09-20", sl_no: 3, total: 1000 },
  ];

  it("clears the oldest bill first and leaves the rest open", () => {
    const open = computeOpenBills(masters, bills, [{ ownerId: "p1", amount: 1500 }]);
    expect(open.get("b1")).toBe(0);
    expect(open.get("b2")).toBe(500);
    expect(open.get("b3")).toBe(1000);
  });

  it("treats sub-rupee leftovers as paid", () => {
    const open = computeOpenBills(masters, bills, [{ ownerId: "p1", amount: 2999.7 }]);
    expect(open.get("b3")).toBe(0);
  });

  it("leaves every bill open without payments", () => {
    const open = computeOpenBills(masters, bills, []);
    expect([...open.values()]).toEqual([1000, 1000, 1000]);
  });
});
