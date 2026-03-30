import * as XLSX from "xlsx";

import { requireAuth } from "@/features/auth/lib/session";
import {
  appendSheetRow,
  deleteSheetRowById,
  openWorkbook,
  readSheetRows,
  updateSheetRowById,
} from "@/lib/excel";
import {
  GunnyBagPaymentInput,
  GunnyBagPurchaseInput,
} from "@/features/gunny-bags/schemas";

type SheetRow = Array<string | number | null>;

type PurchaseLayout = {
  kind: "purchase";
  slNoIndex: number;
  dateIndex: number;
  partyIndex: number;
  bagsIndex: number;
  rateIndex: number;
  amountIndex: number;
};

type PaymentLayout = {
  kind: "payment";
  slNoIndex: number;
  dateIndex: number;
  partyIndex: number;
  modeIndex: number;
  amountIndex: number;
};

type Layout = PurchaseLayout | PaymentLayout;

type AppGunnyPurchaseRow = {
  id: string;
  date: string;
  party: string;
  bags: number;
  rate: number;
  amount: number;
  source: "app";
  created_at: string;
};

type AppGunnyPaymentRow = {
  id: string;
  date: string;
  party: string;
  mode: string;
  amount: number;
  source: "app";
  created_at: string;
};

const APP_GUNNY_BAGS_PURCHASE_SHEET = "APP_GUNNY_BAGS_PURCHASE";
const APP_GUNNY_BAGS_PAYMENT_SHEET = "APP_GUNNY_BAGS_PAYMENT";

export type GunnyPurchaseRow = {
  id?: string;
  slNo: number | null;
  date: string;
  party: string;
  bags: number;
  rate: number;
  amount: number;
  source: "sheet" | "app";
};

export type GunnyPaymentRow = {
  id?: string;
  slNo: number | null;
  date: string;
  party: string;
  mode: string;
  amount: number;
  source: "sheet" | "app";
};

export type GunnyPurchaseOverviewRow = {
  party: string;
  totalBags: number;
  totalAmount: number;
  avgRate: number;
};

export type GunnyPartyLedgerRow = {
  party: string;
  totalBags: number;
  totalPurchase: number;
  totalPaid: number;
  balance: number;
};

export type GunnyBagsOverview = {
  purchases: GunnyPurchaseRow[];
  payments: GunnyPaymentRow[];
  purchaseOverview: GunnyPurchaseOverviewRow[];
  partyLedger: GunnyPartyLedgerRow[];
};

function normalizeHeaderCell(value: string | number | null): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizeParty(value: string | number | null): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function isValidPartyName(value: string): boolean {
  if (!value) return false;
  if (!/[A-Za-z]/.test(value)) return false;
  if (/^\d+[/-]\d+[/-]\d+$/.test(value)) return false;
  return true;
}

