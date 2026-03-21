import { requireAuth } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import {
  Company,
  CompanyPaymentAllocation,
  CompanyInput,
  CompanyPayment,
  CompanyPaymentInput,
  companyTypeEnum,
} from "@/features/companies/schemas";

type CompanyRow = {
  id: string;
  type: "issuer" | "buyer";
  name: string;
  display_name: string | null;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  bank_branch_ifsc: string | null;
  invoice_prefix: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
};

type CompanyPaymentRow = {
  id: string;
  company_id: string;
  paid_on: string;
  amount: number | string;
  note: string | null;
  created_at?: string;
  updated_at?: string;
};

type CompanyPaymentAllocationRow = {
  id: string;
  payment_id: string;
  sale_id: string;
  amount: number | string;
  created_at?: string;
  updated_at?: string;
};

function toCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    display_name: row.display_name ?? "",
    code: row.code ?? "",
    address: row.address ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    gstin: row.gstin ?? "",
    bank_name: row.bank_name ?? "",
    bank_account_no: row.bank_account_no ?? "",
    bank_branch_ifsc: row.bank_branch_ifsc ?? "",
    invoice_prefix: row.invoice_prefix ?? "",
    is_active: row.is_active,
    is_default: row.is_default,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toCompanyPayment(row: CompanyPaymentRow): CompanyPayment {
  return {
    id: row.id,
    company_id: row.company_id,
    paid_on: row.paid_on,
    amount: typeof row.amount === "number" ? row.amount : Number(row.amount || 0),
    note: row.note ?? "",
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toCompanyPaymentAllocation(
  row: CompanyPaymentAllocationRow
): CompanyPaymentAllocation {
  return {
    id: row.id,
    payment_id: row.payment_id,
    sale_id: row.sale_id,
    amount: typeof row.amount === "number" ? row.amount : Number(row.amount || 0),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeCompanyName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function companyNameKey(value: string): string {
  return normalizeCompanyName(value).toUpperCase();
}

export async function getCompanies(type?: "issuer" | "buyer"): Promise<Company[]> {
  let query = supabaseServer
    .from("companies")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load companies: ${error.message}`);
  }

  return (data as CompanyRow[]).map(toCompany);
}

export async function getCompanyById(id: string): Promise<Company | null> {
  const { data, error } = await supabaseServer
    .from("companies")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load company: ${error.message}`);
  }

  return data ? toCompany(data as CompanyRow) : null;
}

async function assertAdminAccess() {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Only admin can manage companies");
  }
}

export async function createCompany(input: CompanyInput): Promise<Company> {
  await assertAdminAccess();
  const type = companyTypeEnum.parse(input.type);
  const name = normalizeCompanyName(input.name);
  if (!name) {
    throw new Error("Company name is required");
  }

  const id = input.id ?? crypto.randomUUID();
  const payload = {
    id,
    type,
    name,
    display_name: input.display_name || "",
    code: input.code || "",
    address: input.address || "",
    phone: input.phone || "",
    email: input.email || "",
    gstin: input.gstin || "",
    bank_name: input.bank_name || "",
    bank_account_no: input.bank_account_no || "",
    bank_branch_ifsc: input.bank_branch_ifsc || "",
    invoice_prefix: (input.invoice_prefix || "").trim().toUpperCase(),
    is_active: input.is_active ?? true,
    is_default: input.is_default ?? false,
    updated_at: new Date().toISOString(),
  };

  if (payload.type === "issuer" && !payload.invoice_prefix) {
    throw new Error("Invoice prefix is required for issuer company");
  }

  const { data, error } = await supabaseServer
    .from("companies")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create company: ${error.message}`);
  }

  return toCompany(data as CompanyRow);
}

export async function updateCompany(id: string, input: CompanyInput): Promise<Company> {
  await assertAdminAccess();

  const type = companyTypeEnum.parse(input.type);
  const name = normalizeCompanyName(input.name);
  if (!name) {
    throw new Error("Company name is required");
  }

  const payload = {
    type,
    name,
    display_name: input.display_name || "",
    code: input.code || "",
    address: input.address || "",
    phone: input.phone || "",
    email: input.email || "",
    gstin: input.gstin || "",
    bank_name: input.bank_name || "",
    bank_account_no: input.bank_account_no || "",
    bank_branch_ifsc: input.bank_branch_ifsc || "",
    invoice_prefix: (input.invoice_prefix || "").trim().toUpperCase(),
    is_active: input.is_active ?? true,
    is_default: input.is_default ?? false,
    updated_at: new Date().toISOString(),
  };

  if (payload.type === "issuer" && !payload.invoice_prefix) {
    throw new Error("Invoice prefix is required for issuer company");
  }

  const { data, error } = await supabaseServer
    .from("companies")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update company: ${error.message}`);
  }

  return toCompany(data as CompanyRow);
}

