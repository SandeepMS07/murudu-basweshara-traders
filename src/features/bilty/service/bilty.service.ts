import {
  type Bilty,
  type BiltyInput,
  type BiltyParty,
  type BiltyPartyPayment,
  type BiltyPartyPaymentInput,
  type PaymentMethod,
} from "../schemas";
import { calculateBilty } from "../utils/calculations";
import { requireAuth } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { getFinancialYearBounds } from "@/lib/financial-year";

type BiltyRow = {
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

type BiltyPartyRow = {
  id: string;
  name: string;
  place: string | null;
  mob: string | null;
};

type BiltyPartyPaymentRow = {
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

function toBilty(row: BiltyRow): Bilty {
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
  bilty: Bilty,
  partyDetails?: { place?: string | null; mob?: string | null } | null
): Bilty {
  if (!partyDetails) return bilty;
  return {
    ...bilty,
    place: bilty.place?.trim() ? bilty.place : (partyDetails.place ?? ""),
    mob: bilty.mob?.trim() ? bilty.mob : (partyDetails.mob ?? ""),
  };
}

function normalizeParty(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toBiltyParty(row: BiltyPartyRow): BiltyParty {
  return {
    id: row.id,
    name: row.name,
    place: row.place ?? "",
    mob: row.mob ?? "",
  };
}

function toBiltyPartyPayment(row: BiltyPartyPaymentRow): BiltyPartyPayment {
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

export async function getBiltyParties(): Promise<BiltyParty[]> {
  const { data, error } = await supabaseServer
    .from("bilty_parties")
    .select("id, name, place, mob")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load bilty parties: ${error.message}`);
  }

  return (data as BiltyPartyRow[]).map(toBiltyParty);
}

export async function getBiltyPartyById(id: string): Promise<BiltyParty | null> {
  const { data, error } = await supabaseServer
    .from("bilty_parties")
    .select("id, name, place, mob")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load bilty party: ${error.message}`);
  }

  return data ? toBiltyParty(data as BiltyPartyRow) : null;
}

export async function upsertBiltyPartyByName(
  name: string,
  details?: { place?: string; mob?: string }
): Promise<BiltyParty | null> {
  const normalized = normalizeParty(name);
  const normalizedPlace = (details?.place ?? "").trim();
  const normalizedMob = (details?.mob ?? "").trim();
  if (!normalized) return null;

  const { data: existing, error: existingError } = await supabaseServer
    .from("bilty_parties")
    .select("id, name, place, mob")
    .eq("name", normalized)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw new Error(`Failed to lookup bilty party: ${existingError.message}`);
  }

  if (existing) {
    if (normalizedPlace || normalizedMob) {
      const { data: updated, error: updateError } = await supabaseServer
        .from("bilty_parties")
        .update({
          place: normalizedPlace || (existing.place ?? ""),
          mob: normalizedMob || (existing.mob ?? ""),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("id, name, place, mob")
        .single();

      if (updateError) {
        throw new Error(`Failed to update bilty party details: ${updateError.message}`);
      }
      return toBiltyParty(updated as BiltyPartyRow);
    }
    return toBiltyParty(existing as BiltyPartyRow);
  }

  const { data, error } = await supabaseServer
    .from("bilty_parties")
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
    if (error.code === "23505") {
      const { data: retryData, error: retryError } = await supabaseServer
        .from("bilty_parties")
        .select("id, name, place, mob")
        .eq("name", normalized)
        .maybeSingle();

      if (retryError) {
        throw new Error(`Failed to create bilty party: ${retryError.message}`);
      }

      return retryData ? toBiltyParty(retryData as BiltyPartyRow) : null;
    }
    throw new Error(`Failed to create bilty party: ${error.message}`);
  }

  return data ? toBiltyParty(data as BiltyPartyRow) : null;
}

export async function deleteBiltyParty(id: string): Promise<void> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const existing = await getBiltyPartyById(id);
  if (!existing) {
    throw new Error("Party not found");
  }

  const { error } = await supabaseServer
    .from("bilty_parties")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete bilty party: ${error.message}`);
  }
}

export async function updateBiltyParty(
  id: string,
  name: string,
  place?: string,
  mob?: string
): Promise<BiltyParty> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const existing = await getBiltyPartyById(id);
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
    .from("bilty_parties")
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
    throw new Error(`Failed to update bilty party: ${error.message}`);
  }

  if (existing.name !== normalized) {
    const { error: biltyUpdateError } = await supabaseServer
      .from("bilty")
      .update({
        party: normalized,
        name: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq("party", existing.name);

    if (biltyUpdateError) {
      throw new Error(`Party renamed but bilty rows update failed: ${biltyUpdateError.message}`);
    }
  }

  return toBiltyParty(data as BiltyPartyRow);
}

export async function getBiltyPartyPayments(partyId?: string): Promise<BiltyPartyPayment[]> {
  await requireAuth();
  let query = supabaseServer
    .from("bilty_party_payments")
    .select("*")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (partyId) {
    query = query.eq("party_id", partyId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load bilty party payments: ${error.message}`);
  }

  return (data as BiltyPartyPaymentRow[]).map(toBiltyPartyPayment);
}

