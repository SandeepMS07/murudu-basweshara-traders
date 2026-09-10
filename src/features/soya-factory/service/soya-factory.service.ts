import {
  type Bilty,
  type BiltyInput,
  type BiltyParty,
  type BiltyPartyPayment,
  type BiltyPartyPaymentInput,
  type PaymentMethod,
} from "@/features/bilty/schemas";
import { calculateBilty } from "@/features/bilty/utils/calculations";
import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { getFinancialYearBounds } from "@/lib/financial-year";

/**
 * Soya Factory: the maize bilty record shape against its own soya_bilty tables.
 *
 * The types and calculateBilty are imported from the maize feature rather than
 * copied, so Soya rows stay exactly the same shape and any future change to the
 * maize bilty shape fails this build instead of diverging silently. Nothing
 * here reads or writes a maize table.
 *
 * Soya is admin-only, so every write is gated on requireRole(["admin"]) instead
 * of the per-module permission map — no "soya" key is added to MODULES.
 */
const RECORDS = "soya_bilty";
const PARTIES = "soya_bilty_parties";
const PAYMENTS = "soya_bilty_party_payments";

type SoyaFactoryRow = {
  id: string;
  bill_no: number | string | null;
  date: string;
  party: string | null;
  name: string | null;
  place: string | null;
  mob: string | null;
  bags: number | string;
  weight: number | string;
  less_percent: number | string;
  rate: number | string;
  bag_less: number | string;
  add_amount: number | string;
  cash_paid: number | string;
  upi_paid: number | string;
  payment_date: string | null;
  payment_through: PaymentMethod | null;
  source: "manual" | "app";
  less_weight: number | string;
  net_weight: number | string;
  amount: number | string;
  final_total: number | string;
  bag_avg: number | string;
  created_at?: string | null;
};

type SoyaFactoryPartyRow = {
  id: string;
  name: string;
  place: string | null;
  mob: string | null;
};

