import { format } from "date-fns";

import { requireAuth } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import {
  GenerateSalesInvoiceInput,
  SalesInvoice,
  SalesInvoiceItem,
} from "@/features/sales/schemas";
import { Company } from "@/features/companies/schemas";

type SalesInvoiceRow = {
  id: string;
  issuer_company_id: string;
  buyer_company_id: string;
  invoice_no: string;
  invoice_seq: number | string;
  issued_on: string;
  subtotal: number | string;
  total_amount: number | string;
  snapshot_json: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

type SalesInvoiceItemRow = {
  id: string;
  sales_invoice_id: string;
  sale_id: string;
  description: string | null;
  bags: number | string;
  net_weight: number | string;
  rate: number | string;
  amount: number | string;
  created_at?: string;
  updated_at?: string;
};

type SaleRow = {
  id: string;
  bill_number: string;
  sale_date: string;
  dispatch_through: "TRUCK" | "TRACTORY" | null;
  lorry_number: string | null;
  goods_name: string | null;
  destination: string | null;
  party: string | null;
  sale_company_id: string | null;
  bags: number | string;
  net_weight: number | string;
  rate: number | string;
  amount: number | string;
};

function n(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toSalesInvoiceItem(row: SalesInvoiceItemRow): SalesInvoiceItem {
  return {
    id: row.id,
    sales_invoice_id: row.sales_invoice_id,
    sale_id: row.sale_id,
    description: row.description ?? "",
    bags: n(row.bags),
    net_weight: n(row.net_weight),
    rate: n(row.rate),
    amount: n(row.amount),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toSalesInvoice(row: SalesInvoiceRow, items?: SalesInvoiceItem[]): SalesInvoice {
  return {
    id: row.id,
    issuer_company_id: row.issuer_company_id,
    buyer_company_id: row.buyer_company_id,
    invoice_no: row.invoice_no,
    invoice_seq: Math.trunc(n(row.invoice_seq)),
    issued_on: row.issued_on,
    subtotal: n(row.subtotal),
    total_amount: n(row.total_amount),
    snapshot_json: row.snapshot_json ?? {},
    items,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeSaleIds(saleIds: string[]): string[] {
  return [...new Set(saleIds.map((id) => id.trim()).filter(Boolean))];
}

function companySnapshot(company: Company) {
  return {
    id: company.id,
    type: company.type,
    name: company.name,
    display_name: company.display_name,
    code: company.code,
    address: company.address,
    phone: company.phone,
    email: company.email,
    gstin: company.gstin,
    bank_name: company.bank_name,
    bank_account_no: company.bank_account_no,
    bank_branch_ifsc: company.bank_branch_ifsc,
    invoice_prefix: company.invoice_prefix,
  };
}

export async function getSalesInvoices(): Promise<SalesInvoice[]> {
  const { data, error } = await supabaseServer
    .from("sales_invoices")
    .select("*")
    .order("issued_on", { ascending: false });

  if (error) {
    throw new Error(`Failed to load sales invoices: ${error.message}`);
  }

  return (data as SalesInvoiceRow[]).map((row) => toSalesInvoice(row));
}

export async function getSalesInvoiceById(id: string): Promise<SalesInvoice | null> {
  const { data, error } = await supabaseServer
    .from("sales_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load sales invoice: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const { data: itemRows, error: itemsError } = await supabaseServer
    .from("sales_invoice_items")
    .select("*")
    .eq("sales_invoice_id", id)
    .order("created_at", { ascending: true });

  if (itemsError) {
    throw new Error(`Failed to load sales invoice items: ${itemsError.message}`);
  }

  return toSalesInvoice(
    data as SalesInvoiceRow,
    (itemRows as SalesInvoiceItemRow[]).map(toSalesInvoiceItem)
  );
}

export async function generateSalesInvoice(
  input: GenerateSalesInvoiceInput
): Promise<SalesInvoice> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const saleIds = normalizeSaleIds(input.saleIds);
  if (saleIds.length === 0) {
    throw new Error("Select at least one sale");
  }

  const { data: salesRows, error: salesError } = await supabaseServer
    .from("sales")
    .select(
      "id, bill_number, sale_date, dispatch_through, lorry_number, goods_name, destination, party, sale_company_id, bags, net_weight, rate, amount"
    )
    .in("id", saleIds);

  if (salesError) {
    throw new Error(`Failed to load selected sales: ${salesError.message}`);
  }

  const rows = (salesRows as SaleRow[]) ?? [];
  if (rows.length !== saleIds.length) {
    throw new Error("Some selected sales were not found");
  }

  const buyerIds = [...new Set(rows.map((row) => row.sale_company_id).filter(Boolean))];
  if (buyerIds.length !== 1) {
    throw new Error("Selected sales must belong to one buyer company");
  }
  const buyerCompanyId = buyerIds[0] as string;

  if (rows.some((row) => !row.sale_company_id)) {
    throw new Error("Selected sales must be mapped to buyer company");
  }

  const { data: issuerCompanyData, error: issuerError } = await supabaseServer
    .from("companies")
    .select("*")
    .eq("id", input.issuerCompanyId)
    .eq("type", "issuer")
    .eq("is_active", true)
    .maybeSingle();

  if (issuerError) {
    throw new Error(`Failed to load issuer company: ${issuerError.message}`);
  }
  if (!issuerCompanyData) {
    throw new Error("Issuer company not found or inactive");
  }

  const issuerCompany = issuerCompanyData as Company;
  const prefix = issuerCompany.invoice_prefix?.trim().toUpperCase();
  if (!prefix) {
    throw new Error("Issuer company is missing invoice prefix");
  }

  const { data: buyerCompanyData, error: buyerError } = await supabaseServer
    .from("companies")
    .select("*")
    .eq("id", buyerCompanyId)
    .eq("type", "buyer")
    .maybeSingle();

  if (buyerError) {
    throw new Error(`Failed to load buyer company: ${buyerError.message}`);
  }
  if (!buyerCompanyData) {
    throw new Error("Buyer company not found");
  }

  const buyerCompany = buyerCompanyData as Company;
  const { data: seqData, error: seqError } = await supabaseServer.rpc(
    "next_company_invoice_seq",
    { p_issuer_company_id: input.issuerCompanyId }
  );

  if (seqError) {
    throw new Error(`Failed to generate invoice sequence: ${seqError.message}`);
  }

  const invoiceSeq = Math.trunc(n(seqData));
  if (invoiceSeq <= 0) {
    throw new Error("Invalid invoice sequence generated");
  }
  const invoiceNo = `${prefix}-${String(invoiceSeq).padStart(4, "0")}`;
  const issuedOn = input.issuedOn || format(new Date(), "yyyy-MM-dd");

  const sortedRows = [...rows].sort((a, b) => a.sale_date.localeCompare(b.sale_date));
  const itemsPayload = sortedRows.map((row) => ({
    id: crypto.randomUUID(),
    sale_id: row.id,
    bill_number: row.bill_number,
    description: (row.goods_name || "MAIZE").trim() || "MAIZE",
    dispatch_through: row.dispatch_through === "TRACTORY" ? "TRACTORY" : "TRUCK",
    destination: row.destination?.trim() || "",
    bags: n(row.bags),
    net_weight: n(row.net_weight),
    rate: n(row.rate),
    amount: n(row.amount),
  }));

  const subtotal = itemsPayload.reduce((sum, item) => sum + item.amount, 0);
  const totalAmount = subtotal;
  const invoiceId = crypto.randomUUID();

  const snapshot = {
    invoice_no: invoiceNo,
    invoice_seq: invoiceSeq,
    issued_on: issuedOn,
    issuer_company: companySnapshot(issuerCompany),
    buyer_company: companySnapshot(buyerCompany),
    dispatch_through:
      sortedRows[0]?.dispatch_through === "TRACTORY" ? "TRACTORY" : "TRUCK",
    destination: sortedRows[0]?.destination?.trim() || "",
    lorry_number: sortedRows[0]?.lorry_number?.trim() || "",
    items: itemsPayload,
    totals: {
      subtotal,
      total_amount: totalAmount,
    },
  };

  const { data: invoiceData, error: invoiceError } = await supabaseServer
    .from("sales_invoices")
    .insert({
      id: invoiceId,
      issuer_company_id: input.issuerCompanyId,
      buyer_company_id: buyerCompanyId,
      invoice_no: invoiceNo,
      invoice_seq: invoiceSeq,
      issued_on: issuedOn,
      subtotal,
      total_amount: totalAmount,
      snapshot_json: snapshot,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (invoiceError) {
    throw new Error(`Failed to create sales invoice: ${invoiceError.message}`);
  }

  const itemRows = itemsPayload.map((item) => ({
    id: item.id,
    sale_id: item.sale_id,
    description: item.description,
    bags: item.bags,
    net_weight: item.net_weight,
    rate: item.rate,
    amount: item.amount,
    sales_invoice_id: invoiceId,
    updated_at: new Date().toISOString(),
  }));

  const { data: createdItems, error: itemsInsertError } = await supabaseServer
    .from("sales_invoice_items")
    .insert(itemRows)
    .select("*");

  if (itemsInsertError) {
    await supabaseServer.from("sales_invoices").delete().eq("id", invoiceId);
    throw new Error(`Failed to create invoice items: ${itemsInsertError.message}`);
  }

  return toSalesInvoice(
    invoiceData as SalesInvoiceRow,
    (createdItems as SalesInvoiceItemRow[]).map(toSalesInvoiceItem)
  );
}
