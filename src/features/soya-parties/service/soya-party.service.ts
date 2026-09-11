import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
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
  };
}

function toParty(row: Row): SoyaParty {
  return { id: String(row.id), name: String(row.name) };
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

export async function getSoyaParties(): Promise<SoyaParty[]> {
  const { data, error } = await supabaseServer
    .from(MASTER)
    .select("id, name")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load soya parties: ${error.message}`);
  return (data as Row[]).map(toParty);
}

export async function getSoyaPartyById(id: string): Promise<SoyaParty | null> {
  const { data, error } = await supabaseServer
    .from(MASTER)
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load soya party: ${error.message}`);
  return data ? toParty(data as Row) : null;
}

/** Finds a party by name, creating it if it's new. */
export async function upsertSoyaPartyByName(
  rawName: string,
): Promise<SoyaParty | null> {
  const name = normalizeName(rawName);
  if (!name) return null;

  const { data: existing, error: lookupError } = await supabaseServer
    .from(MASTER)
    .select("id, name")
    .eq("name", name)
    .maybeSingle();

  if (lookupError && lookupError.code !== "PGRST116") {
    throw new Error(`Failed to look up soya party: ${lookupError.message}`);
  }
  if (existing) return toParty(existing as Row);

  const { data, error } = await supabaseServer
    .from(MASTER)
    .insert({
      id: crypto.randomUUID(),
      name,
      updated_at: new Date().toISOString(),
    })
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
      return retry ? toParty(retry as Row) : null;
    }
    throw new Error(`Failed to create soya party: ${error.message}`);
  }

  return toParty(data as Row);
}

export async function createSoyaParty(name: string): Promise<SoyaParty> {
  await requireRole(["admin"]);
  const party = await upsertSoyaPartyByName(name);
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
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("Party name already exists");
    throw new Error(`Failed to update soya party: ${error.message}`);
  }

  // Entries denormalize the party name, so a rename has to follow through.
  if (existing.name !== name) {
    const { error: cascadeError } = await supabaseServer
      .from(ENTRIES)
      .update({ party: name, updated_at: new Date().toISOString() })
      .eq("party", existing.name);
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

  const { count, error: countError } = await supabaseServer
    .from(ENTRIES)
    .select("id", { head: true, count: "exact" })
    .eq("party", existing.name);
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

export async function getSoyaPartyEntries(): Promise<SoyaPartyEntry[]> {
  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .select("*")
    .order("date", { ascending: false })
    .order("sl_no", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`Failed to load soya party entries: ${error.message}`);
  }
  return (data as Row[]).map(toEntry);
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
 * Next SL NO and BILL NO within the financial year the given date falls in.
 * BILL NO is text (the workbook opens a year with "29*1"), so the suggestion is
 * derived from the numeric bill numbers only and non-numeric ones are ignored.
 */
export async function getNextSoyaPartyIdentifiers(
  date?: string,
): Promise<{ nextSlNo: number; nextBillNo: string }> {
  const { start, end } = getFinancialYearBounds(
    date && date.trim() ? date : new Date(),
  );

  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .select("sl_no, bill_no")
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

/** BILL NO is unique per financial year; this is the pre-submit check. */
export async function isSoyaPartyBillNoAvailable(
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

export async function createSoyaPartyEntry(
  input: SoyaPartyEntryInput,
): Promise<SoyaPartyEntry> {
  await requireRole(["admin"]);

  const party = normalizeName(input.party);
  if (!party) throw new Error("Party is required");
  await upsertSoyaPartyByName(party);

  const calculated = calculateSoyaPartyEntry(
    { ...input, party },
    crypto.randomUUID(),
  );

  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .insert({ id: calculated.id, ...buildEntryPayload(calculated) })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && String(error.message).includes("bill_no")) {
      throw new Error("Bill no already exists for this financial year");
    }
    throw new Error(`Failed to create soya party entry: ${error.message}`);
  }
  return toEntry(data as Row);
}

export async function updateSoyaPartyEntry(
  id: string,
  input: SoyaPartyEntryInput,
): Promise<SoyaPartyEntry> {
  await requireRole(["admin"]);

  const existing = await getSoyaPartyEntryById(id);
  if (!existing) throw new Error("Entry not found");

  const party = normalizeName(input.party);
  if (!party) throw new Error("Party is required");
  await upsertSoyaPartyByName(party);

  const calculated = calculateSoyaPartyEntry({ ...input, party }, id);

  const { data, error } = await supabaseServer
    .from(ENTRIES)
    .update(buildEntryPayload(calculated))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && String(error.message).includes("bill_no")) {
      throw new Error("Bill no already exists for this financial year");
    }
    throw new Error(`Failed to update soya party entry: ${error.message}`);
  }
  return toEntry(data as Row);
}

export async function deleteSoyaPartyEntry(id: string): Promise<void> {
  await requireRole(["admin"]);

  const { error } = await supabaseServer.from(ENTRIES).delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete soya party entry: ${error.message}`);
  }
}

// ------------------------------------------------------------ party payments

export async function getSoyaPartyPayments(
  partyId?: string,
): Promise<SoyaPartyPayment[]> {
  let query = supabaseServer
    .from(PAYMENTS)
    .select("*")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (partyId) query = query.eq("party_id", partyId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load soya party payments: ${error.message}`);
  }
  return (data as Row[]).map(toPayment);
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
