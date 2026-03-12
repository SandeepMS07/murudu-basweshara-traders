import { format, isValid, parse } from "date-fns";
import * as XLSX from "xlsx";

import { requireAuth } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import {
  Sale,
  SaleInput,
  SalesImportSummary,
} from "@/features/sales/schemas";
import { calculateSale } from "@/features/sales/utils/calculations";

type SaleRow = {
  id: string;
  sl_no: number | null;
  bill_number: string;
  sale_date: string;
  lorry_number: string | null;
  party: string | null;
  payment_terms: string | null;
  bags: number | string;
  net_weight: number | string;
  factory_weight: number | string;
  rate: number | string;
  flight: number | string;
  amount: number | string;
  bag_avg: number | string;
  factory_rate: number | string;
  factory_amount: number | string;
  pending_amount: number | string;
  source: "manual" | "import";
  created_at?: string;
  updated_at?: string;
};

function n(value: number | string | Date | null | undefined): number {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  }
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toSale(row: SaleRow): Sale {
  return {
    id: row.id,
    sl_no: row.sl_no ?? null,
    bill_number: row.bill_number,
    sale_date: row.sale_date,
    lorry_number: row.lorry_number ?? "",
    party: row.party ?? "",
    payment_terms: row.payment_terms ?? "",
    bags: n(row.bags),
    net_weight: n(row.net_weight),
    factory_weight: n(row.factory_weight),
    rate: n(row.rate),
    flight: n(row.flight),
    amount: n(row.amount),
    bag_avg: n(row.bag_avg),
    factory_rate: n(row.factory_rate),
    factory_amount: n(row.factory_amount),
    pending_amount: n(row.pending_amount),
    source: row.source,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function parseExcelDate(value: unknown): string | null {
  if (value instanceof Date) {
    return format(value, "yyyy-MM-dd");
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    const date = new Date(parsed.y, parsed.m - 1, parsed.d);
    return isValid(date) ? format(date, "yyyy-MM-dd") : null;
  }

  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const direct = new Date(raw);
  if (isValid(direct)) {
    return format(direct, "yyyy-MM-dd");
  }

  const dmy = parse(raw, "dd/MM/yyyy", new Date());
  if (isValid(dmy)) {
    return format(dmy, "yyyy-MM-dd");
  }

  const mdy = parse(raw, "MM/dd/yyyy", new Date());
  if (isValid(mdy)) {
    return format(mdy, "yyyy-MM-dd");
  }

  return null;
}

function normalizeBillNumber(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export async function getSales(): Promise<Sale[]> {
  const { data, error } = await supabaseServer
    .from("sales")
    .select("*")
    .order("sale_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load sales: ${error.message}`);
  }

  return (data as SaleRow[]).map(toSale);
}

export async function getSaleById(id: string): Promise<Sale | null> {
  const { data, error } = await supabaseServer
    .from("sales")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load sale: ${error.message}`);
  }

  return data ? toSale(data as SaleRow) : null;
}

export async function createSale(input: SaleInput): Promise<Sale> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const calculated = calculateSale({ ...input, source: "manual" }, crypto.randomUUID());
  const payload = {
    ...calculated,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("sales")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create sale: ${error.message}`);
  }

  return toSale(data as SaleRow);
}

export async function updateSale(id: string, input: SaleInput): Promise<Sale> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const existing = await getSaleById(id);
  if (!existing) {
    throw new Error("Sale not found");
  }

  const calculated = calculateSale({ ...input, source: existing.source }, id);
  const payload = {
    ...calculated,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("sales")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update sale: ${error.message}`);
  }

  return toSale(data as SaleRow);
}

export async function upsertSaleByBillNumber(input: SaleInput): Promise<Sale> {
  const billNumber = normalizeBillNumber(input.bill_number);
  if (!billNumber) {
    throw new Error("Bill number is required");
  }

  const { data: existing, error: existingError } = await supabaseServer
    .from("sales")
    .select("id, source")
    .eq("bill_number", billNumber)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to check existing sale: ${existingError.message}`);
  }

  const id = existing?.id ?? crypto.randomUUID();
  const source = (input.source ?? "import") as "manual" | "import";
  const calculated = calculateSale({ ...input, bill_number: billNumber, source }, id);

  const payload = {
    ...calculated,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("sales")
    .upsert(payload, { onConflict: "bill_number" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to upsert sale: ${error.message}`);
  }

  return toSale(data as SaleRow);
}

export async function importSalesFromBillWorkbook(
  fileBuffer: Buffer
): Promise<SalesImportSummary> {
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: true,
  });
  const sheet = workbook.Sheets.BILL;
  if (!sheet) {
    throw new Error("BILL sheet not found in workbook");
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | Date)[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  const headerIndex = rows.findIndex((row) => {
    const values = row.map((cell) => String(cell).trim().toUpperCase());
    return values.includes("BILL NUM") && values.includes("NET WEIGHT");
  });

  if (headerIndex === -1) {
    throw new Error("BILL sheet header row not found");
  }

  const dataRows = rows.slice(headerIndex + 1);

  const summary: SalesImportSummary = {
    inserted: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const allBillNumbers = dataRows
    .map((row) => normalizeBillNumber(row[1]))
    .filter((value) => value.length > 0);

  const existingMap = new Map<string, string>();
  if (allBillNumbers.length > 0) {
    const { data: existingRows, error: existingErr } = await supabaseServer
      .from("sales")
      .select("id, bill_number")
      .in("bill_number", allBillNumbers);

    if (existingErr) {
      throw new Error(`Failed to pre-check existing sales: ${existingErr.message}`);
    }

    (existingRows ?? []).forEach((row: { id: string; bill_number: string }) => {
      existingMap.set(row.bill_number, row.id);
    });
  }

  for (let index = 0; index < dataRows.length; index += 1) {
    const row = dataRows[index];
    const billNumber = normalizeBillNumber(row[1]);

    if (!billNumber) {
      summary.skipped += 1;
      continue;
    }

    const parsedDate = parseExcelDate(row[2]);
    const party = String(row[10] ?? "").trim();

    if (!parsedDate || !party) {
      summary.failed += 1;
      summary.errors.push(
        `Row ${headerIndex + 2 + index}: missing/invalid sale_date or party`
      );
      continue;
    }

    const netWeight = n(row[5]);
    const amount = n(row[9]);
    const pendingAmount = n(row[14]);
    const factoryAmount = n(row[13]);
    const derivedFactoryRate =
      netWeight > 0
        ? factoryAmount > 0
          ? factoryAmount / netWeight
          : amount > 0
            ? (amount - pendingAmount) / netWeight
            : 0
        : 0;

    const input: SaleInput = {
      id: existingMap.get(billNumber),
      sl_no: row[0] === "" ? null : Math.trunc(n(row[0])),
      bill_number: billNumber,
      sale_date: parsedDate,
      lorry_number: String(row[3] ?? "").trim(),
      party,
      payment_terms: String(row[11] ?? "").trim(),
      bags: n(row[4]),
      net_weight: netWeight,
      factory_weight: n(row[6]),
      rate: n(row[7]),
      flight: n(row[8]),
      bag_avg: row[12] === "" ? undefined : n(row[12]),
      factory_rate: Number(derivedFactoryRate.toFixed(4)),
      source: "import",
    };

    try {
      await upsertSaleByBillNumber(input);
      if (existingMap.has(billNumber)) {
        summary.updated += 1;
      } else {
        summary.inserted += 1;
      }
    } catch (error) {
      summary.failed += 1;
      summary.errors.push(
        `Row ${headerIndex + 2 + index}: ${
          error instanceof Error ? error.message : "Import failed"
        }`
      );
    }
  }

  return summary;
}
