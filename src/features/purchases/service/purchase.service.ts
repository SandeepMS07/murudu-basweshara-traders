import {
  PaymentMethod,
  Purchase,
  PurchaseInput,
} from "../schemas";
import { calculatePurchase } from "../utils/calculations";
import { requireAuth } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

type PurchaseRow = {
  id: string;
  date: string;
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
  payment_through: PaymentMethod | null;
  source: "manual" | "app";
  less_weight: number | string;
  net_weight: number | string;
  amount: number | string;
  final_total: number | string;
  bag_avg: number | string;
};

function n(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    date: row.date,
    name: row.name ?? "",
    place: row.place ?? "",
    mob: row.mob ?? "",
    bags: n(row.bags),
    weight: n(row.weight),
    less_percent: n(row.less_percent),
    rate: n(row.rate),
    bag_less: n(row.bag_less),
    add_amount: n(row.add_amount),
    cash_paid: n(row.cash_paid),
    upi_paid: n(row.upi_paid),
    payment_through: (row.payment_through ?? "none") as PaymentMethod,
    source: row.source,
    less_weight: n(row.less_weight),
    net_weight: n(row.net_weight),
    amount: n(row.amount),
    final_total: n(row.final_total),
    bag_avg: n(row.bag_avg),
  };
}

export async function getPurchases(): Promise<Purchase[]> {
  const { data, error } = await supabaseServer
    .from("purchases")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    throw new Error(`Failed to load purchases: ${error.message}`);
  }

  return (data as PurchaseRow[]).map(toPurchase);
}

export async function getPurchaseById(id: string): Promise<Purchase | null> {
  const { data, error } = await supabaseServer
    .from("purchases")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load purchase: ${error.message}`);
  }

  return data ? toPurchase(data as PurchaseRow) : null;
}

export async function createPurchase(input: PurchaseInput): Promise<Purchase> {
  await requireAuth();

  const calculated = calculatePurchase({ ...input, source: "app" }, crypto.randomUUID());
  const payload = {
    id: calculated.id,
    date: calculated.date,
    name: calculated.name,
    place: calculated.place,
    mob: calculated.mob,
    bags: calculated.bags,
    weight: calculated.weight,
    less_percent: calculated.less_percent,
    rate: calculated.rate,
    bag_less: calculated.bag_less,
    add_amount: calculated.add_amount,
    cash_paid: calculated.cash_paid,
    upi_paid: calculated.upi_paid,
    payment_through: calculated.payment_through,
    source: calculated.source,
    less_weight: calculated.less_weight,
    net_weight: calculated.net_weight,
    amount: calculated.amount,
    final_total: calculated.final_total,
    bag_avg: calculated.bag_avg,
  };

  const { data, error } = await supabaseServer
    .from("purchases")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create purchase: ${error.message}`);
  }

  return toPurchase(data as PurchaseRow);
}

export async function updatePurchase(id: string, input: PurchaseInput): Promise<Purchase> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const existing = await getPurchaseById(id);
  if (!existing) throw new Error("Purchase not found");
  if (existing.source === "manual") {
    throw new Error("Cannot edit manual original purchases directly");
  }

  const calculated = calculatePurchase({ ...input, source: existing.source }, id);
  const payload = {
    date: calculated.date,
    name: calculated.name,
    place: calculated.place,
    mob: calculated.mob,
    bags: calculated.bags,
    weight: calculated.weight,
    less_percent: calculated.less_percent,
    rate: calculated.rate,
    bag_less: calculated.bag_less,
    add_amount: calculated.add_amount,
    cash_paid: calculated.cash_paid,
    upi_paid: calculated.upi_paid,
    payment_through: calculated.payment_through,
    source: calculated.source,
    less_weight: calculated.less_weight,
    net_weight: calculated.net_weight,
    amount: calculated.amount,
    final_total: calculated.final_total,
    bag_avg: calculated.bag_avg,
  };

  const { data, error } = await supabaseServer
    .from("purchases")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update purchase: ${error.message}`);
  }

  return toPurchase(data as PurchaseRow);
}

export async function updatePurchasePaymentThrough(
  id: string,
  payment_through: PaymentMethod
): Promise<Purchase> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const { data, error } = await supabaseServer
    .from("purchases")
    .update({
      payment_through,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update payment method: ${error.message}`);
  }

  return toPurchase(data as PurchaseRow);
}

export async function deletePurchase(id: string): Promise<void> {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    throw new Error("Forbidden");
  }

  const existing = await getPurchaseById(id);
  if (!existing) throw new Error("Purchase not found");
  if (existing.source === "manual") {
    throw new Error("Cannot delete manual original purchases directly");
  }

  const { error } = await supabaseServer.from("purchases").delete().eq("id", id);
  if (error) {
    throw new Error(`Failed to delete purchase: ${error.message}`);
  }
}
