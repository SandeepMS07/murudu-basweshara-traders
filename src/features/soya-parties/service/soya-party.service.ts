import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { selectAll } from "@/lib/supabase/select-all";
import {
  companyScopeFilter,
  getSoyaCompanyScopeFor,
  type SoyaCompanyScope,
} from "@/features/soya/lib/company-scope";
import { getFinancialYearBounds } from "@/lib/financial-year";
import { calculateSoyaPartyEntry } from "@/features/soya-parties/utils/calculations";
import type {
  SoyaParty,
  SoyaPartyEntry,
  SoyaPartyEntryInput,
  SoyaPartyPayment,
  SoyaPartyPaymentInput,
} from "@/features/soya-parties/schemas";

/**
 * Soya Parties (sell side) data access.
 *
 * Soya is admin-only, so writes are gated on requireRole(["admin"]) rather than
 * the per-module permission map — no "soya" key is added to MODULES. Reads are
 * gated by the page guard (requireSoyaAdminPage).
 *
 * Every read and write is scoped to one Soya company (see company-scope.ts):
 * masters, entries and bill numbers are per company, and payments follow the
 * company of the party they were received from.
 *
 * Nothing here reads or writes a maize table.
 */
const MASTER = "soya_parties";
const ENTRIES = "soya_party_entries";
const PAYMENTS = "soya_party_payments";

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

type Row = Record<string, unknown>;

function toEntry(row: Row): SoyaPartyEntry {
  return {
    id: String(row.id),
    sl_no:
      row.sl_no === null || row.sl_no === undefined
        ? null
        : Math.trunc(n(row.sl_no as number)),
    date: String(row.date),
    bill_no: s(row.bill_no as string),
    lorry_no: s(row.lorry_no as string),
    bags: n(row.bags as number),
    net_wt: n(row.net_wt as number),
    rate: n(row.rate as number),
    amount: n(row.amount as number),
    cgst: n(row.cgst as number),
    sgst: n(row.sgst as number),
    tcs: n(row.tcs as number),
    total_amount: n(row.total_amount as number),
    freight: n(row.freight as number),
    fright: n(row.fright as number),
    party: s(row.party as string),
    factory: s(row.factory as string),
    company_id: s(row.company_id as string),
  };
}

const MASTER_COLUMNS = "id, name, company_id";

function toParty(row: Row): SoyaParty {
  return {
    id: String(row.id),
    name: String(row.name),
    company_id: (row.company_id as string | null) ?? null,
  };
}

function toPayment(row: Row): SoyaPartyPayment {
  return {
    id: String(row.id),
    party_id: String(row.party_id),
    paid_on: String(row.paid_on),
    bank: s(row.bank as string),
    amount: n(row.amount as number),
    remarks: s(row.remarks as string),
    created_at: (row.created_at as string) ?? undefined,
    updated_at: (row.updated_at as string) ?? undefined,
  };
}

// -------------------------------------------------------------- party master

export async function getSoyaParties(
  scope: SoyaCompanyScope,
): Promise<SoyaParty[]> {
  const { data, error } = await supabaseServer
    .from(MASTER)
    .select(MASTER_COLUMNS)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .or(companyScopeFilter(scope));

  if (error) throw new Error(`Failed to load soya parties: ${error.message}`);
  return (data as Row[]).map(toParty);
}

