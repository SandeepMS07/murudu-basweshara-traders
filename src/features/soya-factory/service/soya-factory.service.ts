import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { getFinancialYearBounds } from "@/lib/financial-year";
import { calculateSoyaFactoryEntry } from "@/features/soya-factory/utils/calculations";
import type {
  SoyaFactory,
  SoyaFactoryEntry,
  SoyaFactoryEntryInput,
  SoyaFactoryPayment,
  SoyaFactoryPaymentInput,
} from "@/features/soya-factory/schemas";

/**
 * Soya Factory (buy side) data access.
 *
 * Soya is admin-only, so writes are gated on requireRole(["admin"]) rather than
 * the per-module permission map — no "soya" key is added to MODULES. Reads are
 * gated by the page guard (requireSoyaAdminPage).
 *
 * Nothing here reads or writes a maize table.
 */
const MASTER = "soya_factories";
const ENTRIES = "soya_factory_entries";
const PAYMENTS = "soya_factory_payments";

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

type EntryRow = Record<string, unknown>;

function toEntry(row: EntryRow): SoyaFactoryEntry {
  return {
    id: String(row.id),
    sl_no: row.sl_no === null || row.sl_no === undefined ? null : Math.trunc(n(row.sl_no as number)),
    factory: s(row.factory as string),
    date: String(row.date),
    pb_no: s(row.pb_no as string),
    lorry: s(row.lorry as string),
    bags: n(row.bags as number),
    weight: n(row.weight as number),
    rate: n(row.rate as number),
    amount: n(row.amount as number),
    gst_amount: n(row.gst_amount as number),
    tcs: n(row.tcs as number),
    total_amount: n(row.total_amount as number),
    party: s(row.party as string),
  };
}

function toFactory(row: EntryRow): SoyaFactory {
  return { id: String(row.id), name: String(row.name) };
}

function toPayment(row: EntryRow): SoyaFactoryPayment {
  return {
    id: String(row.id),
    factory_id: String(row.factory_id),
    paid_on: String(row.paid_on),
    bank: s(row.bank as string),
    amount: n(row.amount as number),
    created_at: (row.created_at as string) ?? undefined,
    updated_at: (row.updated_at as string) ?? undefined,
  };
}

// ------------------------------------------------------------ factory master

export async function getSoyaFactories(): Promise<SoyaFactory[]> {
  const { data, error } = await supabaseServer
    .from(MASTER)
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load soya factories: ${error.message}`);
  return (data as EntryRow[]).map(toFactory);
}

export async function getSoyaFactoryById(
  id: string,
): Promise<SoyaFactory | null> {
  const { data, error } = await supabaseServer
    .from(MASTER)
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load soya factory: ${error.message}`);
  return data ? toFactory(data as EntryRow) : null;
}

/** Finds a factory by name, creating it if it's new. */
export async function upsertSoyaFactoryByName(
  rawName: string,
): Promise<SoyaFactory | null> {
  const name = normalizeName(rawName);
  if (!name) return null;

  const { data: existing, error: lookupError } = await supabaseServer
    .from(MASTER)
    .select("id, name")
    .eq("name", name)
    .maybeSingle();

  if (lookupError && lookupError.code !== "PGRST116") {
    throw new Error(`Failed to look up soya factory: ${lookupError.message}`);
  }
  if (existing) return toFactory(existing as EntryRow);

  const { data, error } = await supabaseServer
    .from(MASTER)
    .insert({ id: crypto.randomUUID(), name, updated_at: new Date().toISOString() })
    .select("id, name")
    .single();

  if (error) {
    // Lost a race against a concurrent insert of the same name.
    if (error.code === "23505") {
      const { data: retry } = await supabaseServer
        .from(MASTER)
        .select("id, name")
        .eq("name", name)
        .maybeSingle();
      return retry ? toFactory(retry as EntryRow) : null;
    }
    throw new Error(`Failed to create soya factory: ${error.message}`);
  }

  return toFactory(data as EntryRow);
}

export async function createSoyaFactory(name: string): Promise<SoyaFactory> {
  await requireRole(["admin"]);
  const factory = await upsertSoyaFactoryByName(name);
  if (!factory) throw new Error("Factory name is required");
  return factory;
}

export async function updateSoyaFactory(
  id: string,
  rawName: string,
): Promise<SoyaFactory> {
  await requireRole(["admin"]);

  const existing = await getSoyaFactoryById(id);
  if (!existing) throw new Error("Factory not found");

  const name = normalizeName(rawName);
  if (!name) throw new Error("Factory name is required");

  const { data, error } = await supabaseServer
    .from(MASTER)
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Factory name already exists");
    throw new Error(`Failed to update soya factory: ${error.message}`);
  }

  // Entries denormalize the factory name, so a rename has to follow through.
  if (existing.name !== name) {
    const { error: cascadeError } = await supabaseServer
      .from(ENTRIES)
      .update({ factory: name, updated_at: new Date().toISOString() })
      .eq("factory", existing.name);
    if (cascadeError) {
      throw new Error(
        `Factory renamed but its entries could not be updated: ${cascadeError.message}`,
      );
    }
  }

  return toFactory(data as EntryRow);
}

