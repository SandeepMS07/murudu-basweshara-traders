import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { selectAll } from "@/lib/supabase/select-all";
import {
  companyScopeFilter,
  getSoyaCompanyScopeFor,
  type SoyaCompanyScope,
} from "@/features/soya/lib/company-scope";
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
 * Every read and write is scoped to one Soya company (see company-scope.ts):
 * masters and entries are per company, and payments follow the company of the
 * factory they were made to.
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
    company_id: s(row.company_id as string),
  };
}

const MASTER_COLUMNS = "id, name, company_id";

function toFactory(row: EntryRow): SoyaFactory {
  return {
    id: String(row.id),
    name: String(row.name),
    company_id: (row.company_id as string | null) ?? null,
  };
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

export async function getSoyaFactories(
  scope: SoyaCompanyScope,
): Promise<SoyaFactory[]> {
  const { data, error } = await supabaseServer
    .from(MASTER)
    .select(MASTER_COLUMNS)
    .order("name", { ascending: true })
    .or(companyScopeFilter(scope));

  if (error) throw new Error(`Failed to load soya factories: ${error.message}`);
  return (data as EntryRow[]).map(toFactory);
}

export async function getSoyaFactoryById(
  id: string,
): Promise<SoyaFactory | null> {
  const { data, error } = await supabaseServer
    .from(MASTER)
    .select(MASTER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load soya factory: ${error.message}`);
  return data ? toFactory(data as EntryRow) : null;
}

/**
 * The scope's factory with this name, if any. A name can exist twice in the
 * default company's scope — once assigned, once left over from before
 * companies — and the assigned one wins.
 */
async function findSoyaFactoryByName(
  name: string,
  scope: SoyaCompanyScope,
): Promise<SoyaFactory | null> {
  const { data, error } = await supabaseServer
    .from(MASTER)
    .select(MASTER_COLUMNS)
    .ilike("name", name.replace(/[\\%_]/g, "\\$&"))
    .or(companyScopeFilter(scope));

  if (error) throw new Error(`Failed to look up soya factory: ${error.message}`);
  const rows = (data as EntryRow[]).map(toFactory);
  return rows.find((row) => row.company_id) ?? rows[0] ?? null;
}

/** Finds a factory by name within the company, creating it if it's new. */
export async function upsertSoyaFactoryByName(
  rawName: string,
  scope: SoyaCompanyScope,
): Promise<SoyaFactory | null> {
  const name = normalizeName(rawName);
  if (!name) return null;

  const existing = await findSoyaFactoryByName(name, scope);
  if (existing) return existing;

  const { data, error } = await supabaseServer
    .from(MASTER)
    .insert({
      id: crypto.randomUUID(),
      name,
      company_id: scope.companyId || null,
      updated_at: new Date().toISOString(),
    })
    .select(MASTER_COLUMNS)
    .single();

  if (error) {
    // Lost a race against a concurrent insert of the same name.
    if (error.code === "23505") return findSoyaFactoryByName(name, scope);
    throw new Error(`Failed to create soya factory: ${error.message}`);
  }

  return toFactory(data as EntryRow);
}

export async function createSoyaFactory(
  name: string,
  scope: SoyaCompanyScope,
): Promise<SoyaFactory> {
  await requireRole(["admin"]);
  const factory = await upsertSoyaFactoryByName(name, scope);
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
    .select(MASTER_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Factory name already exists");
    throw new Error(`Failed to update soya factory: ${error.message}`);
  }

  // Entries denormalize the factory name, so a rename has to follow through.
  if (existing.name !== name) {
    // Within this factory's company only; another firm's same-named factory
    // is a different factory.
    const scope = await getSoyaCompanyScopeFor(existing.company_id);
    const { error: cascadeError } = await supabaseServer
      .from(ENTRIES)
      .update({ factory: name, updated_at: new Date().toISOString() })
      .eq("factory", existing.name)
      .or(companyScopeFilter(scope));
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

  const scope = await getSoyaCompanyScopeFor(existing.company_id);
  const { count, error: countError } = await supabaseServer
    .from(ENTRIES)
    .select("id", { head: true, count: "exact" })
    .eq("factory", existing.name)
    .or(companyScopeFilter(scope));
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

export async function getSoyaFactoryEntries(
  scope: SoyaCompanyScope,
): Promise<SoyaFactoryEntry[]> {
  // Paged: a single response is capped at 1000 rows and truncates silently.
  try {
    const data = await selectAll<EntryRow>((from, to) =>
      supabaseServer
        .from(ENTRIES)
        .select("*")
        .or(companyScopeFilter(scope))
        .order("date", { ascending: false })
        .order("sl_no", { ascending: false, nullsFirst: false })
        .order("id", { ascending: true })
        .range(from, to),
    );
    return data.map(toEntry);
  } catch (error) {
    throw new Error(
      `Failed to load soya factory entries: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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

/** Next SL NO within the company and the financial year the date falls in. */
export async function getNextSoyaFactorySlNo(
  scope: SoyaCompanyScope,
  date?: string,
): Promise<number> {
  const { start, end } = getFinancialYearBounds(
    date && date.trim() ? date : new Date(),
  );
  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .select("sl_no")
    .or(companyScopeFilter(scope))
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
    company_id: entry.company_id || null,
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

/** Saves an entry into `scope`'s company, finding or creating its factory there. */
async function saveSoyaFactoryEntry(
  id: string,
  input: SoyaFactoryEntryInput,
  scope: SoyaCompanyScope,
  mode: "insert" | "update",
): Promise<SoyaFactoryEntry> {
  const factory = normalizeName(input.factory);
  if (!factory) throw new Error("Factory is required");
  await upsertSoyaFactoryByName(factory, scope);

  const calculated = calculateSoyaFactoryEntry(
    { ...input, factory, company_id: scope.companyId },
    id,
  );
  const payload = buildEntryPayload(calculated);

  const { data, error } =
    mode === "insert"
      ? await supabaseServer
          .from(ENTRIES)
          .insert({ id, ...payload })
          .select("*")
          .single()
      : await supabaseServer
          .from(ENTRIES)
          .update(payload)
          .eq("id", id)
          .select("*")
          .single();

  if (error) {
    throw new Error(
      `Failed to ${mode === "insert" ? "create" : "update"} soya factory entry: ${error.message}`,
    );
  }
  return toEntry(data as EntryRow);
}

/** `input.company_id` wins; otherwise the entry goes to `activeScope`. */
export async function createSoyaFactoryEntry(
  input: SoyaFactoryEntryInput,
  activeScope: SoyaCompanyScope,
): Promise<SoyaFactoryEntry> {
  await requireRole(["admin"]);
  const scope = input.company_id
    ? await getSoyaCompanyScopeFor(input.company_id)
    : activeScope;
  return saveSoyaFactoryEntry(crypto.randomUUID(), input, scope, "insert");
}

/**
 * `input.company_id` moves the entry; otherwise it stays in its own company
 * (an unassigned entry is given the default company's id).
 */
export async function updateSoyaFactoryEntry(
  id: string,
  input: SoyaFactoryEntryInput,
): Promise<SoyaFactoryEntry> {
  await requireRole(["admin"]);

  const existing = await getSoyaFactoryEntryById(id);
  if (!existing) throw new Error("Entry not found");

  const scope = await getSoyaCompanyScopeFor(input.company_id || existing.company_id);
  return saveSoyaFactoryEntry(id, input, scope, "update");
}

export async function deleteSoyaFactoryEntry(id: string): Promise<void> {
  await requireRole(["admin"]);

  const { error } = await supabaseServer.from(ENTRIES).delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete soya factory entry: ${error.message}`);
  }
}

// ---------------------------------------------------------- factory payments

/**
 * Payments carry no company of their own: each belongs to the company of the
 * factory it was made to. With `factoryId`, that factory's payments only.
 */
export async function getSoyaFactoryPayments(
  scope: SoyaCompanyScope,
  factoryId?: string,
): Promise<SoyaFactoryPayment[]> {
  // Paged: a single response is capped at 1000 rows and truncates silently.
  try {
    const data = await selectAll<EntryRow>((from, to) => {
      let query = supabaseServer
        .from(PAYMENTS)
        .select("*")
        .order("paid_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (factoryId) query = query.eq("factory_id", factoryId);
      return query;
    });
    const payments = data.map(toPayment);
    if (factoryId) return payments;

    const factoryIds = new Set((await getSoyaFactories(scope)).map((factory) => factory.id));
    return payments.filter((payment) => factoryIds.has(payment.factory_id));
  } catch (error) {
    throw new Error(
      `Failed to load soya factory payments: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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