type SoyaFactoryPartyPaymentRow = {
  id: string;
  party_id: string;
  paid_on: string;
  amount: number | string;
  payment_mode: "none" | "cash" | "upi" | "rtgs" | null;
  rtgs_name: string | null;
  note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function n(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toRecord(row: SoyaFactoryRow): Bilty {
  const party = (row.party ?? row.name ?? "").trim();
  return {
    id: row.id,
    bill_no: Math.trunc(n(row.bill_no)),
    date: row.date,
    party,
    bags: n(row.bags),
    weight: n(row.weight),
    less_percent: n(row.less_percent),
    rate: n(row.rate),
    add_amount: n(row.add_amount),
    cash_paid: n(row.cash_paid),
    upi_paid: n(row.upi_paid),
    payment_date: row.payment_date ?? null,
    payment_through: (row.payment_through ?? "none") as PaymentMethod,
    source: row.source,
    less_weight: n(row.less_weight),
    net_weight: n(row.net_weight),
    amount: n(row.amount),
    final_total: n(row.final_total),
    bag_avg: n(row.bag_avg),
    name: party,
    place: row.place ?? "",
    mob: row.mob ?? "",
  };
}

function withPartyFallback(
  record: Bilty,
  partyDetails?: { place?: string | null; mob?: string | null } | null,
): Bilty {
  if (!partyDetails) return record;
  return {
    ...record,
    place: record.place?.trim() ? record.place : (partyDetails.place ?? ""),
    mob: record.mob?.trim() ? record.mob : (partyDetails.mob ?? ""),
  };
}

function normalizeParty(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toParty(row: SoyaFactoryPartyRow): BiltyParty {
  return {
    id: row.id,
    name: row.name,
    place: row.place ?? "",
    mob: row.mob ?? "",
  };
}

function toPartyPayment(row: SoyaFactoryPartyPaymentRow): BiltyPartyPayment {
  return {
    id: row.id,
    party_id: row.party_id,
    paid_on: row.paid_on,
    amount: n(row.amount),
    payment_mode: row.payment_mode ?? "none",
    rtgs_name: row.rtgs_name ?? "",
    note: row.note ?? "",
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

// ------------------------------------------------------------------- parties

export async function getSoyaFactoryParties(): Promise<BiltyParty[]> {
  const { data, error } = await supabaseServer
    .from(PARTIES)
    .select("id, name, place, mob")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load soya factory parties: ${error.message}`);
  }

  return (data as SoyaFactoryPartyRow[]).map(toParty);
}

export async function getSoyaFactoryPartyById(
  id: string,
): Promise<BiltyParty | null> {
  const { data, error } = await supabaseServer
    .from(PARTIES)
    .select("id, name, place, mob")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load soya factory party: ${error.message}`);
  }

  return data ? toParty(data as SoyaFactoryPartyRow) : null;
}

export async function upsertSoyaFactoryPartyByName(
  name: string,
  details?: { place?: string; mob?: string },
): Promise<BiltyParty | null> {
  const normalized = normalizeParty(name);
  const normalizedPlace = (details?.place ?? "").trim();
  const normalizedMob = (details?.mob ?? "").trim();
  if (!normalized) return null;

  const { data: existing, error: existingError } = await supabaseServer
    .from(PARTIES)
    .select("id, name, place, mob")
    .eq("name", normalized)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw new Error(
      `Failed to lookup soya factory party: ${existingError.message}`,
    );
  }

  if (existing) {
    if (normalizedPlace || normalizedMob) {
      const { data: updated, error: updateError } = await supabaseServer
        .from(PARTIES)
        .update({
          place: normalizedPlace || (existing.place ?? ""),
          mob: normalizedMob || (existing.mob ?? ""),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id, name, place, mob")
        .single();

      if (updateError) {
        throw new Error(
          `Failed to update soya factory party details: ${updateError.message}`,
        );
      }
      return toParty(updated as SoyaFactoryPartyRow);
    }
    return toParty(existing as SoyaFactoryPartyRow);
  }

  const { data, error } = await supabaseServer
    .from(PARTIES)
    .insert({
      id: crypto.randomUUID(),
      name: normalized,
      place: normalizedPlace,
      mob: normalizedMob,
      updated_at: new Date().toISOString(),
    })
    .select("id, name, place, mob")
    .single();

  if (error) {
    // Lost a race against a concurrent insert of the same name.
    if (error.code === "23505") {
      const { data: retryData, error: retryError } = await supabaseServer
        .from(PARTIES)
        .select("id, name, place, mob")
        .eq("name", normalized)
        .maybeSingle();

      if (retryError) {
        throw new Error(
          `Failed to create soya factory party: ${retryError.message}`,
        );
      }

      return retryData ? toParty(retryData as SoyaFactoryPartyRow) : null;
    }
    throw new Error(`Failed to create soya factory party: ${error.message}`);
  }

  return data ? toParty(data as SoyaFactoryPartyRow) : null;
}

export async function deleteSoyaFactoryParty(id: string): Promise<void> {
  await requireRole(["admin"]);

  const existing = await getSoyaFactoryPartyById(id);
  if (!existing) {
    throw new Error("Party not found");
  }

  const { error } = await supabaseServer.from(PARTIES).delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete soya factory party: ${error.message}`);
  }
}

export async function updateSoyaFactoryParty(
  id: string,
  name: string,
  place?: string,
  mob?: string,
): Promise<BiltyParty> {
  await requireRole(["admin"]);

  const existing = await getSoyaFactoryPartyById(id);
  if (!existing) {
    throw new Error("Party not found");
  }

  const normalized = normalizeParty(name);
  const normalizedPlace = (place ?? "").trim();
  const normalizedMob = (mob ?? "").trim();
  if (!normalized) {
    throw new Error("Party name is required");
  }
  if (!normalizedPlace) {
    throw new Error("Place is required");
  }
  if (!normalizedMob) {
    throw new Error("Mobile number is required");
  }

  const { data, error } = await supabaseServer
    .from(PARTIES)
    .update({
      name: normalized,
      place: normalizedPlace,
      mob: normalizedMob,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, name, place, mob")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Party name already exists");
    }
    throw new Error(`Failed to update soya factory party: ${error.message}`);
  }

  // Records denormalize the party name, so a rename has to follow through.
  if (existing.name !== normalized) {
    const { error: recordsUpdateError } = await supabaseServer
      .from(RECORDS)
      .update({
        party: normalized,
        name: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq("party", existing.name);

    if (recordsUpdateError) {
      throw new Error(
        `Party renamed but soya factory rows update failed: ${recordsUpdateError.message}`,
      );
    }
  }

  return toParty(data as SoyaFactoryPartyRow);
}

// ------------------------------------------------------------ party payments

export async function getSoyaFactoryPartyPayments(
  partyId?: string,
): Promise<BiltyPartyPayment[]> {
  let query = supabaseServer
    .from(PAYMENTS)
    .select("*")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (partyId) {
    query = query.eq("party_id", partyId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(
      `Failed to load soya factory party payments: ${error.message}`,
    );
  }

  return (data as SoyaFactoryPartyPaymentRow[]).map(toPartyPayment);
}

export async function createSoyaFactoryPartyPayment(
  input: BiltyPartyPaymentInput,
): Promise<BiltyPartyPayment> {
  await requireRole(["admin"]);

  const payload = {
    id: input.id ?? crypto.randomUUID(),
    party_id: input.party_id,
    paid_on: input.paid_on,
    amount: input.amount,
    payment_mode: input.payment_mode,
    rtgs_name: input.payment_mode === "rtgs" ? input.rtgs_name : "",
    note: input.note || "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from(PAYMENTS)
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to create soya factory party payment: ${error.message}`,
    );
  }

  return toPartyPayment(data as SoyaFactoryPartyPaymentRow);
}

export async function deleteSoyaFactoryPartyPayment(id: string): Promise<void> {
  await requireRole(["admin"]);

  const { error } = await supabaseServer.from(PAYMENTS).delete().eq("id", id);
  if (error) {
    throw new Error(
      `Failed to delete soya factory party payment: ${error.message}`,
    );
  }
}

// ------------------------------------------------------------------ records

/**
 * Next bill number for the financial year the given date falls in. Soya
 * numbering restarts at 1 each April and is derived from max(bill_no) within
 * the year rather than from a sequence — see the "no shared sequence" note in
 * supabase/soya-factory.sql.
 */
export async function getNextSoyaFactoryBillNoPreview(
  billDate?: string,
): Promise<number> {
  const { start, end } = getFinancialYearBounds(
    billDate && billDate.trim() ? billDate : new Date(),
  );
  const { data, error } = await supabaseServer
    .from(RECORDS)
    .select("bill_no")
    .gte("date", start)
    .lte("date", end)
    .order("bill_no", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load next soya factory bill number: ${error.message}`,
    );
  }

  const maxBillNo = Math.trunc(
    n((data as { bill_no?: number | string | null } | null)?.bill_no),
  );
  return Math.max(maxBillNo + 1, 1);
}

export async function getSoyaFactoryRecords(): Promise<Bilty[]> {
  const [{ data, error }, partiesResult] = await Promise.all([
    supabaseServer
      .from(RECORDS)
      .select("*")
      .order("bill_no", { ascending: false, nullsFirst: false })
      .order("date", { ascending: false }),
    supabaseServer.from(PARTIES).select("name, place, mob"),
  ]);

  if (error) {
    throw new Error(`Failed to load soya factory records: ${error.message}`);
  }
  if (partiesResult.error) {
    throw new Error(
      `Failed to load soya factory party details: ${partiesResult.error.message}`,
    );
  }

  const partyByName = new Map(
    (
      partiesResult.data as Array<{
        name: string;
        place: string | null;
        mob: string | null;
      }>
    ).map((party) => [party.name.trim().toLowerCase(), party]),
  );

  return (data as SoyaFactoryRow[]).map((row) => {
    const record = toRecord(row);
    const key = (record.party || record.name || "").trim().toLowerCase();
    return withPartyFallback(record, partyByName.get(key));
  });
}

export async function getSoyaFactoryRecordById(
  id: string,
): Promise<Bilty | null> {
  const { data, error } = await supabaseServer
    .from(RECORDS)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load soya factory record: ${error.message}`);
  }
  if (!data) return null;
  const record = toRecord(data as SoyaFactoryRow);
  if (record.place?.trim() && record.mob?.trim()) return record;

  const { data: partyData, error: partyError } = await supabaseServer
    .from(PARTIES)
    .select("name, place, mob")
    .eq("name", record.party || record.name)
    .maybeSingle();
  if (partyError && partyError.code !== "PGRST116") {
    throw new Error(
      `Failed to load soya factory party details: ${partyError.message}`,
    );
  }

  return withPartyFallback(
    record,
    (partyData as { place?: string | null; mob?: string | null } | null) ?? null,
  );
}

export async function isSoyaFactoryBillNoAvailable(
  billNo: number,
  billDate: string,
  excludeId?: string,
): Promise<boolean> {
  const { start, end } = getFinancialYearBounds(
    billDate && billDate.trim() ? billDate : new Date(),
  );

  let query = supabaseServer
    .from(RECORDS)
    .select("id")
    .eq("bill_no", billNo)
    .gte("date", start)
    .lte("date", end)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query.maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new Error(
      `Failed to validate soya factory bill number: ${error.message}`,
    );
  }

  return !data;
}