export async function getSoyaPartyById(id: string): Promise<SoyaParty | null> {
  const { data, error } = await supabaseServer
    .from(MASTER)
    .select(MASTER_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load soya party: ${error.message}`);
  return data ? toParty(data as Row) : null;
}

/**
 * The scope's party with this name, if any. A name can exist twice in the
 * default company's scope — once assigned, once left over from before
 * companies — and the assigned one wins.
 */
async function findSoyaPartyByName(
  name: string,
  scope: SoyaCompanyScope,
): Promise<SoyaParty | null> {
  const { data, error } = await supabaseServer
    .from(MASTER)
    .select(`${MASTER_COLUMNS}, deleted_at`)
    .ilike("name", name.replace(/[\\%_]/g, "\\$&"))
    .or(companyScopeFilter(scope));

  if (error) throw new Error(`Failed to look up soya party: ${error.message}`);
  const rows = data as Row[];
  // A live row beats a deleted one; an assigned row beats an unassigned one.
  const rank = (row: Row) => (row.deleted_at ? 2 : 0) + (row.company_id ? 0 : 1);
  const best = [...rows].sort((a, b) => rank(a) - rank(b))[0];
  if (!best) return null;

  // Adding a name that was deleted brings the same record back, with its GST
  // details, instead of failing on the per-company unique name.
  if (best.deleted_at) {
    const { error: restoreError } = await supabaseServer
      .from(MASTER)
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq("id", String(best.id));
    if (restoreError) {
      throw new Error(`Failed to restore soya party: ${restoreError.message}`);
    }
  }
  return toParty(best);
}

/** Finds a party by name within the company, creating it if it's new. */
export async function upsertSoyaPartyByName(
  rawName: string,
  scope: SoyaCompanyScope,
): Promise<SoyaParty | null> {
  const name = normalizeName(rawName);
  if (!name) return null;

  const existing = await findSoyaPartyByName(name, scope);
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
    if (error.code === "23505") return findSoyaPartyByName(name, scope);
    throw new Error(`Failed to create soya party: ${error.message}`);
  }

  return toParty(data as Row);
}

export async function createSoyaParty(
  name: string,
  scope: SoyaCompanyScope,
): Promise<SoyaParty> {
  await requireRole(["admin"]);
  const party = await upsertSoyaPartyByName(name, scope);
  if (!party) throw new Error("Party name is required");
  return party;
}

export async function updateSoyaParty(
  id: string,
  rawName: string,
): Promise<SoyaParty> {
  await requireRole(["admin"]);

  const existing = await getSoyaPartyById(id);
  if (!existing) throw new Error("Party not found");

  const name = normalizeName(rawName);
  if (!name) throw new Error("Party name is required");

  const { data, error } = await supabaseServer
    .from(MASTER)
    .update({ name, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(MASTER_COLUMNS)
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Party name already exists");
    throw new Error(`Failed to update soya party: ${error.message}`);
  }

  // Entries denormalize the party name, so a rename has to follow through —
  // within this party's company only; another firm's same-named party is a
  // different party.
  if (existing.name !== name) {
    const scope = await getSoyaCompanyScopeFor(existing.company_id);
    const { error: cascadeError } = await supabaseServer
      .from(ENTRIES)
      .update({ party: name, updated_at: new Date().toISOString() })
      .eq("party", existing.name)
      .or(companyScopeFilter(scope));
    if (cascadeError) {
      throw new Error(
        `Party renamed but its entries could not be updated: ${cascadeError.message}`,
      );
    }
  }

  return toParty(data as Row);
}

export async function deleteSoyaParty(id: string): Promise<void> {
  await requireRole(["admin"]);

  const existing = await getSoyaPartyById(id);
  if (!existing) throw new Error("Party not found");

  const scope = await getSoyaCompanyScopeFor(existing.company_id);
  const { count, error: countError } = await supabaseServer
    .from(ENTRIES)
    .select("id", { head: true, count: "exact" })
    .eq("party", existing.name)
    .or(companyScopeFilter(scope));
  if (countError) {
    throw new Error(`Failed to check soya party usage: ${countError.message}`);
  }
  if ((count ?? 0) > 0) {
    throw new Error(
      `Cannot delete ${existing.name}: it still has ${count} entr${count === 1 ? "y" : "ies"}.`,
    );
  }

  const { error } = await supabaseServer.from(MASTER).delete().eq("id", id);
  if (error) throw new Error(`Failed to delete soya party: ${error.message}`);
}

// ------------------------------------------------------------- party entries

export async function getSoyaPartyEntries(
  scope: SoyaCompanyScope,
): Promise<SoyaPartyEntry[]> {
  // Paged: a single response is capped at 1000 rows and truncates silently.
  try {
    const data = await selectAll<Row>((from, to) =>
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
      `Failed to load soya party entries: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function getSoyaPartyEntryById(
  id: string,
): Promise<SoyaPartyEntry | null> {
  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load soya party entry: ${error.message}`);
  }
  return data ? toEntry(data as Row) : null;
}

/**
 * Next SL NO and BILL NO within the company and the financial year the given
 * date falls in.
 * BILL NO is text (the workbook opens a year with "29*1"), so the suggestion is
 * derived from the numeric bill numbers only and non-numeric ones are ignored.
 */
export async function getNextSoyaPartyIdentifiers(
  scope: SoyaCompanyScope,
  date?: string,
): Promise<{ nextSlNo: number; nextBillNo: string }> {
  const { start, end } = getFinancialYearBounds(
    date && date.trim() ? date : new Date(),
  );

  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .select("sl_no, bill_no")
    .or(companyScopeFilter(scope))
    .gte("date", start)
    .lte("date", end);

  if (error) {
    throw new Error(
      `Failed to load next soya party identifiers: ${error.message}`,
    );
  }

  const rows = (data ?? []) as Array<{
    sl_no: number | string | null;
    bill_no: string | null;
  }>;

  let maxSlNo = 0;
  let maxBillNo = 0;
  for (const row of rows) {
    maxSlNo = Math.max(maxSlNo, Math.trunc(n(row.sl_no)));
    const billNo = Number.parseInt(String(row.bill_no ?? "").trim(), 10);
    if (Number.isFinite(billNo)) maxBillNo = Math.max(maxBillNo, billNo);
  }

  return {
    nextSlNo: Math.max(maxSlNo + 1, 1),
    nextBillNo: String(Math.max(maxBillNo + 1, 1)),
  };
}

/** BILL NO is unique per company per financial year; the pre-submit check. */
export async function isSoyaPartyBillNoAvailable(
  scope: SoyaCompanyScope,
  billNo: string,
  date: string,
  excludeId?: string,
): Promise<boolean> {
  const trimmed = billNo.trim();
  if (!trimmed) return true;

  const { start, end } = getFinancialYearBounds(
    date && date.trim() ? date : new Date(),
  );

  let query = supabaseServer
    .from(ENTRIES)
    .select("id")
    .or(companyScopeFilter(scope))
    .eq("bill_no", trimmed)
    .gte("date", start)
    .lte("date", end)
    .limit(1);

  if (excludeId) query = query.neq("id", excludeId);

  const { data, error } = await query.maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new Error(
      `Failed to validate soya party bill no: ${error.message}`,
    );
  }
  return !data;
}

function buildEntryPayload(entry: SoyaPartyEntry) {
  return {
    company_id: entry.company_id || null,
    sl_no: entry.sl_no,
    date: entry.date,
    bill_no: entry.bill_no,
    lorry_no: entry.lorry_no,
    bags: entry.bags,
    net_wt: entry.net_wt,
    rate: entry.rate,
    amount: entry.amount,
    cgst: entry.cgst,
    sgst: entry.sgst,
    tcs: entry.tcs,
    total_amount: entry.total_amount,
    freight: entry.freight,
    fright: entry.fright,
    party: entry.party,
    factory: entry.factory,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Saves an entry into `scope`'s company: its party is found or created there,
 * and its bill number is checked against that company's series. The database
 * index cannot see an unassigned row as the default company's, so the check is
 * made here too.
 */
async function saveSoyaPartyEntry(
  id: string,
  input: SoyaPartyEntryInput,
  scope: SoyaCompanyScope,
  mode: "insert" | "update",
): Promise<SoyaPartyEntry> {
  const party = normalizeName(input.party);
  if (!party) throw new Error("Party is required");

  const available = await isSoyaPartyBillNoAvailable(
    scope,
    input.bill_no,
    input.date,
    mode === "update" ? id : undefined,
  );
  if (!available) {
    throw new Error("Bill no already exists for this company in this financial year");
  }

  await upsertSoyaPartyByName(party, scope);

  const calculated = calculateSoyaPartyEntry(
    { ...input, party, company_id: scope.companyId },
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
    if (error.code === "23505" && String(error.message).includes("bill_no")) {
      throw new Error("Bill no already exists for this company in this financial year");
    }
    throw new Error(`Failed to ${mode === "insert" ? "create" : "update"} soya party entry: ${error.message}`);
  }
  return toEntry(data as Row);
}

/** `input.company_id` wins; otherwise the entry goes to `activeScope`. */
export async function createSoyaPartyEntry(
  input: SoyaPartyEntryInput,
  activeScope: SoyaCompanyScope,
): Promise<SoyaPartyEntry> {
  await requireRole(["admin"]);
  const scope = input.company_id
    ? await getSoyaCompanyScopeFor(input.company_id)
    : activeScope;
  return saveSoyaPartyEntry(crypto.randomUUID(), input, scope, "insert");
}

/**
 * `input.company_id` moves the entry; otherwise it stays in its own company
 * (an unassigned entry is given the default company's id).
 */
export async function updateSoyaPartyEntry(
  id: string,
  input: SoyaPartyEntryInput,
): Promise<SoyaPartyEntry> {
  await requireRole(["admin"]);

  const existing = await getSoyaPartyEntryById(id);
  if (!existing) throw new Error("Entry not found");

  const scope = await getSoyaCompanyScopeFor(input.company_id || existing.company_id);
  return saveSoyaPartyEntry(id, input, scope, "update");
}

export async function deleteSoyaPartyEntry(id: string): Promise<void> {
  await requireRole(["admin"]);

  const { error } = await supabaseServer.from(ENTRIES).delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete soya party entry: ${error.message}`);
  }
}

