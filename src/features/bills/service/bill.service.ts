import { Bill, BillInput } from "../schemas";
import { calculateBill } from "../utils/calculations";
import { requireAuth } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

type BillRow = {
  id: string;
  bill_no: number | string | null;
  bill_date: string;
  net_weight: number | string;
  rate: number | string;
  freight: number | string;
  payment_term_days: number | string;
  source: "manual" | "app";
  amount: number | string;
  final_amount: number | string;
  due_date: string;
};

function n(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toBill(row: BillRow): Bill {
  return {
    id: row.id,
    bill_no: Math.trunc(n(row.bill_no)),
    bill_date: row.bill_date,
    net_weight: n(row.net_weight),
    rate: n(row.rate),
    freight: n(row.freight),
    payment_term_days: n(row.payment_term_days),
    source: row.source,
    amount: n(row.amount),
    final_amount: n(row.final_amount),
    due_date: row.due_date,
  };
}

export async function getBills(): Promise<Bill[]> {
  const { data, error } = await supabaseServer
    .from("bills")
    .select("*")
    .order("bill_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load bills: ${error.message}`);
  }

  return (data as BillRow[]).map(toBill);
}

export async function getNextBillNoPreview(): Promise<number> {
  await requireAuth();
  const { data, error } = await supabaseServer
    .from("bills")
    .select("bill_no")
    .order("bill_no", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load next bill number: ${error.message}`);
  }

  const maxBillNo = Math.trunc(n((data as { bill_no?: number | string | null } | null)?.bill_no));
  return Math.max(maxBillNo + 1, 1);
}

export async function getBillById(id: string): Promise<Bill | null> {
  const { data, error } = await supabaseServer
    .from("bills")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load bill: ${error.message}`);
  }

  return data ? toBill(data as BillRow) : null;
}

export async function createBill(input: BillInput): Promise<Bill> {
  await requireAuth();

  const calculated = calculateBill({ ...input, source: "app" }, crypto.randomUUID());
  const payload = {
    id: calculated.id,
    bill_date: calculated.bill_date,
    net_weight: calculated.net_weight,
    rate: calculated.rate,
    freight: calculated.freight,
    payment_term_days: calculated.payment_term_days,
    source: calculated.source,
    amount: calculated.amount,
    final_amount: calculated.final_amount,
    due_date: calculated.due_date,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("bills")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create bill: ${error.message}`);
  }

  return toBill(data as BillRow);
}

export async function upsertBillById(id: string, input: BillInput): Promise<Bill> {
  await requireAuth();
  const calculated = calculateBill({ ...input, source: "app" }, id);
  const payload = {
    id: calculated.id,
    bill_date: calculated.bill_date,
    net_weight: calculated.net_weight,
    rate: calculated.rate,
    freight: calculated.freight,
    payment_term_days: calculated.payment_term_days,
    source: calculated.source,
    amount: calculated.amount,
    final_amount: calculated.final_amount,
    due_date: calculated.due_date,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("bills")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to upsert bill: ${error.message}`);
  }

  return toBill(data as BillRow);
}

export async function updateBill(id: string, input: BillInput): Promise<Bill> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const existing = await getBillById(id);
  if (!existing) throw new Error("Bill not found");
  if (existing.source === "manual") {
    throw new Error("Cannot edit manual original bills directly");
  }

  const calculated = calculateBill({ ...input, source: existing.source }, id);
  const payload = {
    bill_date: calculated.bill_date,
    net_weight: calculated.net_weight,
    rate: calculated.rate,
    freight: calculated.freight,
    payment_term_days: calculated.payment_term_days,
    source: calculated.source,
    amount: calculated.amount,
    final_amount: calculated.final_amount,
    due_date: calculated.due_date,
  };

  const { data, error } = await supabaseServer
    .from("bills")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update bill: ${error.message}`);
  }

  return toBill(data as BillRow);
}
