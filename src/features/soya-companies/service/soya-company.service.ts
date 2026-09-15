import { randomUUID } from "crypto";

import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import {
  soyaCompanySchema,
  withDerivedStateCode,
  type SoyaCompany,
  type SoyaCompanyInput,
} from "@/features/soya-companies/schemas";

/**
 * Soya company master.
 *
 * Admin-only, like the rest of the Soya line: writes are gated on
 * requireRole(["admin"]) rather than the per-module permission map. Nothing
 * here reads or writes a maize table.
 */
const TABLE = "soya_companies";

function s(value: string | null | undefined): string {
  return value ?? "";
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toCompany(row: Record<string, unknown>): SoyaCompany {
  return {
    id: String(row.id),
    name: String(row.name),
    legal_name: s(row.legal_name as string),
    gstin: s(row.gstin as string),
    state_code: s(row.state_code as string),
    address: s(row.address as string),
    place: s(row.place as string),
    pincode: s(row.pincode as string),
    phone: s(row.phone as string),
    email: s(row.email as string),
    invoice_prefix: s(row.invoice_prefix as string),
    is_active: Boolean(row.is_active),
    is_default: Boolean(row.is_default),
    aato_over_10cr: Boolean(row.aato_over_10cr),
    created_at: (row.created_at as string) ?? undefined,
    updated_at: (row.updated_at as string) ?? undefined,
  };
}

export async function getSoyaCompanies(): Promise<SoyaCompany[]> {
  const { data, error } = await supabaseServer
    .from(TABLE)
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toCompany);
}

export async function getSoyaCompanyById(
  id: string,
): Promise<SoyaCompany | null> {
  const { data, error } = await supabaseServer
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCompany(data) : null;
}

/**
 * The company to open when none is chosen: the one flagged default, else the
 * first active one. Returns null when none exist yet, which the UI turns into
 * a "create your first company" prompt rather than an error.
 */
export async function getDefaultSoyaCompany(): Promise<SoyaCompany | null> {
  const companies = await getSoyaCompanies();
  const active = companies.filter((company) => company.is_active);
  return active.find((company) => company.is_default) ?? active[0] ?? null;
}

/** Only one company can be the default, so clear the flag on the others. */
async function clearOtherDefaults(keepId: string): Promise<void> {
  const { error } = await supabaseServer
    .from(TABLE)
    .update({ is_default: false, updated_at: new Date().toISOString() })
    .neq("id", keepId)
    .eq("is_default", true);
  if (error) throw new Error(error.message);
}

export async function createSoyaCompany(
  input: SoyaCompanyInput,
): Promise<SoyaCompany> {
  await requireRole(["admin"]);
  const parsed = soyaCompanySchema.parse(withDerivedStateCode(input));
  const name = normalizeName(parsed.name);

  const existing = await getSoyaCompanies();
  if (existing.some((company) => company.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`A company named "${name}" already exists`);
  }
  if (parsed.gstin && existing.some((company) => company.gstin === parsed.gstin)) {
    throw new Error(`GSTIN ${parsed.gstin} is already used by another company`);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  // The first company created is the default, so the switcher always resolves.
  const isDefault = parsed.is_default || existing.length === 0;

  const { data, error } = await supabaseServer
    .from(TABLE)
    .insert({
      id,
      name,
      legal_name: parsed.legal_name,
      gstin: parsed.gstin,
      state_code: parsed.state_code,
      address: parsed.address,
      place: parsed.place,
      pincode: parsed.pincode,
      phone: parsed.phone,
      email: parsed.email,
      invoice_prefix: parsed.invoice_prefix.toUpperCase(),
      is_active: parsed.is_active,
      is_default: isDefault,
      aato_over_10cr: parsed.aato_over_10cr,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (isDefault) await clearOtherDefaults(id);
  return toCompany(data);
}

export async function updateSoyaCompany(
  id: string,
  input: SoyaCompanyInput,
): Promise<SoyaCompany> {
  await requireRole(["admin"]);
  const parsed = soyaCompanySchema.parse(withDerivedStateCode(input));
  const name = normalizeName(parsed.name);

  const existing = await getSoyaCompanies();
  if (
    existing.some(
      (company) =>
        company.id !== id && company.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new Error(`A company named "${name}" already exists`);
  }
  if (
    parsed.gstin &&
    existing.some((company) => company.id !== id && company.gstin === parsed.gstin)
  ) {
    throw new Error(`GSTIN ${parsed.gstin} is already used by another company`);
  }

  const { data, error } = await supabaseServer
    .from(TABLE)
    .update({
      name,
      legal_name: parsed.legal_name,
      gstin: parsed.gstin,
      state_code: parsed.state_code,
      address: parsed.address,
      place: parsed.place,
      pincode: parsed.pincode,
      phone: parsed.phone,
      email: parsed.email,
      invoice_prefix: parsed.invoice_prefix.toUpperCase(),
      is_active: parsed.is_active,
      is_default: parsed.is_default,
      aato_over_10cr: parsed.aato_over_10cr,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (parsed.is_default) await clearOtherDefaults(id);
  return toCompany(data);
}

/**
 * Refuses while anything still points at the company. The FKs are ON DELETE
 * RESTRICT, so the database would refuse anyway — this turns that into a
 * message that says which records are in the way.
 */
export async function deleteSoyaCompany(id: string): Promise<void> {
  await requireRole(["admin"]);

  const counts = await Promise.all(
    (["soya_factories", "soya_parties", "soya_factory_entries", "soya_party_entries"] as const).map(
      async (table) => {
        const { count, error } = await supabaseServer
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("company_id", id);
        if (error) throw new Error(error.message);
        return { table, count: count ?? 0 };
      },
    ),
  );

  const blocking = counts.filter((row) => row.count > 0);
  if (blocking.length > 0) {
    const detail = blocking
      .map((row) => `${row.count} in ${row.table.replace("soya_", "")}`)
      .join(", ");
    throw new Error(`Cannot delete: ${detail}. Move or remove them first.`);
  }

  const { error } = await supabaseServer.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