// ------------------------------------------------------------ party payments

/**
 * Payments carry no company of their own: each belongs to the company of the
 * party it was received from. With `partyId`, that party's payments only.
 */
export async function getSoyaPartyPayments(
  scope: SoyaCompanyScope,
  partyId?: string,
): Promise<SoyaPartyPayment[]> {
  // Paged: a single response is capped at 1000 rows and truncates silently.
  try {
    const data = await selectAll<Row>((from, to) => {
      let query = supabaseServer
        .from(PAYMENTS)
        .select("*")
        .order("paid_on", { ascending: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to);
      if (partyId) query = query.eq("party_id", partyId);
      return query;
    });
    const payments = data.map(toPayment);
    if (partyId) return payments;

    const partyIds = new Set((await getSoyaParties(scope)).map((party) => party.id));
    return payments.filter((payment) => partyIds.has(payment.party_id));
  } catch (error) {
    throw new Error(
      `Failed to load soya party payments: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function createSoyaPartyPayment(
  input: SoyaPartyPaymentInput,
): Promise<SoyaPartyPayment> {
  await requireRole(["admin"]);

  const { data, error } = await supabaseServer
    .from(PAYMENTS)
    .insert({
      id: input.id ?? crypto.randomUUID(),
      party_id: input.party_id,
      paid_on: input.paid_on,
      bank: input.bank,
      amount: input.amount,
      remarks: input.remarks,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create soya party payment: ${error.message}`);
  }
  return toPayment(data as Row);
}

export async function deleteSoyaPartyPayment(id: string): Promise<void> {
  await requireRole(["admin"]);

  const { error } = await supabaseServer.from(PAYMENTS).delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete soya party payment: ${error.message}`);
  }
}