export async function createBiltyPartyPayment(
  input: BiltyPartyPaymentInput
): Promise<BiltyPartyPayment> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

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
    .from("bilty_party_payments")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create bilty party payment: ${error.message}`);
  }

  return toBiltyPartyPayment(data as BiltyPartyPaymentRow);
}

export async function deleteBiltyPartyPayment(id: string): Promise<void> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const { error } = await supabaseServer
    .from("bilty_party_payments")
    .delete()
    .eq("id", id);
  if (error) {
    throw new Error(`Failed to delete bilty party payment: ${error.message}`);
  }
}

export async function getNextBiltyBillNoPreview(billDate?: string): Promise<number> {
  await requireAuth();
  const { start, end } = getFinancialYearBounds(
    billDate && billDate.trim() ? billDate : new Date()
  );
  const { data, error } = await supabaseServer
    .from("bilty")
    .select("bill_no")
    .gte("date", start)
    .lte("date", end)
    .order("bill_no", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load next bilty bill number: ${error.message}`);
  }

  const maxBillNo = Math.trunc(n((data as { bill_no?: number | string | null } | null)?.bill_no));
  return Math.max(maxBillNo + 1, 1);
}

export async function getBiltys(): Promise<Bilty[]> {
  const [{ data, error }, partiesResult] = await Promise.all([
    supabaseServer
      .from("bilty")
      .select("*")
      .order("bill_no", { ascending: false, nullsFirst: false })
      .order("date", { ascending: false }),
    supabaseServer.from("bilty_parties").select("name, place, mob"),
  ]);

  if (error) {
    throw new Error(`Failed to load bilty records: ${error.message}`);
  }
  if (partiesResult.error) {
    throw new Error(`Failed to load bilty party details: ${partiesResult.error.message}`);
  }

  const partyByName = new Map(
    (partiesResult.data as Array<{ name: string; place: string | null; mob: string | null }>).map(
      (party) => [party.name.trim().toLowerCase(), party]
    )
  );

  return (data as BiltyRow[]).map((row) => {
    const bilty = toBilty(row);
    const key = (bilty.party || bilty.name || "").trim().toLowerCase();
    return withPartyFallback(bilty, partyByName.get(key));
  });
}

export async function getBiltyById(id: string): Promise<Bilty | null> {
  const { data, error } = await supabaseServer
    .from("bilty")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load bilty: ${error.message}`);
  }
  if (!data) return null;
  const bilty = toBilty(data as BiltyRow);
  if (bilty.place?.trim() && bilty.mob?.trim()) return bilty;

  const { data: partyData, error: partyError } = await supabaseServer
    .from("bilty_parties")
    .select("name, place, mob")
    .eq("name", bilty.party || bilty.name)
    .maybeSingle();
  if (partyError && partyError.code !== "PGRST116") {
    throw new Error(`Failed to load bilty party details: ${partyError.message}`);
  }

  return withPartyFallback(
    bilty,
    (partyData as { place?: string | null; mob?: string | null } | null) ?? null
  );
}

export async function isBiltyBillNoAvailable(
  billNo: number,
  billDate: string,
  excludeBiltyId?: string
): Promise<boolean> {
  await requireAuth();
  const { start, end } = getFinancialYearBounds(
    billDate && billDate.trim() ? billDate : new Date()
  );

  let query = supabaseServer
    .from("bilty")
    .select("id")
    .eq("bill_no", billNo)
    .gte("date", start)
    .lte("date", end)
    .limit(1);

  if (excludeBiltyId) {
    query = query.neq("id", excludeBiltyId);
  }

  const { data, error } = await query.maybeSingle();
  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to validate bilty bill number: ${error.message}`);
  }

  return !data;
}

export async function createBilty(input: BiltyInput): Promise<Bilty> {
  await requireAuth();

  const normalizedParty = normalizeParty(input.party);
  if (!normalizedParty) {
    throw new Error("Party is required");
  }
  const partyDetails = await upsertBiltyPartyByName(normalizedParty);

  const calculated = calculateBilty(
    { ...input, party: normalizedParty, source: "app" },
    crypto.randomUUID()
  );
  const payload = {
    id: calculated.id,
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

  const { data, error } = await supabaseServer
    .from("bilty")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && String(error.message).includes("bill_no")) {
      throw new Error("Bill number already exists");
    }
    throw new Error(`Failed to create bilty: ${error.message}`);
  }

  return toBilty(data as BiltyRow);
}

export async function updateBilty(id: string, input: BiltyInput): Promise<Bilty> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const existing = await getBiltyById(id);
  if (!existing) throw new Error("Bilty not found");
  if (existing.source === "manual") {
    throw new Error("Cannot edit manual original bilty directly");
  }

  const normalizedParty = normalizeParty(input.party);
  if (!normalizedParty) {
    throw new Error("Party is required");
  }
  const partyDetails = await upsertBiltyPartyByName(normalizedParty);

  const calculated = calculateBilty(
    { ...input, party: normalizedParty, source: existing.source },
    id
  );
  const payload = {
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

  const { data, error } = await supabaseServer
    .from("bilty")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505" && String(error.message).includes("bill_no")) {
      throw new Error("Bill number already exists");
    }
    throw new Error(`Failed to update bilty: ${error.message}`);
  }

  return toBilty(data as BiltyRow);
}

export async function updateBiltyPaymentThrough(
  id: string,
  payment_through: PaymentMethod,
  payment_date?: string | null
): Promise<Bilty> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const normalizedPaymentDate =
    payment_through === "none"
      ? null
      : payment_date && payment_date.trim()
        ? payment_date
        : new Date().toISOString().split("T")[0];

  const { data, error } = await supabaseServer
    .from("bilty")
    .update({
      payment_through,
      payment_date: normalizedPaymentDate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update bilty payment method: ${error.message}`);
  }

  return toBilty(data as BiltyRow);
}

export async function deleteBilty(id: string): Promise<void> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const existing = await getBiltyById(id);
  if (!existing) throw new Error("Bilty not found");
  if (existing.source === "manual") {
    throw new Error("Cannot delete manual original bilty directly");
  }

  const { error } = await supabaseServer.from("bilty").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete bilty: ${error.message}`);
  }
}