export type DeleteCompanyResult = {
  status: "deleted" | "deactivated";
  message: string;
};

export async function deleteCompany(id: string): Promise<DeleteCompanyResult> {
  await assertAdminAccess();

  const [{ count: linkedSalesCount, error: linkedSalesError }, { count: linkedAsIssuerCount, error: linkedAsIssuerError }, { count: linkedAsBuyerCount, error: linkedAsBuyerError }] =
    await Promise.all([
      supabaseServer
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("sale_company_id", id),
      supabaseServer
        .from("sales_invoices")
        .select("id", { count: "exact", head: true })
        .eq("issuer_company_id", id),
      supabaseServer
        .from("sales_invoices")
        .select("id", { count: "exact", head: true })
        .eq("buyer_company_id", id),
    ]);

  if (linkedSalesError || linkedAsIssuerError || linkedAsBuyerError) {
    throw new Error(
      `Failed to validate company delete: ${
        linkedSalesError?.message || linkedAsIssuerError?.message || linkedAsBuyerError?.message
      }`
    );
  }

  const hasLinkedData =
    (linkedSalesCount ?? 0) > 0 ||
    (linkedAsIssuerCount ?? 0) > 0 ||
    (linkedAsBuyerCount ?? 0) > 0;

  if (hasLinkedData) {
    const { error: deactivateError } = await supabaseServer
      .from("companies")
      .update({
        is_active: false,
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (deactivateError) {
      throw new Error(`Failed to deactivate company: ${deactivateError.message}`);
    }

    return {
      status: "deactivated",
      message: "Company has linked sales/invoices. It was deactivated instead of deleted.",
    };
  }

  const { error } = await supabaseServer.from("companies").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete company: ${error.message}`);
  }

  return {
    status: "deleted",
    message: "Company deleted successfully.",
  };
}

export async function upsertBuyerCompanyByName(
  rawName: string
): Promise<Company | null> {
  const name = normalizeCompanyName(rawName);
  if (!name) return null;

  const existing = await supabaseServer
    .from("companies")
    .select("*")
    .eq("type", "buyer")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Failed to lookup buyer company: ${existing.error.message}`);
  }

  if (existing.data) {
    return toCompany(existing.data as CompanyRow);
  }

  const insertResult = await supabaseServer
    .from("companies")
    .insert({
      id: crypto.randomUUID(),
      type: "buyer",
      name,
      display_name: name,
      is_active: true,
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertResult.error) {
    throw new Error(`Failed to create buyer company: ${insertResult.error.message}`);
  }

  return toCompany(insertResult.data as CompanyRow);
}

export async function getCompanyPayments(companyId?: string): Promise<CompanyPayment[]> {
  let query = supabaseServer
    .from("company_payments")
    .select("*")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load company payments: ${error.message}`);
  }

  return (data as CompanyPaymentRow[]).map(toCompanyPayment);
}

export async function getCompanyPaymentAllocations(
  saleIds?: string[]
): Promise<CompanyPaymentAllocation[]> {
  let query = supabaseServer
    .from("company_payment_allocations")
    .select("*")
    .order("created_at", { ascending: false });

  if (saleIds && saleIds.length > 0) {
    query = query.in("sale_id", saleIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load payment allocations: ${error.message}`);
  }

  return (data as CompanyPaymentAllocationRow[]).map(toCompanyPaymentAllocation);
}