function buildPayload(calculated: Bilty, partyDetails: BiltyParty | null) {
  return {
    bill_no: calculated.bill_no,
    date: calculated.date,
    party: calculated.party,
    name: calculated.party,
    place: partyDetails?.place ?? "",
    mob: partyDetails?.mob ?? "",
    bags: calculated.bags,
    weight: calculated.weight,
    less_percent: calculated.less_percent,
    rate: calculated.rate,
    bag_less: 0,
    add_amount: calculated.add_amount,
    cash_paid: calculated.cash_paid,
    upi_paid: calculated.upi_paid,
    payment_date: calculated.payment_date,
    payment_through: calculated.payment_through,
    source: calculated.source,
    less_weight: calculated.less_weight,
    net_weight: calculated.net_weight,
    amount: calculated.amount,
    final_total: calculated.final_total,
    bag_avg: calculated.bag_avg,
  };
}

export async function createSoyaFactoryRecord(
  input: BiltyInput,
): Promise<Bilty> {
  await requireRole(["admin"]);

  const normalizedParty = normalizeParty(input.party);
  if (!normalizedParty) {
    throw new Error("Party is required");
  }
  const partyDetails = await upsertSoyaFactoryPartyByName(normalizedParty);

  const calculated = calculateBilty(
    { ...input, party: normalizedParty, source: "app" },
    crypto.randomUUID(),
  );

  const { data, error } = await supabaseServer
    .from(RECORDS)
    .insert({ id: calculated.id, ...buildPayload(calculated, partyDetails) })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && String(error.message).includes("bill_no")) {
      throw new Error("Bill number already exists");
    }
    throw new Error(`Failed to create soya factory record: ${error.message}`);
  }

  return toRecord(data as SoyaFactoryRow);
}