export async function deleteSoyaFactory(id: string): Promise<void> {
  await requireRole(["admin"]);

  const existing = await getSoyaFactoryById(id);
  if (!existing) throw new Error("Factory not found");

  const { count, error: countError } = await supabaseServer
    .from(ENTRIES)
    .select("id", { head: true, count: "exact" })
    .eq("factory", existing.name);
  if (countError) {
    throw new Error(`Failed to check soya factory usage: ${countError.message}`);
  }
  if ((count ?? 0) > 0) {
    throw new Error(
      `Cannot delete ${existing.name}: it still has ${count} entr${count === 1 ? "y" : "ies"}.`,
    );
  }

  const { error } = await supabaseServer.from(MASTER).delete().eq("id", id);
  if (error) throw new Error(`Failed to delete soya factory: ${error.message}`);
}

// ----------------------------------------------------------- factory entries

export async function getSoyaFactoryEntries(): Promise<SoyaFactoryEntry[]> {
  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .select("*")
    .order("date", { ascending: false })
    .order("sl_no", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load soya factory entries: ${error.message}`);
  }
  return (data as EntryRow[]).map(toEntry);
}

export async function getSoyaFactoryEntryById(
  id: string,
): Promise<SoyaFactoryEntry | null> {
  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load soya factory entry: ${error.message}`);
  }
  return data ? toEntry(data as EntryRow) : null;
}

/** Next SL NO within the financial year the given date falls in. */
export async function getNextSoyaFactorySlNo(date?: string): Promise<number> {
  const { start, end } = getFinancialYearBounds(
    date && date.trim() ? date : new Date(),
  );
  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .select("sl_no")
    .gte("date", start)
    .lte("date", end)
    .order("sl_no", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load next soya factory SL NO: ${error.message}`);
  }
  return Math.max(Math.trunc(n((data as { sl_no?: number } | null)?.sl_no)) + 1, 1);
}

function buildEntryPayload(entry: SoyaFactoryEntry) {
  return {
    sl_no: entry.sl_no,
    factory: entry.factory,
    date: entry.date,
    pb_no: entry.pb_no,
    lorry: entry.lorry,
    bags: entry.bags,
    weight: entry.weight,
    rate: entry.rate,
    amount: entry.amount,
    gst_amount: entry.gst_amount,
    tcs: entry.tcs,
    total_amount: entry.total_amount,
    party: entry.party,
    updated_at: new Date().toISOString(),
  };
}

export async function createSoyaFactoryEntry(
  input: SoyaFactoryEntryInput,
): Promise<SoyaFactoryEntry> {
  await requireRole(["admin"]);

  const factory = normalizeName(input.factory);
  if (!factory) throw new Error("Factory is required");
  await upsertSoyaFactoryByName(factory);

  const calculated = calculateSoyaFactoryEntry(
    { ...input, factory },
    crypto.randomUUID(),
  );

  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .insert({ id: calculated.id, ...buildEntryPayload(calculated) })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create soya factory entry: ${error.message}`);
  }
  return toEntry(data as EntryRow);
}

export async function updateSoyaFactoryEntry(
  id: string,
  input: SoyaFactoryEntryInput,
): Promise<SoyaFactoryEntry> {
  await requireRole(["admin"]);

  const existing = await getSoyaFactoryEntryById(id);
  if (!existing) throw new Error("Entry not found");

  const factory = normalizeName(input.factory);
  if (!factory) throw new Error("Factory is required");
  await upsertSoyaFactoryByName(factory);

  const calculated = calculateSoyaFactoryEntry({ ...input, factory }, id);

  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .update(buildEntryPayload(calculated))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update soya factory entry: ${error.message}`);
  }
  return toEntry(data as EntryRow);
}

export async function deleteSoyaFactoryEntry(id: string): Promise<void> {
  await requireRole(["admin"]);

  const { error } = await supabaseServer.from(ENTRIES).delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete soya factory entry: ${error.message}`);
  }
}

// ---------------------------------------------------------- factory payments

export async function getSoyaFactoryPayments(
  factoryId?: string,
): Promise<SoyaFactoryPayment[]> {
  let query = supabaseServer
    .from(PAYMENTS)
    .select("*")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (factoryId) query = query.eq("factory_id", factoryId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load soya factory payments: ${error.message}`);
  }
  return (data as EntryRow[]).map(toPayment);
}

export async function createSoyaFactoryPayment(
  input: SoyaFactoryPaymentInput,
): Promise<SoyaFactoryPayment> {
  await requireRole(["admin"]);

  const { data, error } = await supabaseServer
    .from(PAYMENTS)
    .insert({
      id: input.id ?? crypto.randomUUID(),
      factory_id: input.factory_id,
      paid_on: input.paid_on,
      bank: input.bank,
      amount: input.amount,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create soya factory payment: ${error.message}`);
  }
  return toPayment(data as EntryRow);
}

export async function deleteSoyaFactoryPayment(id: string): Promise<void> {
  await requireRole(["admin"]);

  const { error } = await supabaseServer.from(PAYMENTS).delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete soya factory payment: ${error.message}`);
  }
}
