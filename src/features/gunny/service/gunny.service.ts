import { requireAuth } from "@/features/auth/lib/session";
import { getFinancialYearBounds } from "@/lib/financial-year";
import { supabaseServer } from "@/lib/supabase/server";
import {
  type GunnyRecord,
  type GunnyRecordInput,
  type GunnySeller,
  type GunnySellerInput,
  type GunnySellerPayment,
  type GunnySellerPaymentAllocation,
  type GunnySellerPaymentInput,
} from "../schemas";

type GunnyRow = {
  id: string;
  bill_no: number | string;
  date: string;
  seller: string;
  bags: number | string;
  rate: number | string;
  amount: number | string;
  paid_amount: number | string;
  payment_mode: "none" | "cash" | "upi" | "rtgs" | null;
  upi_number: string | null;
  rtgs_name: string | null;
  note: string | null;
  source: "manual" | "app";
  created_at?: string | null;
  updated_at?: string | null;
};

type SellerRow = {
  id: string;
  name: string;
  place: string | null;
  mob: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SellerPaymentRow = {
  id: string;
  seller_id: string;
  paid_on: string;
  amount: number | string;
  payment_mode: "none" | "cash" | "upi" | "rtgs" | null;
  upi_number: string | null;
  rtgs_name: string | null;
  note: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SellerPaymentAllocationRow = {
  id: string;
  payment_id: string;
  record_id: string;
  amount: number | string;
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

function toGunny(row: GunnyRow): GunnyRecord {
  const amount = n(row.amount);
  const paidAmount = n(row.paid_amount);
  return {
    id: row.id,
    bill_no: Math.trunc(n(row.bill_no)),
    date: row.date,
    seller: row.seller,
    bags: n(row.bags),
    rate: n(row.rate),
    amount,
    paid_amount: paidAmount,
    pending_amount: Math.max(amount - paidAmount, 0),
    payment_mode: row.payment_mode ?? "none",
    upi_number: row.upi_number ?? "",
    rtgs_name: row.rtgs_name ?? "",
    note: row.note ?? "",
    source: row.source,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function toSeller(row: SellerRow): GunnySeller {
  return {
    id: row.id,
    name: row.name,
    place: row.place ?? "",
    mob: row.mob ?? "",
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function toPayment(row: SellerPaymentRow): GunnySellerPayment {
  return {
    id: row.id,
    seller_id: row.seller_id,
    paid_on: row.paid_on,
    amount: n(row.amount),
    payment_mode: row.payment_mode ?? "none",
    upi_number: row.upi_number ?? "",
    rtgs_name: row.rtgs_name ?? "",
    note: row.note ?? "",
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function toPaymentAllocation(
  row: SellerPaymentAllocationRow,
): GunnySellerPaymentAllocation {
  return {
    id: row.id,
    payment_id: row.payment_id,
    record_id: row.record_id,
    amount: n(row.amount),
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

export async function getGunnyRecords(): Promise<GunnyRecord[]> {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from("gunny_bags")
    .select("*")
    .order("bill_no", { ascending: false, nullsFirst: false })
    .order("date", { ascending: false });

  if (error) throw new Error(`Failed to load gunny records: ${error.message}`);
  return (data as GunnyRow[]).map(toGunny);
}

export async function getGunnyRecordById(id: string): Promise<GunnyRecord | null> {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from("gunny_bags")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Failed to load gunny record: ${error.message}`);
  return data ? toGunny(data as GunnyRow) : null;
}

export async function getNextGunnyBillNoPreview(billDate?: string): Promise<number> {
  await requireAuth();
  const { start, end } = getFinancialYearBounds(billDate && billDate.trim() ? billDate : new Date());
  const { data, error } = await supabaseServer
    .from("gunny_bags")
    .select("bill_no")
    .gte("date", start)
    .lte("date", end)
    .order("bill_no", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load next gunny bill number: ${error.message}`);
  const maxBillNo = Math.trunc(n((data as { bill_no?: number | string | null } | null)?.bill_no));
  return Math.max(maxBillNo + 1, 1);
}

export async function createGunnyRecord(input: GunnyRecordInput): Promise<GunnyRecord> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") throw new Error("Forbidden");

  const payload = {
    id: crypto.randomUUID(),
    bill_no: input.bill_no,
    date: input.date,
    seller: input.seller.trim(),
    bags: input.bags,
    rate: input.rate,
    amount: input.amount,
    paid_amount: input.paid_amount,
    payment_mode: input.payment_mode,
    upi_number: input.upi_number ?? "",
    rtgs_name: input.rtgs_name ?? "",
    note: input.note ?? "",
    source: "app" as const,
  };

  const { data, error } = await supabaseServer
    .from("gunny_bags")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create gunny record: ${error.message}`);
  return toGunny(data as GunnyRow);
}

export async function updateGunnyRecord(id: string, input: GunnyRecordInput): Promise<GunnyRecord> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") throw new Error("Forbidden");

  const { data: existing, error: existingError } = await supabaseServer
    .from("gunny_bags")
    .select("id, source")
    .eq("id", id)
    .maybeSingle();

  if (existingError) throw new Error(`Failed to load gunny record: ${existingError.message}`);
  if (!existing) throw new Error("Record not found");
  if ((existing as { source: "manual" | "app" }).source === "manual") {
    throw new Error("Cannot edit manual original gunny record directly");
  }

  const payload = {
    bill_no: input.bill_no,
    date: input.date,
    seller: input.seller.trim(),
    bags: input.bags,
    rate: input.rate,
    amount: input.amount,
    paid_amount: input.paid_amount,
    payment_mode: input.payment_mode,
    upi_number: input.upi_number ?? "",
    rtgs_name: input.rtgs_name ?? "",
    note: input.note ?? "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("gunny_bags")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update gunny record: ${error.message}`);
  return toGunny(data as GunnyRow);
}

export async function deleteGunnyRecord(id: string): Promise<void> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") throw new Error("Forbidden");

  const { data: existing, error: existingError } = await supabaseServer
    .from("gunny_bags")
    .select("id, source")
    .eq("id", id)
    .maybeSingle();

  if (existingError) throw new Error(`Failed to load gunny record: ${existingError.message}`);
  if (!existing) return;
  if ((existing as { source: "manual" | "app" }).source === "manual") {
    throw new Error("Cannot delete manual original gunny record directly");
  }

  const { error } = await supabaseServer.from("gunny_bags").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete gunny record: ${error.message}`);
}

export async function getGunnySellers(): Promise<GunnySeller[]> {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from("gunny_sellers")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(`Failed to load gunny sellers: ${error.message}`);
  return (data as SellerRow[]).map(toSeller);
}

export async function createGunnySeller(input: GunnySellerInput): Promise<GunnySeller> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") throw new Error("Forbidden");

  const payload = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    place: input.place ?? "",
    mob: input.mob ?? "",
  };

  const { data, error } = await supabaseServer
    .from("gunny_sellers")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create seller: ${error.message}`);
  return toSeller(data as SellerRow);
}

export async function updateGunnySeller(id: string, input: GunnySellerInput): Promise<GunnySeller> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") throw new Error("Forbidden");

  const payload = {
    name: input.name.trim(),
    place: input.place ?? "",
    mob: input.mob ?? "",
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("gunny_sellers")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to update seller: ${error.message}`);
  return toSeller(data as SellerRow);
}

export async function deleteGunnySeller(id: string): Promise<void> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") throw new Error("Forbidden");

  const { error } = await supabaseServer.from("gunny_sellers").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete seller: ${error.message}`);
}

export async function getGunnySellerPayments(sellerId?: string): Promise<GunnySellerPayment[]> {
  await requireAuth();
  let query = supabaseServer
    .from("gunny_seller_payments")
    .select("*")
    .order("paid_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (sellerId) query = query.eq("seller_id", sellerId);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load seller payments: ${error.message}`);

  return (data as SellerPaymentRow[]).map(toPayment);
}

export async function createGunnySellerPayment(input: GunnySellerPaymentInput): Promise<GunnySellerPayment> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") throw new Error("Forbidden");

  const payload = {
    id: crypto.randomUUID(),
    seller_id: input.seller_id,
    paid_on: input.paid_on,
    amount: input.amount,
    payment_mode: input.payment_mode,
    upi_number: input.upi_number ?? "",
    rtgs_name: input.rtgs_name ?? "",
    note: input.note ?? "",
  };

  const { data, error } = await supabaseServer
    .from("gunny_seller_payments")
    .insert(payload)
    .select("*")
    .single();

  if (error) throw new Error(`Failed to create seller payment: ${error.message}`);

  if (input.allocations.length > 0) {
    const allocationPayload = input.allocations.map((allocation) => ({
      id: crypto.randomUUID(),
      payment_id: payload.id,
      record_id: allocation.record_id,
      amount: allocation.amount,
    }));

    const { error: allocationError } = await supabaseServer
      .from("gunny_payment_allocations")
      .insert(allocationPayload);

    if (allocationError) {
      throw new Error(`Failed to create payment allocations: ${allocationError.message}`);
    }
  }

  return toPayment(data as SellerPaymentRow);
}

export async function deleteGunnySellerPayment(id: string): Promise<void> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") throw new Error("Forbidden");

  const { error } = await supabaseServer.from("gunny_seller_payments").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete seller payment: ${error.message}`);
}

export async function getGunnyPaymentAllocations(): Promise<GunnySellerPaymentAllocation[]> {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from("gunny_payment_allocations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to load payment allocations: ${error.message}`);
  return (data as SellerPaymentAllocationRow[]).map(toPaymentAllocation);
}