export async function updateSoyaFactoryRecord(
  id: string,
  input: BiltyInput,
): Promise<Bilty> {
  await requireRole(["admin"]);

  const existing = await getSoyaFactoryRecordById(id);
  if (!existing) throw new Error("Record not found");

  const normalizedParty = normalizeParty(input.party);
  if (!normalizedParty) {
    throw new Error("Party is required");
  }
  const partyDetails = await upsertSoyaFactoryPartyByName(normalizedParty);

  const calculated = calculateBilty(
    { ...input, party: normalizedParty, source: existing.source },
    id,
  );

  const { data, error } = await supabaseServer
    .from(RECORDS)
    .update(buildPayload(calculated, partyDetails))
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && String(error.message).includes("bill_no")) {
      throw new Error("Bill number already exists");
    }
    throw new Error(`Failed to update soya factory record: ${error.message}`);
  }

  return toRecord(data as SoyaFactoryRow);
}

export async function updateSoyaFactoryPaymentThrough(
  id: string,
  payment_through: PaymentMethod,
  payment_date?: string | null,
): Promise<Bilty> {
  await requireRole(["admin"]);

  const normalizedPaymentDate =
    payment_through === "none"
      ? null
      : payment_date && payment_date.trim()
        ? payment_date
        : new Date().toISOString().split("T")[0];

  const { data, error } = await supabaseServer
    .from(RECORDS)
    .update({
      payment_through,
      payment_date: normalizedPaymentDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `Failed to update soya factory payment method: ${error.message}`,
    );
  }

  return toRecord(data as SoyaFactoryRow);
}

export async function deleteSoyaFactoryRecord(id: string): Promise<void> {
  await requireRole(["admin"]);

  const existing = await getSoyaFactoryRecordById(id);
  if (!existing) throw new Error("Record not found");

  const { error } = await supabaseServer.from(RECORDS).delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete soya factory record: ${error.message}`);
  }
}
