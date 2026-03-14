import { format, isValid, parse } from "date-fns";
import * as XLSX from "xlsx";

import { requireAuth } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { Sale, SaleInput, SalesImportSummary } from "@/features/sales/schemas";
import { calculateSale } from "@/features/sales/utils/calculations";
import { Company } from "@/features/companies/schemas";
import {
  companyNameKey,
  getCompanies,
  upsertBuyerCompanyByName,
} from "@/features/companies/service/company.service";

type SaleRow = {
  id: string;
  sl_no: number | null;
  bill_number: string;
  sale_date: string;
  lorry_number: string | null;
  party: string | null;
  sale_company_id: string | null;
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

type SalesFilters = {
  buyerCompanyId?: string;
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

function normalizeCompanyName(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function toSale(row: SaleRow): Sale {
  return {
    id: row.id,
    sl_no: row.sl_no ?? null,
    bill_number: row.bill_number,
    sale_date: row.sale_date,
    lorry_number: row.lorry_number ?? "",
    party: row.party ?? "",
    sale_company_id: row.sale_company_id ?? null,
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

  const dmyStars = parse(raw, "dd*MM*yyyy", new Date());
  if (isValid(dmyStars)) {
    return format(dmyStars, "yyyy-MM-dd");
  }

  return null;
}

function normalizeBillNumber(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

async function resolvePartyFields(
  input: SaleInput
): Promise<Pick<SaleInput, "party" | "sale_company_id">> {
  const saleCompanyId = input.sale_company_id ?? null;
  if (saleCompanyId) {
    const { data, error } = await supabaseServer
      .from("companies")
      .select("id, name")
      .eq("id", saleCompanyId)
      .eq("type", "buyer")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve buyer company: ${error.message}`);
    }
    if (!data) {
      throw new Error("Selected buyer company not found");
    }

    return {
      sale_company_id: data.id,
      party: String((data as { name: string }).name || "").trim(),
    };
  }

  const party = normalizeCompanyName(input.party);
  if (!party) {
    throw new Error("Party is required");
  }

  const buyerCompany = await upsertBuyerCompanyByName(party);
  return {
    sale_company_id: buyerCompany?.id ?? null,
    party,
  };
}

export async function getSales(filters?: SalesFilters): Promise<Sale[]> {
  let query = supabaseServer.from("sales").select("*").order("sale_date", { ascending: false });

  if (filters?.buyerCompanyId) {
    query = query.eq("sale_company_id", filters.buyerCompanyId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load sales: ${error.message}`);
  }

  return (data as SaleRow[]).map(toSale);
}

export async function getSalesByIds(ids: string[]): Promise<Sale[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabaseServer.from("sales").select("*").in("id", ids);
  if (error) {
    throw new Error(`Failed to load selected sales: ${error.message}`);
  }
  return ((data as SaleRow[]) ?? []).map(toSale);
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

  const resolved = await resolvePartyFields(input);
  const calculated = calculateSale(
    { ...input, ...resolved, source: "manual" },
    crypto.randomUUID()
  );
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

  const resolved = await resolvePartyFields(input);
  const calculated = calculateSale(
    { ...input, ...resolved, source: existing.source },
    id
  );
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

export async function deleteSale(id: string): Promise<void> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const existing = await getSaleById(id);
  if (!existing) {
    throw new Error("Sale not found");
  }

  const { count, error: linkError } = await supabaseServer
    .from("sales_invoice_items")
    .select("id", { count: "exact", head: true })
    .eq("sale_id", id);

  if (linkError) {
    throw new Error(`Failed to validate sale delete: ${linkError.message}`);
  }

  if ((count ?? 0) > 0) {
    throw new Error("This sale is linked to invoice items and cannot be deleted.");
  }

  const { error } = await supabaseServer.from("sales").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete sale: ${error.message}`);
  }
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
  const resolved = await resolvePartyFields(input);
  const calculated = calculateSale(
    { ...input, ...resolved, bill_number: billNumber, source },
    id
  );

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

async function upsertBuyerCompaniesFromCompanySheet(
  workbook: XLSX.WorkBook
): Promise<Map<string, string>> {
  const nameToId = new Map<string, string>();
  const buyerCompanies = await getCompanies("buyer");
  buyerCompanies.forEach((company) => {
    nameToId.set(companyNameKey(company.name), company.id);
  });

  const companySheet = workbook.Sheets.COMPANY;
  if (!companySheet) {
    return nameToId;
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(companySheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  for (const row of rows) {
    const firstCell = normalizeCompanyName(row[0]);
    if (!firstCell) continue;

    const headerText = firstCell.toUpperCase();
    if (
      headerText.includes("SL.NO") ||
      headerText.includes("BILL") ||
      headerText.includes("DATE")
    ) {
      continue;
    }

    const looksLikeCompanyHeader =
      row.slice(1, 8).every((cell) => normalizeCompanyName(cell).length === 0) &&
      /^[A-Z0-9 .&/-]+$/i.test(firstCell);

    if (!looksLikeCompanyHeader) {
      continue;
    }

    const created = await upsertBuyerCompanyByName(firstCell);
    if (created) {
      nameToId.set(companyNameKey(created.name), created.id);
    }
  }

  return nameToId;
}

async function backfillSaleCompaniesFromPartyName(
  partyToCompanyId: Map<string, string>
): Promise<void> {
  const { data, error } = await supabaseServer
    .from("sales")
    .select("id, party, sale_company_id")
    .is("sale_company_id", null);

  if (error) {
    throw new Error(`Failed to read sales for company backfill: ${error.message}`);
  }

  const rows = (data ?? []) as {
    id: string;
    party: string | null;
    sale_company_id: string | null;
  }[];

  for (const row of rows) {
    const party = normalizeCompanyName(row.party);
    if (!party) continue;
    const key = companyNameKey(party);
    let companyId = partyToCompanyId.get(key);
    if (!companyId) {
      const created = await upsertBuyerCompanyByName(party);
      companyId = created?.id;
      if (companyId) {
        partyToCompanyId.set(key, companyId);
      }
    }
    if (!companyId) continue;

    await supabaseServer
      .from("sales")
      .update({ sale_company_id: companyId, party, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}

export async function importSalesFromBillWorkbook(
  fileBuffer: Buffer
): Promise<SalesImportSummary> {
  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: true,
  });

  const partyToCompanyId = await upsertBuyerCompaniesFromCompanySheet(workbook);
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
    const party = normalizeCompanyName(row[10]);

    if (!parsedDate || !party) {
      summary.failed += 1;
      summary.errors.push(
        `Row ${headerIndex + 2 + index}: missing/invalid sale_date or party`
      );
      continue;
    }

    let saleCompanyId = partyToCompanyId.get(companyNameKey(party)) ?? null;
    if (!saleCompanyId) {
      const buyerCompany = await upsertBuyerCompanyByName(party);
      saleCompanyId = buyerCompany?.id ?? null;
      if (saleCompanyId) {
        partyToCompanyId.set(companyNameKey(party), saleCompanyId);
      }
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
      lorry_number: normalizeCompanyName(row[3]),
      party,
      sale_company_id: saleCompanyId,
      payment_terms: normalizeCompanyName(row[11]),
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

  await backfillSaleCompaniesFromPartyName(partyToCompanyId);
  return summary;
}

export async function getBuyerCompaniesForSales(): Promise<Company[]> {
  return getCompanies("buyer");
}

export async function getNextSaleIdentifiers(): Promise<{
  nextSlNo: number;
  nextBillNumber: string;
}> {
  const [{ data: slRows, error: slError }, { data: billRows, error: billError }] =
    await Promise.all([
      supabaseServer
        .from("sales")
        .select("sl_no")
        .not("sl_no", "is", null)
        .order("sl_no", { ascending: false })
        .limit(1),
      supabaseServer.from("sales").select("bill_number"),
    ]);

  if (slError) {
    throw new Error(`Failed to calculate next SL No: ${slError.message}`);
  }
  if (billError) {
    throw new Error(`Failed to calculate next bill number: ${billError.message}`);
  }

  const maxSlNo = Number((slRows?.[0] as { sl_no?: number } | undefined)?.sl_no ?? 0);

  let maxBillNumeric = 0;
  for (const row of (billRows ?? []) as { bill_number: string }[]) {
    const parsed = Number(String(row.bill_number ?? "").trim());
    if (Number.isFinite(parsed) && parsed > maxBillNumeric) {
      maxBillNumeric = parsed;
    }
  }

  const nextSlNo = maxSlNo + 1;
  const nextBillNumber = String(maxBillNumeric + 1 || 1);

  return { nextSlNo, nextBillNumber };
}
