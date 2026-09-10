import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { calculateSale } from "@/features/sales/utils/calculations";
import { getFinancialYearBounds } from "@/lib/financial-year";
import type { SoyaTrade, SoyaTradeInput } from "@/features/soya-trade/schemas";
import type { SoyaCompany, SoyaCompanyType } from "@/features/soya-companies/schemas";
import {
  getSoyaCompanies,
  upsertSoyaCompanyByName,
} from "@/features/soya-companies/service/soya-company.service";

type TradeRow = {
  id: string;
  sl_no: number | null;
  bill_number: string;
  sale_date: string;
  issuer_company_id: string | null;
  dispatch_through: "TRUCK" | "TRACTORY" | null;
  lorry_number: string | null;
  goods_name: string | null;
  destination: string | null;
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

export type SoyaTradeServiceConfig = {
  /** Records table, e.g. "soya_purchases" or "soya_sales". */
  table: string;
  /** Which party directory type the counterparty belongs to. */
  partyType: Extract<SoyaCompanyType, "buyer">;
  /** Human label used in error messages, e.g. "purchase". */
  entityLabel: string;
  /** Table blocking deletes when a record is already invoiced, if any. */
  invoiceItemsTable?: string;
};

function n(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeName(value: unknown): string {
  if (value == null) return "";
  return String(value).trim().replace(/\s+/g, " ");
}

function toTrade(row: TradeRow): SoyaTrade {
  return {
    id: row.id,
    sl_no: row.sl_no ?? null,
    bill_number: row.bill_number,
    sale_date: row.sale_date,
    issuer_company_id: row.issuer_company_id ?? null,
    dispatch_through: row.dispatch_through === "TRACTORY" ? "TRACTORY" : "TRUCK",
    lorry_number: row.lorry_number ?? "",
    goods_name: row.goods_name ?? "SOYA",
    destination: row.destination ?? "",
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

/**
 * Builds the data layer for one Soya trade module. Soya Purchases and Soya
 * Sales are the same sales-shaped record against different tables, so they
 * share this factory instead of duplicating ~700 lines twice.
 *
 * Writes are gated on requireRole(["admin"]) — Soya is admin-only and is
 * deliberately not wired into the per-module permission map.
 */
export function createSoyaTradeService(config: SoyaTradeServiceConfig) {
  const { table, partyType, entityLabel, invoiceItemsTable } = config;

  async function getAll(filters?: { partyCompanyId?: string }): Promise<SoyaTrade[]> {
    let query = supabaseServer
      .from(table)
      .select("*")
      .order("sale_date", { ascending: false })
      .order("bill_number", { ascending: false });

    if (filters?.partyCompanyId) {
      query = query.eq("sale_company_id", filters.partyCompanyId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to load soya ${entityLabel}s: ${error.message}`);
    }
    return ((data as TradeRow[]) ?? []).map(toTrade);
  }

  async function getById(id: string): Promise<SoyaTrade | null> {
    const { data, error } = await supabaseServer
      .from(table)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to load soya ${entityLabel}: ${error.message}`);
    }
    return data ? toTrade(data as TradeRow) : null;
  }

  async function resolveIssuerCompanyId(
    input: SoyaTradeInput,
  ): Promise<string | null> {
    const issuerCompanyId = input.issuer_company_id ?? null;
    if (!issuerCompanyId) return null;

    const { data, error } = await supabaseServer
      .from("soya_companies")
      .select("id")
      .eq("id", issuerCompanyId)
      .eq("type", "issuer")
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve issuer company: ${error.message}`);
    }
    if (!data) {
      throw new Error("Selected issuer company not found");
    }
    return issuerCompanyId;
  }

  async function resolvePartyFields(
    input: SoyaTradeInput,
  ): Promise<Pick<SoyaTradeInput, "party" | "sale_company_id">> {
    const partyCompanyId = input.sale_company_id ?? null;
    if (partyCompanyId) {
      const { data, error } = await supabaseServer
        .from("soya_companies")
        .select("id, name")
        .eq("id", partyCompanyId)
        .eq("type", partyType)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to resolve ${partyType}: ${error.message}`);
      }
      if (!data) {
        throw new Error(`Selected ${partyType} not found`);
      }
      return {
        sale_company_id: data.id,
        party: String((data as { name: string }).name || "").trim(),
      };
    }

    const party = normalizeName(input.party);
    if (!party) {
      throw new Error("Party is required");
    }

    const company = await upsertSoyaCompanyByName(party, partyType);
    return { sale_company_id: company?.id ?? null, party };
  }

  async function assertBillNumberFree(
    billNumber: string,
    saleDate: string,
    issuerCompanyId: string | null,
    excludeId?: string,
  ): Promise<void> {
    const { start, end } = getFinancialYearBounds(saleDate || new Date());
    let query = supabaseServer
      .from(table)
      .select("id")
      .eq("bill_number", billNumber)
      .gte("sale_date", start)
      .lte("sale_date", end);
    if (excludeId) {
      query = query.neq("id", excludeId);
    }
    query = issuerCompanyId
      ? query.eq("issuer_company_id", issuerCompanyId)
      : query.is("issuer_company_id", null);

    const { data, error } = await query.limit(1).maybeSingle();
    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to validate bill number: ${error.message}`);
    }
    if (data) {
      throw new Error(
        "Bill number already exists for this issuer company in this financial year",
      );
    }
  }

  function duplicateBillNumberError(error: { code?: string; message?: string }) {
    return (
      error.code === "23505" && String(error.message ?? "").includes("bill_number")
    );
  }

  async function create(input: SoyaTradeInput): Promise<SoyaTrade> {
    await requireRole(["admin"]);

    const billNumber = String(input.bill_number ?? "").trim();
    if (!billNumber) {
      throw new Error("Bill number is required");
    }

    const issuerCompanyId = await resolveIssuerCompanyId(input);
    await assertBillNumberFree(billNumber, input.sale_date, issuerCompanyId);

    const resolved = await resolvePartyFields(input);
    const calculated = calculateSale(
      {
        ...input,
        ...resolved,
        issuer_company_id: issuerCompanyId,
        bill_number: billNumber,
        source: "manual",
      },
      crypto.randomUUID(),
    );

    const { data, error } = await supabaseServer
      .from(table)
      .insert({ ...calculated, updated_at: new Date().toISOString() })
      .select("*")
      .single();

    if (error) {
      if (duplicateBillNumberError(error)) {
        throw new Error(
          "Bill number already exists for this issuer company in this financial year",
        );
      }
      throw new Error(`Failed to create soya ${entityLabel}: ${error.message}`);
    }
    return toTrade(data as TradeRow);
  }

  async function update(id: string, input: SoyaTradeInput): Promise<SoyaTrade> {
    await requireRole(["admin"]);

    const existing = await getById(id);
    if (!existing) {
      throw new Error(`Soya ${entityLabel} not found`);
    }

    const billNumber = String(input.bill_number ?? "").trim();
    if (!billNumber) {
      throw new Error("Bill number is required");
    }

    const issuerCompanyId = await resolveIssuerCompanyId(input);
    await assertBillNumberFree(billNumber, input.sale_date, issuerCompanyId, id);

    const resolved = await resolvePartyFields(input);
    const calculated = calculateSale(
      {
        ...input,
        ...resolved,
        issuer_company_id: issuerCompanyId,
        bill_number: billNumber,
        source: existing.source,
      },
      id,
    );

    const { data, error } = await supabaseServer
      .from(table)
      .update({ ...calculated, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      if (duplicateBillNumberError(error)) {
        throw new Error(
          "Bill number already exists for this issuer company in this financial year",
        );
      }
      throw new Error(`Failed to update soya ${entityLabel}: ${error.message}`);
    }
    return toTrade(data as TradeRow);
  }

  async function remove(id: string): Promise<void> {
    await requireRole(["admin"]);

    const existing = await getById(id);
    if (!existing) {
      throw new Error(`Soya ${entityLabel} not found`);
    }

    if (invoiceItemsTable) {
      const { count, error: linkError } = await supabaseServer
        .from(invoiceItemsTable)
        .select("id", { count: "exact", head: true })
        .eq("sale_id", id);

      if (linkError) {
        throw new Error(`Failed to validate delete: ${linkError.message}`);
      }
      if ((count ?? 0) > 0) {
        throw new Error(
          `This ${entityLabel} is linked to invoice items and cannot be deleted.`,
        );
      }
    }

    const { error } = await supabaseServer.from(table).delete().eq("id", id);
    if (error) {
      throw new Error(`Failed to delete soya ${entityLabel}: ${error.message}`);
    }
  }

  async function getPartyCompanies(): Promise<SoyaCompany[]> {
    return getSoyaCompanies(partyType);
  }

  async function getIssuerCompanies(): Promise<SoyaCompany[]> {
    return getSoyaCompanies("issuer");
  }

  /** Next SL No (global) and next bill number (per issuer, per financial year). */
  async function getNextIdentifiersForDate(
    saleDate: string,
    issuerCompanyId?: string | null,
  ): Promise<{ nextSlNo: number; nextBillNumber: string }> {
    const { start, end } = getFinancialYearBounds(saleDate || new Date());

    let billNumberQuery = supabaseServer
      .from(table)
      .select("bill_number")
      .gte("sale_date", start)
      .lte("sale_date", end);
    if (issuerCompanyId) {
      billNumberQuery = billNumberQuery.eq("issuer_company_id", issuerCompanyId);
    } else if (issuerCompanyId === null) {
      billNumberQuery = billNumberQuery.is("issuer_company_id", null);
    }

    const [{ data: slRows, error: slError }, { data: billRows, error: billError }] =
      await Promise.all([
        supabaseServer
          .from(table)
          .select("sl_no")
          .not("sl_no", "is", null)
          .order("sl_no", { ascending: false })
          .limit(1),
        billNumberQuery,
      ]);

    if (slError) {
      throw new Error(`Failed to calculate next SL No: ${slError.message}`);
    }
    if (billError) {
      throw new Error(`Failed to calculate next bill number: ${billError.message}`);
    }

    const maxSlNo = Number(
      (slRows?.[0] as { sl_no?: number } | undefined)?.sl_no ?? 0,
    );

    let maxBillNumeric = 0;
    for (const row of (billRows ?? []) as { bill_number: string }[]) {
      const parsed = Number(String(row.bill_number ?? "").trim());
      if (Number.isFinite(parsed) && parsed > maxBillNumeric) {
        maxBillNumeric = parsed;
      }
    }

    return {
      nextSlNo: maxSlNo + 1,
      nextBillNumber: String(maxBillNumeric + 1 || 1),
    };
  }

  return {
    getAll,
    getById,
    create,
    update,
    remove,
    getPartyCompanies,
    getIssuerCompanies,
    getNextIdentifiersForDate,
  };
}
