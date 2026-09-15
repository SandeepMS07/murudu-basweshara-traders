import { randomUUID } from "crypto";

import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { soyaItemSchema, type SoyaItem, type SoyaItemInput } from "@/features/soya-invoices/schemas";

/**
 * Soya item master — what we sell, with the HSN code the e-Invoice portal
 * demands on every line.
 *
 * Admin-only like the rest of the Soya line. Nothing here reads or writes a
 * maize table.
 */
const TABLE = "soya_items";

/** PostgREST returns numeric columns as strings. */
function n(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function s(value: string | null | undefined): string {
  return value ?? "";
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toItem(row: Record<string, unknown>): SoyaItem {
  return {
    id: String(row.id),
    company_id: s(row.company_id as string),
    name: String(row.name),
    hsn: s(row.hsn as string),
    unit: s(row.unit as string) || "MTS",
    gst_rate: n(row.gst_rate as number),
    default_rate: n(row.default_rate as number),
    description: s(row.description as string),
    is_active: Boolean(row.is_active),
    created_at: (row.created_at as string) ?? undefined,
    updated_at: (row.updated_at as string) ?? undefined,
  };
}

export async function getSoyaItems(companyId?: string): Promise<SoyaItem[]> {
  let query = supabaseServer.from(TABLE).select("*").order("name", { ascending: true });
  if (companyId) query = query.eq("company_id", companyId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toItem);
}

export async function getSoyaItemById(id: string): Promise<SoyaItem | null> {
  const { data, error } = await supabaseServer
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toItem(data) : null;
}

export async function createSoyaItem(input: SoyaItemInput): Promise<SoyaItem> {
  await requireRole(["admin"]);
  const parsed = soyaItemSchema.parse(input);
  const name = normalizeName(parsed.name);

  const existing = await getSoyaItems(parsed.company_id);
  if (existing.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
    throw new Error(`An item named "${name}" already exists for this company`);
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseServer
    .from(TABLE)
    .insert({
      id: randomUUID(),
      company_id: parsed.company_id,
      name,
      hsn: parsed.hsn,
      unit: parsed.unit,
      gst_rate: parsed.gst_rate,
      default_rate: parsed.default_rate,
      description: parsed.description,
      is_active: parsed.is_active,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toItem(data);
}

export async function updateSoyaItem(id: string, input: SoyaItemInput): Promise<SoyaItem> {
  await requireRole(["admin"]);
  const parsed = soyaItemSchema.parse(input);
  const name = normalizeName(parsed.name);

  const existing = await getSoyaItems(parsed.company_id);
  if (
    existing.some(
      (item) => item.id !== id && item.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new Error(`An item named "${name}" already exists for this company`);
  }

  const { data, error } = await supabaseServer
    .from(TABLE)
    .update({
      company_id: parsed.company_id,
      name,
      hsn: parsed.hsn,
      unit: parsed.unit,
      gst_rate: parsed.gst_rate,
      default_rate: parsed.default_rate,
      description: parsed.description,
      is_active: parsed.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return toItem(data);
}

/**
 * Deleting an item does NOT rewrite invoices that used it — the line carries
 * its own snapshot of the name, HSN and unit, and the foreign key is
 * ON DELETE SET NULL. So this is safe even for an item that has been sold.
 * Deactivating is still the better move, and what the UI nudges towards.
 */
export async function deleteSoyaItem(id: string): Promise<void> {
  await requireRole(["admin"]);
  const { error } = await supabaseServer.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