export async function createCompanyPayment(
  input: CompanyPaymentInput
): Promise<{ payment: CompanyPayment; allocations: CompanyPaymentAllocation[] }> {
  await assertAdminAccess();

  const allocations = (input.allocations ?? []).filter((item) => item.amount > 0);
  const saleIds = [...new Set(allocations.map((item) => item.sale_id))];
  const totalAllocated = allocations.reduce((sum, item) => sum + item.amount, 0);
  if (totalAllocated > input.amount) {
    throw new Error("Allocated amount cannot exceed payment amount");
  }

  if (saleIds.length > 0) {
    const { data: salesRows, error: salesError } = await supabaseServer
      .from("sales")
      .select("id, sale_company_id, pending_amount")
      .in("id", saleIds);

    if (salesError) {
      throw new Error(`Failed to validate sale allocations: ${salesError.message}`);
    }

    const saleMap = new Map(
      ((salesRows as Array<{ id: string; sale_company_id: string | null; pending_amount: number | string }>) ?? [])
        .map((row) => [row.id, row])
    );

    if (saleMap.size !== saleIds.length) {
      throw new Error("Some selected sales for allocation were not found");
    }

    for (const saleId of saleIds) {
      const sale = saleMap.get(saleId);
      if (!sale || sale.sale_company_id !== input.company_id) {
        throw new Error("Allocation sales must belong to the selected company");
      }
    }

    const { data: existingAllocRows, error: existingAllocError } = await supabaseServer
      .from("company_payment_allocations")
      .select("sale_id, amount")
      .in("sale_id", saleIds);

    if (existingAllocError) {
      throw new Error(`Failed to validate existing allocations: ${existingAllocError.message}`);
    }

    const allocatedBySale = new Map<string, number>();
    for (const row of (existingAllocRows as Array<{ sale_id: string; amount: number | string }>) ?? []) {
      allocatedBySale.set(row.sale_id, (allocatedBySale.get(row.sale_id) ?? 0) + Number(row.amount || 0));
    }

    for (const alloc of allocations) {
      const sale = saleMap.get(alloc.sale_id);
      if (!sale) continue;
      const salePending = Number(sale.pending_amount || 0);
      const alreadyAllocated = allocatedBySale.get(alloc.sale_id) ?? 0;
      const remaining = Math.max(salePending - alreadyAllocated, 0);
      if (alloc.amount > remaining) {
        throw new Error(`Allocation exceeds remaining pending for bill ${alloc.sale_id}`);
      }
    }
  }

  const paymentId = input.id ?? crypto.randomUUID();
  const payload = {
    id: paymentId,
    company_id: input.company_id,
    paid_on: input.paid_on,
    amount: input.amount,
    note: input.note || "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("company_payments")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create company payment: ${error.message}`);
  }

  let createdAllocations: CompanyPaymentAllocation[] = [];
  if (allocations.length > 0) {
    const allocationPayload = allocations.map((item) => ({
      id: crypto.randomUUID(),
      payment_id: paymentId,
      sale_id: item.sale_id,
      amount: item.amount,
      updated_at: new Date().toISOString(),
    }));

    const { data: allocData, error: allocError } = await supabaseServer
      .from("company_payment_allocations")
      .insert(allocationPayload)
      .select("*");

    if (allocError) {
      await supabaseServer.from("company_payments").delete().eq("id", paymentId);
      throw new Error(`Failed to create payment allocations: ${allocError.message}`);
    }

    createdAllocations = (allocData as CompanyPaymentAllocationRow[]).map(
      toCompanyPaymentAllocation
    );
  }

  return { payment: toCompanyPayment(data as CompanyPaymentRow), allocations: createdAllocations };
}

export async function deleteCompanyPayment(id: string): Promise<void> {
  await assertAdminAccess();
  const { error } = await supabaseServer.from("company_payments").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete company payment: ${error.message}`);
  }
}
