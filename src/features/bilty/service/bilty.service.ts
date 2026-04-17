import {
  type Bilty,
  type BiltyInput,
  type BiltyParty,
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
    bag_less: n(row.bag_less),
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
    place: "",
    mob: "",
  };
}

function normalizeParty(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toBiltyParty(row: BiltyPartyRow): BiltyParty {
  return {
    id: row.id,
    name: row.name,
  };
}

export async function getBiltyParties(): Promise<BiltyParty[]> {
  const { data, error } = await supabaseServer
    .from("bilty_parties")
    .select("id, name")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load bilty parties: ${error.message}`);
  }

  return (data as BiltyPartyRow[]).map(toBiltyParty);
}

export async function getBiltyPartyById(id: string): Promise<BiltyParty | null> {
  const { data, error } = await supabaseServer
    .from("bilty_parties")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load bilty party: ${error.message}`);
  }

  return data ? toBiltyParty(data as BiltyPartyRow) : null;
}

export async function upsertBiltyPartyByName(name: string): Promise<BiltyParty | null> {
  const normalized = normalizeParty(name);
  if (!normalized) return null;

  const { data: existing, error: existingError } = await supabaseServer
    .from("bilty_parties")
    .select("id, name")
    .eq("name", normalized)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    throw new Error(`Failed to lookup bilty party: ${existingError.message}`);
  }

  if (existing) {
    return toBiltyParty(existing as BiltyPartyRow);
  }

  const { data, error } = await supabaseServer
    .from("bilty_parties")
    .insert({
      id: crypto.randomUUID(),
      name: normalized,
      updated_at: new Date().toISOString(),
    })
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: retryData, error: retryError } = await supabaseServer
        .from("bilty_parties")
        .select("id, name")
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
  const { data, error } = await supabaseServer
    .from("bilty")
    .select("*")
    .order("bill_no", { ascending: false, nullsFirst: false })
    .order("date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load bilty records: ${error.message}`);
  }
  return (data as BiltyRow[]).map(toBilty);
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

  return data ? toBilty(data as BiltyRow) : null;
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
  await upsertBiltyPartyByName(normalizedParty);

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
    place: "",
    mob: "",
    bags: calculated.bags,
    weight: calculated.weight,
    less_percent: calculated.less_percent,
    rate: calculated.rate,
    bag_less: calculated.bag_less,
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
  await upsertBiltyPartyByName(normalizedParty);

  const calculated = calculateBilty(
    { ...input, party: normalizedParty, source: existing.source },
    id
  );
  const payload = {
    bill_no: calculated.bill_no,
    date: calculated.date,
    party: calculated.party,
    name: calculated.party,
    place: "",
    mob: "",
    bags: calculated.bags,
    weight: calculated.weight,
    less_percent: calculated.less_percent,
    rate: calculated.rate,
    bag_less: calculated.bag_less,
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