function toNumber(value: string | number | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const normalized = text.replace(/[,₹\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateText(value: string | number | null): string {
  if (value == null || value === "") return "";
  if (typeof value === "number") {
    // Ignore serial-like placeholders (e.g. 1/2/3) that map to 1900 dates.
    if (value < 1000) return "";
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return String(value);
    const dd = String(parsed.d).padStart(2, "0");
    const mm = String(parsed.m).padStart(2, "0");
    const yyyy = String(parsed.y);
    return `${dd}-${mm}-${yyyy}`;
  }

  const text = String(value).trim().replaceAll("*", "-");
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }
  return text;
}

function findIndex(row: SheetRow, target: string, from = 0): number {
  for (let index = from; index < row.length; index += 1) {
    if (normalizeHeaderCell(row[index]) === target) return index;
  }
  return -1;
}

function discoverLayouts(rows: SheetRow[]): Layout[] {
  const layouts = new Map<string, Layout>();

  for (const row of rows) {
    const partyAt = findIndex(row, "PARTY");
    if (partyAt >= 0) {
      const bagsAt = findIndex(row, "BAGS", partyAt + 1);
      const rateAt = findIndex(row, "RATE", partyAt + 1);
      const amountAt = findIndex(row, "AMOUNT", partyAt + 1);
      if (bagsAt >= 0 && rateAt >= 0 && amountAt >= 0) {
        const key = `purchase:${partyAt}:${bagsAt}:${rateAt}:${amountAt}`;
        layouts.set(key, {
          kind: "purchase",
          slNoIndex: Math.max(0, partyAt - 2),
          dateIndex: Math.max(0, partyAt - 1),
          partyIndex: partyAt,
          bagsIndex: bagsAt,
          rateIndex: rateAt,
          amountIndex: amountAt,
        });
      }

      const modeAt = findIndex(row, "MODE", partyAt + 1);
      const paymentAmountAt = findIndex(row, "AMOUNT", partyAt + 1);
      if (modeAt >= 0 && paymentAmountAt >= 0) {
        const key = `payment:${partyAt}:${modeAt}:${paymentAmountAt}`;
        layouts.set(key, {
          kind: "payment",
          slNoIndex: Math.max(0, partyAt - 2),
          dateIndex: Math.max(0, partyAt - 1),
          partyIndex: partyAt,
          modeIndex: modeAt,
          amountIndex: paymentAmountAt,
        });
      }
    }
  }

  return [...layouts.values()];
}

function isLikelyHeaderRow(row: SheetRow): boolean {
  const values = row.map((value) => normalizeHeaderCell(value));
  return values.includes("PARTY") && (values.includes("BAGS") || values.includes("MODE"));
}

function readSheetGunnyRows(): { purchases: GunnyPurchaseRow[]; payments: GunnyPaymentRow[] } {
  const workbook = openWorkbook();
  const worksheet = workbook.Sheets["GUNNY BAGS"];
  if (!worksheet) {
    return { purchases: [], payments: [] };
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(worksheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  const layouts = discoverLayouts(rows);
  const purchases: GunnyPurchaseRow[] = [];
  const payments: GunnyPaymentRow[] = [];

  for (const row of rows) {
    if (isLikelyHeaderRow(row)) continue;

    for (const layout of layouts) {
      const party = normalizeParty(row[layout.partyIndex] ?? null);
      if (!isValidPartyName(party)) continue;

      if (layout.kind === "purchase") {
        const bags = toNumber(row[layout.bagsIndex] ?? null);
        const rate = toNumber(row[layout.rateIndex] ?? null);
        const amount = toNumber(row[layout.amountIndex] ?? null);
        if (bags <= 0 && amount <= 0) continue;
        purchases.push({
          slNo: toNumber(row[layout.slNoIndex] ?? null) || null,
          date: toDateText(row[layout.dateIndex] ?? null),
          party,
          bags,
          rate,
          amount,
          source: "sheet",
        });
      } else {
        const amount = toNumber(row[layout.amountIndex] ?? null);
        if (amount <= 0) continue;
        payments.push({
          slNo: toNumber(row[layout.slNoIndex] ?? null) || null,
          date: toDateText(row[layout.dateIndex] ?? null),
          party,
          mode: String(row[layout.modeIndex] ?? "").trim(),
          amount,
          source: "sheet",
        });
      }
    }
  }

  return { purchases, payments };
}

function readAppGunnyPurchases(): GunnyPurchaseRow[] {
  const rows = readSheetRows<AppGunnyPurchaseRow>(APP_GUNNY_BAGS_PURCHASE_SHEET);
  return rows
    .filter((row) => row?.party)
    .map((row) => ({
      id: row.id,
      slNo: null,
      date: toDateText(row.date),
      party: normalizeParty(row.party),
      bags: toNumber(row.bags),
      rate: toNumber(row.rate),
      amount: toNumber(row.amount),
      source: "app",
    }));
}

function readAppGunnyPayments(): GunnyPaymentRow[] {
  const rows = readSheetRows<AppGunnyPaymentRow>(APP_GUNNY_BAGS_PAYMENT_SHEET);
  return rows
    .filter((row) => row?.party)
    .map((row) => ({
      id: row.id,
      slNo: null,
      date: toDateText(row.date),
      party: normalizeParty(row.party),
      mode: String(row.mode ?? "").trim(),
      amount: toNumber(row.amount),
      source: "app",
    }));
}

export function getGunnyBagsOverview(): GunnyBagsOverview {
  const sheetRows = readSheetGunnyRows();
  const appPurchases = readAppGunnyPurchases();
  const appPayments = readAppGunnyPayments();

  const purchases = [...sheetRows.purchases, ...appPurchases];
  const payments = [...sheetRows.payments, ...appPayments];

  const purchaseByParty = new Map<string, { totalBags: number; totalAmount: number }>();
  for (const row of purchases) {
    const current = purchaseByParty.get(row.party) ?? { totalBags: 0, totalAmount: 0 };
    current.totalBags += row.bags;
    current.totalAmount += row.amount;
    purchaseByParty.set(row.party, current);
  }

  const paidByParty = new Map<string, number>();
  for (const row of payments) {
    paidByParty.set(row.party, (paidByParty.get(row.party) ?? 0) + row.amount);
  }

  const purchaseOverview: GunnyPurchaseOverviewRow[] = [...purchaseByParty.entries()]
    .map(([party, totals]) => ({
      party,
      totalBags: Number(totals.totalBags.toFixed(2)),
      totalAmount: Number(totals.totalAmount.toFixed(2)),
      avgRate: totals.totalBags > 0 ? Number((totals.totalAmount / totals.totalBags).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.totalBags - a.totalBags);

  const partyNames = new Set<string>([
    ...purchaseByParty.keys(),
    ...paidByParty.keys(),
  ]);

  const partyLedger: GunnyPartyLedgerRow[] = [...partyNames]
    .map((party) => {
      const purchased = purchaseByParty.get(party) ?? { totalBags: 0, totalAmount: 0 };
      const paid = paidByParty.get(party) ?? 0;
      return {
        party,
        totalBags: Number(purchased.totalBags.toFixed(2)),
        totalPurchase: Number(purchased.totalAmount.toFixed(2)),
        totalPaid: Number(paid.toFixed(2)),
        balance: Number((purchased.totalAmount - paid).toFixed(2)),
      };
    })
    .sort((a, b) => b.balance - a.balance);

  return {
    purchases,
    payments,
    purchaseOverview,
    partyLedger,
  };
}

export async function createGunnyBagPurchase(input: GunnyBagPurchaseInput): Promise<GunnyPurchaseRow> {
  await requireAuth();

  const normalizedBags = Number(input.bags.toFixed(2));
  const normalizedRate = Number(input.rate.toFixed(2));
  const computedAmount = Number((normalizedBags * normalizedRate).toFixed(2));
  const normalizedAmount = Number((input.amount ?? computedAmount).toFixed(2));
  const row: AppGunnyPurchaseRow = {
    id: crypto.randomUUID(),
    date: input.date,
    party: input.party.trim(),
    bags: normalizedBags,
    rate: normalizedRate,
    amount: normalizedAmount,
    source: "app",
    created_at: new Date().toISOString(),
  };

  appendSheetRow(APP_GUNNY_BAGS_PURCHASE_SHEET, row);

  return {
    id: row.id,
    slNo: null,
    date: toDateText(row.date),
    party: row.party,
    bags: row.bags,
    rate: row.rate,
    amount: row.amount,
    source: "app",
  };
}

export async function createGunnyBagPayment(input: GunnyBagPaymentInput): Promise<GunnyPaymentRow> {
  await requireAuth();

  const row: AppGunnyPaymentRow = {
    id: crypto.randomUUID(),
    date: input.date,
    party: input.party.trim(),
    mode: input.mode.trim(),
    amount: Number(input.amount.toFixed(2)),
    source: "app",
    created_at: new Date().toISOString(),
  };

  appendSheetRow(APP_GUNNY_BAGS_PAYMENT_SHEET, row);

  return {
    id: row.id,
    slNo: null,
    date: toDateText(row.date),
    party: row.party,
    mode: row.mode,
    amount: row.amount,
    source: "app",
  };
}

export async function updateGunnyBagPurchase(
  id: string,
  input: GunnyBagPurchaseInput
): Promise<GunnyPurchaseRow> {
  await requireAuth();

  const normalizedBags = Number(input.bags.toFixed(2));
  const normalizedRate = Number(input.rate.toFixed(2));
  const computedAmount = Number((normalizedBags * normalizedRate).toFixed(2));
  const normalizedAmount = Number((input.amount ?? computedAmount).toFixed(2));
  const updatedRow: AppGunnyPurchaseRow = {
    id,
    date: input.date,
    party: input.party.trim(),
    bags: normalizedBags,
    rate: normalizedRate,
    amount: normalizedAmount,
    source: "app",
    created_at: new Date().toISOString(),
  };

  updateSheetRowById(APP_GUNNY_BAGS_PURCHASE_SHEET, id, updatedRow);

  return {
    id: updatedRow.id,
    slNo: null,
    date: toDateText(updatedRow.date),
    party: updatedRow.party,
    bags: updatedRow.bags,
    rate: updatedRow.rate,
    amount: updatedRow.amount,
    source: "app",
  };
}

export async function updateGunnyBagPayment(
  id: string,
  input: GunnyBagPaymentInput
): Promise<GunnyPaymentRow> {
  await requireAuth();

  const updatedRow: AppGunnyPaymentRow = {
    id,
    date: input.date,
    party: input.party.trim(),
    mode: input.mode.trim(),
    amount: Number(input.amount.toFixed(2)),
    source: "app",
    created_at: new Date().toISOString(),
  };

  updateSheetRowById(APP_GUNNY_BAGS_PAYMENT_SHEET, id, updatedRow);

  return {
    id: updatedRow.id,
    slNo: null,
    date: toDateText(updatedRow.date),
    party: updatedRow.party,
    mode: updatedRow.mode,
    amount: updatedRow.amount,
    source: "app",
  };
}

export async function deleteGunnyBagPurchase(id: string): Promise<void> {
  await requireAuth();
  deleteSheetRowById<AppGunnyPurchaseRow>(APP_GUNNY_BAGS_PURCHASE_SHEET, id);
}

export async function deleteGunnyBagPayment(id: string): Promise<void> {
  await requireAuth();
  deleteSheetRowById<AppGunnyPaymentRow>(APP_GUNNY_BAGS_PAYMENT_SHEET, id);
}
