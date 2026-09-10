import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import {
  soyaCompanyTypeEnum,
  type SoyaCompany,
  type SoyaCompanyInput,
  type SoyaCompanyType,
} from "@/features/soya-companies/schemas";

const TABLE = "soya_companies";

type SoyaCompanyRow = {
  id: string;
  type: SoyaCompanyType;
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
  is_active: boolean | null;
  is_default: boolean | null;
  created_at?: string;
  updated_at?: string;
};

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toSoyaCompany(row: SoyaCompanyRow): SoyaCompany {
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
    is_active: row.is_active ?? true,
    is_default: row.is_default ?? false,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getSoyaCompanies(
  type?: SoyaCompanyType,
): Promise<SoyaCompany[]> {
  let query = supabaseServer
    .from(TABLE)
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  if (type) {
    query = query.eq("type", type);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load soya companies: ${error.message}`);
  }
  return ((data as SoyaCompanyRow[]) ?? []).map(toSoyaCompany);
}

export async function getSoyaCompanyById(id: string): Promise<SoyaCompany | null> {
  const { data, error } = await supabaseServer
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load soya company: ${error.message}`);
  }
  return data ? toSoyaCompany(data as SoyaCompanyRow) : null;
}

function buildPayload(input: SoyaCompanyInput) {
  const type = soyaCompanyTypeEnum.parse(input.type);
  const name = normalizeName(input.name);
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
  return payload;
}

export async function createSoyaCompany(
  input: SoyaCompanyInput,
): Promise<SoyaCompany> {
  await requireRole(["admin"]);

  const payload = buildPayload(input);
  const { data, error } = await supabaseServer
    .from(TABLE)
    .insert({ ...payload, id: input.id ?? crypto.randomUUID() })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`A ${payload.type} named "${payload.name}" already exists`);
    }
    throw new Error(`Failed to create soya company: ${error.message}`);
  }
  return toSoyaCompany(data as SoyaCompanyRow);
}

export async function updateSoyaCompany(
  id: string,
  input: SoyaCompanyInput,
): Promise<SoyaCompany> {
  await requireRole(["admin"]);

  const payload = buildPayload(input);

  const { data, error } = await supabaseServer
    .from(TABLE)
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`A ${payload.type} named "${payload.name}" already exists`);
    }
    throw new Error(`Failed to update soya company: ${error.message}`);
  }
  return toSoyaCompany(data as SoyaCompanyRow);
}

export type DeleteSoyaCompanyResult = {
  status: "deleted" | "deactivated";
  message: string;
};

/**
 * Deletes a party, or deactivates it when it still has records against it —
 * same policy as the maize company service, so history is never orphaned.
 */
export async function deleteSoyaCompany(
  id: string,
): Promise<DeleteSoyaCompanyResult> {
  await requireRole(["admin"]);

  // Counted as separate equality filters rather than an interpolated .or()
  // string, so the id can never be read as PostgREST filter syntax.
  const countLinked = async (table: string, column: string) =>
    supabaseServer
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq(column, id);

  const [purchasesAsParty, purchasesAsIssuer, salesAsParty, salesAsIssuer] =
    await Promise.all([
      countLinked("soya_purchases", "sale_company_id"),
      countLinked("soya_purchases", "issuer_company_id"),
      countLinked("soya_sales", "sale_company_id"),
      countLinked("soya_sales", "issuer_company_id"),
    ]);

  // soya_sales lands with the Soya Sales module; until then its errors are
  // ignored (a missing table simply contributes no links).
  if (purchasesAsParty.error || purchasesAsIssuer.error) {
    throw new Error(
      `Failed to validate soya company delete: ${
        purchasesAsParty.error?.message ?? purchasesAsIssuer.error?.message
      }`,
    );
  }

  const hasLinkedData =
    (purchasesAsParty.count ?? 0) > 0 ||
    (purchasesAsIssuer.count ?? 0) > 0 ||
    (salesAsParty.count ?? 0) > 0 ||
    (salesAsIssuer.count ?? 0) > 0;

  if (hasLinkedData) {
    const { error } = await supabaseServer
      .from(TABLE)
      .update({
        is_active: false,
        is_default: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to deactivate soya company: ${error.message}`);
    }
    return {
      status: "deactivated",
      message:
        "This party has linked records. It was deactivated instead of deleted.",
    };
  }

  const { error } = await supabaseServer.from(TABLE).delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete soya company: ${error.message}`);
  }
  return { status: "deleted", message: "Party deleted successfully." };
}

/** Finds a party by name within its type, creating it if it's new. */
export async function upsertSoyaCompanyByName(
  rawName: string,
  type: Extract<SoyaCompanyType, "buyer" | "supplier">,
): Promise<SoyaCompany | null> {
  const name = normalizeName(rawName);
  if (!name) return null;

  const existing = await supabaseServer
    .from(TABLE)
    .select("*")
    .eq("type", type)
    .ilike("name", name)
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    throw new Error(`Failed to lookup soya ${type}: ${existing.error.message}`);
  }
  if (existing.data) {
    return toSoyaCompany(existing.data as SoyaCompanyRow);
  }

  const inserted = await supabaseServer
    .from(TABLE)
    .insert({
      id: crypto.randomUUID(),
      type,
      name,
      display_name: name,
      is_active: true,
      is_default: false,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (inserted.error) {
    throw new Error(`Failed to create soya ${type}: ${inserted.error.message}`);
  }
  return toSoyaCompany(inserted.data as SoyaCompanyRow);
}
