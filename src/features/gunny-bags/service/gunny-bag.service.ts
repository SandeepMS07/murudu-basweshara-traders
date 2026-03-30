import { requireAuth } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import {
  GunnyBagPartyInput,
  GunnyBagPaymentInput,
  GunnyBagPurchaseInput,
  GunnyBagSaleInput,
} from "@/features/gunny-bags/schemas";

type GunnyPurchaseDbRow = {
  id: string;
  date: string;
  party: string;
  bags: number | string;
  rate: number | string;
  amount: number | string;
  created_at?: string | null;
};

type GunnyPaymentDbRow = {
  id: string;
  date: string;
  party: string;
  mode: string;
  amount: number | string;
  created_at?: string | null;
};

type GunnyPartyDbRow = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  place: string | null;
  notes: string | null;
  is_active: boolean;
  created_at?: string | null;
};

type GunnySaleDbRow = {
  id: string;
  date: string;
  party: string;
  bags: number | string;
  rate: number | string;
  amount: number | string;
  created_at?: string | null;
};

type GunnySalePartyDbRow = {
  id: string;
  name: string;
  is_active: boolean;
};

export type GunnyPurchaseRow = {
  id: string;
  slNo: number | null;
  date: string;
  party: string;
  bags: number;
  rate: number;
  amount: number;
};

export type GunnyPaymentRow = {
  id: string;
  slNo: number | null;
  date: string;
  party: string;
  mode: string;
  amount: number;
};

export type GunnyPartyRow = {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  place: string;
  notes: string;
  isActive: boolean;
};

export type GunnySaleRow = {
  id: string;
  slNo: number | null;
  date: string;
  party: string;
  bags: number;
  rate: number;
  amount: number;
};

export type GunnyPurchaseOverviewRow = {
  party: string;
  totalBags: number;
  totalAmount: number;
  avgRate: number;
};

export type GunnyPartyLedgerRow = {
  party: string;
  totalBags: number;
  totalPurchase: number;
  totalPaid: number;
  balance: number;
};

export type GunnyBagsOverview = {
  purchases: GunnyPurchaseRow[];
  payments: GunnyPaymentRow[];
  sales: GunnySaleRow[];
  saleParties: string[];
  purchaseOverview: GunnyPurchaseOverviewRow[];
  partyLedger: GunnyPartyLedgerRow[];
  parties: GunnyPartyRow[];
  stockSummary: GunnyBagStockSummary;
};

export type GunnyBagStockSummary = {
  totalBags: number;
  usedBags: number;
  leftBags: number;
};

function n(value: number | string | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toDisplayDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [yyyy, mm, dd] = value.split("-");
    return `${dd}-${mm}-${yyyy}`;
  }
  return value;
}

function normalizeParty(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function toPurchaseRow(row: GunnyPurchaseDbRow): GunnyPurchaseRow {
  return {
    id: row.id,
    slNo: null,
    date: toDisplayDate(row.date),
    party: normalizeParty(row.party),
    bags: n(row.bags),
    rate: n(row.rate),
    amount: n(row.amount),
  };
}

function toPaymentRow(row: GunnyPaymentDbRow): GunnyPaymentRow {
  return {
    id: row.id,
    slNo: null,
    date: toDisplayDate(row.date),
    party: normalizeParty(row.party),
    mode: String(row.mode ?? "").trim(),
    amount: n(row.amount),
  };
}

function toPartyRow(row: GunnyPartyDbRow): GunnyPartyRow {
  return {
    id: row.id,
    name: normalizeParty(row.name),
    contactPerson: String(row.contact_person ?? "").trim(),
    phone: String(row.phone ?? "").trim(),
    place: String(row.place ?? "").trim(),
    notes: String(row.notes ?? "").trim(),
    isActive: Boolean(row.is_active),
  };
}

function toSaleRow(row: GunnySaleDbRow): GunnySaleRow {
  return {
    id: row.id,
    slNo: null,
    date: toDisplayDate(row.date),
    party: normalizeParty(row.party),
    bags: n(row.bags),
    rate: n(row.rate),
    amount: n(row.amount),
  };
}

async function ensureGunnyPartyExists(partyName: string): Promise<void> {
  const normalized = normalizeParty(partyName);
  if (!normalized) return;

  const { data, error } = await supabaseServer
    .from("gunny_bag_parties")
    .select("id")
    .eq("name", normalized)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to validate gunny bag party: ${error.message}`);
  }

  if (data?.id) return;

  const { error: insertError } = await supabaseServer.from("gunny_bag_parties").insert({
    id: crypto.randomUUID(),
    name: normalized,
    contact_person: "",
    phone: "",
    place: "",
    notes: "",
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (insertError) {
    throw new Error(`Failed to create gunny bag party: ${insertError.message}`);
  }
}

async function ensureGunnySalePartyExists(partyName: string): Promise<void> {
  const normalized = normalizeParty(partyName);
  if (!normalized) return;

  const { data, error } = await supabaseServer
    .from("gunny_bag_sale_parties")
    .select("id")
    .eq("name", normalized)
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    throw new Error(`Failed to validate gunny bag sale party: ${error.message}`);
  }

  if (data?.id) return;

  const { error: insertError } = await supabaseServer.from("gunny_bag_sale_parties").insert({
    id: crypto.randomUUID(),
    name: normalized,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (insertError) {
    throw new Error(`Failed to create gunny bag sale party: ${insertError.message}`);
  }
}

export async function getGunnyBagsOverview(): Promise<GunnyBagsOverview> {
  const [purchasesResult, paymentsResult, partiesResult, gunnySalesResult, salePartiesResult] = await Promise.all([
    supabaseServer
      .from("gunny_bag_purchases")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabaseServer
      .from("gunny_bag_payments")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabaseServer
      .from("gunny_bag_parties")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabaseServer
      .from("gunny_bag_sales")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabaseServer
      .from("gunny_bag_sale_parties")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  if (purchasesResult.error) {
    throw new Error(`Failed to load gunny bag purchases: ${purchasesResult.error.message}`);
  }
  if (paymentsResult.error) {
    throw new Error(`Failed to load gunny bag payments: ${paymentsResult.error.message}`);
  }
  if (partiesResult.error) {
    throw new Error(`Failed to load gunny bag parties: ${partiesResult.error.message}`);
  }
  if (gunnySalesResult.error) {
    throw new Error(`Failed to load gunny bag sales: ${gunnySalesResult.error.message}`);
  }
  if (salePartiesResult.error) {
    throw new Error(`Failed to load gunny bag sale parties: ${salePartiesResult.error.message}`);
  }

  const purchases = (purchasesResult.data as GunnyPurchaseDbRow[]).map(toPurchaseRow);
  const payments = (paymentsResult.data as GunnyPaymentDbRow[]).map(toPaymentRow);
  const parties = (partiesResult.data as GunnyPartyDbRow[]).map(toPartyRow);
  const sales = (gunnySalesResult.data as GunnySaleDbRow[]).map(toSaleRow);
  const saleParties = Array.from(
    new Set<string>([
      ...(salePartiesResult.data as GunnySalePartyDbRow[]).map((row) => normalizeParty(row.name)),
      ...sales.map((row) => normalizeParty(row.party)),
    ])
  )
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const totalBags = Number(
    purchases.reduce((sum, row) => sum + row.bags, 0).toFixed(2)
  );
  const usedBags = Number(
    sales
      .reduce((sum, row) => sum + row.bags, 0)
      .toFixed(2)
  );
  const leftBags = Number((totalBags - usedBags).toFixed(2));

  const purchaseByParty = new Map<string, { totalBags: number; totalAmount: number }>();
  for (const row of purchases) {
    const current = purchaseByParty.get(row.party) ?? { totalBags: 0, totalAmount: 0 };
    current.totalBags += row.bags;
    current.totalAmount += row.amount;
    purchaseByParty.set(row.party, current);
  }

  const paidByParty = new Map<string, number>();
  for (const row of payments) {
    paidByParty.set(row.party, (paidByParty.get(row.party) ?? 0) + row.amount);
  }

  const purchaseOverview: GunnyPurchaseOverviewRow[] = [...purchaseByParty.entries()]
    .map(([party, totals]) => ({
      party,
      totalBags: Number(totals.totalBags.toFixed(2)),
      totalAmount: Number(totals.totalAmount.toFixed(2)),
      avgRate: totals.totalBags > 0 ? Number((totals.totalAmount / totals.totalBags).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.totalBags - a.totalBags);

  const partyNames = new Set<string>([
    ...purchaseByParty.keys(),
    ...paidByParty.keys(),
    ...parties.map((party) => party.name),
  ]);

  const partyLedger: GunnyPartyLedgerRow[] = [...partyNames]
    .map((party) => {
      const purchased = purchaseByParty.get(party) ?? { totalBags: 0, totalAmount: 0 };
      const paid = paidByParty.get(party) ?? 0;
      return {
        party,
        totalBags: Number(purchased.totalBags.toFixed(2)),
        totalPurchase: Number(purchased.totalAmount.toFixed(2)),
        totalPaid: Number(paid.toFixed(2)),
        balance: Number((purchased.totalAmount - paid).toFixed(2)),
      };
    })
    .sort((a, b) => b.balance - a.balance);

  return {
    purchases,
    payments,
    sales,
    saleParties,
    purchaseOverview,
    partyLedger,
    parties,
    stockSummary: {
      totalBags,
      usedBags,
      leftBags,
    },
  };
}

export async function getGunnyBagStockSummary(): Promise<GunnyBagStockSummary> {
  const overview = await getGunnyBagsOverview();
  return overview.stockSummary;
}

export async function createGunnyBagPurchase(input: GunnyBagPurchaseInput): Promise<GunnyPurchaseRow> {
  await requireAuth();
  await ensureGunnyPartyExists(input.party);

  const normalizedBags = Number(input.bags.toFixed(2));
  const normalizedRate = Number(input.rate.toFixed(2));
  const computedAmount = Number((normalizedBags * normalizedRate).toFixed(2));
  const normalizedAmount = Number((input.amount ?? computedAmount).toFixed(2));

  const payload = {
    id: crypto.randomUUID(),
    date: input.date,
    party: normalizeParty(input.party),
    bags: normalizedBags,
    rate: normalizedRate,
    amount: normalizedAmount,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("gunny_bag_purchases")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create gunny bag purchase: ${error.message}`);
  }

  return toPurchaseRow(data as GunnyPurchaseDbRow);
}

export async function createGunnyBagPayment(input: GunnyBagPaymentInput): Promise<GunnyPaymentRow> {
  await requireAuth();
  await ensureGunnyPartyExists(input.party);

  const payload = {
    id: crypto.randomUUID(),
    date: input.date,
    party: normalizeParty(input.party),
    mode: input.mode.trim(),
    amount: Number(input.amount.toFixed(2)),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("gunny_bag_payments")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create gunny bag payment: ${error.message}`);
  }

  return toPaymentRow(data as GunnyPaymentDbRow);
}

export async function createGunnyBagSale(input: GunnyBagSaleInput): Promise<GunnySaleRow> {
  await requireAuth();
  await ensureGunnySalePartyExists(input.party);

  const normalizedBags = Number(input.bags.toFixed(2));
  const normalizedRate = Number(input.rate.toFixed(2));
  const computedAmount = Number((normalizedBags * normalizedRate).toFixed(2));
  const normalizedAmount = Number((input.amount ?? computedAmount).toFixed(2));

  const payload = {
    id: crypto.randomUUID(),
    date: input.date,
    party: normalizeParty(input.party),
    bags: normalizedBags,
    rate: normalizedRate,
    amount: normalizedAmount,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("gunny_bag_sales")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create gunny bag sale: ${error.message}`);
  }

  return toSaleRow(data as GunnySaleDbRow);
}

export async function updateGunnyBagPurchase(
  id: string,
  input: GunnyBagPurchaseInput
): Promise<GunnyPurchaseRow> {
  await requireAuth();
  await ensureGunnyPartyExists(input.party);

  const normalizedBags = Number(input.bags.toFixed(2));
  const normalizedRate = Number(input.rate.toFixed(2));
  const computedAmount = Number((normalizedBags * normalizedRate).toFixed(2));
  const normalizedAmount = Number((input.amount ?? computedAmount).toFixed(2));

  const payload = {
    date: input.date,
    party: normalizeParty(input.party),
    bags: normalizedBags,
    rate: normalizedRate,
    amount: normalizedAmount,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("gunny_bag_purchases")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update gunny bag purchase: ${error.message}`);
  }

  return toPurchaseRow(data as GunnyPurchaseDbRow);
}

export async function updateGunnyBagPayment(
  id: string,
  input: GunnyBagPaymentInput
): Promise<GunnyPaymentRow> {
  await requireAuth();
  await ensureGunnyPartyExists(input.party);

  const payload = {
    date: input.date,
    party: normalizeParty(input.party),
    mode: input.mode.trim(),
    amount: Number(input.amount.toFixed(2)),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("gunny_bag_payments")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update gunny bag payment: ${error.message}`);
  }

  return toPaymentRow(data as GunnyPaymentDbRow);
}

export async function updateGunnyBagSale(
  id: string,
  input: GunnyBagSaleInput
): Promise<GunnySaleRow> {
  await requireAuth();
  await ensureGunnySalePartyExists(input.party);

  const normalizedBags = Number(input.bags.toFixed(2));
  const normalizedRate = Number(input.rate.toFixed(2));
  const computedAmount = Number((normalizedBags * normalizedRate).toFixed(2));
  const normalizedAmount = Number((input.amount ?? computedAmount).toFixed(2));

  const payload = {
    date: input.date,
    party: normalizeParty(input.party),
    bags: normalizedBags,
    rate: normalizedRate,
    amount: normalizedAmount,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("gunny_bag_sales")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update gunny bag sale: ${error.message}`);
  }

  return toSaleRow(data as GunnySaleDbRow);
}

export async function deleteGunnyBagPurchase(id: string): Promise<void> {
  await requireAuth();

  const { error } = await supabaseServer
    .from("gunny_bag_purchases")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete gunny bag purchase: ${error.message}`);
  }
}

export async function deleteGunnyBagPayment(id: string): Promise<void> {
  await requireAuth();

  const { error } = await supabaseServer
    .from("gunny_bag_payments")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete gunny bag payment: ${error.message}`);
  }
}

export async function deleteGunnyBagSale(id: string): Promise<void> {
  await requireAuth();

  const { error } = await supabaseServer
    .from("gunny_bag_sales")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete gunny bag sale: ${error.message}`);
  }
}

export async function createGunnyBagParty(input: GunnyBagPartyInput): Promise<GunnyPartyRow> {
  await requireAuth();
  const normalizedName = normalizeParty(input.name);
  if (!normalizedName) throw new Error("Party name is required");

  const payload = {
    id: crypto.randomUUID(),
    name: normalizedName,
    contact_person: String(input.contactPerson ?? "").trim(),
    phone: String(input.phone ?? "").trim(),
    place: String(input.place ?? "").trim(),
    notes: String(input.notes ?? "").trim(),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("gunny_bag_parties")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Party already exists");
    }
    throw new Error(`Failed to create gunny bag party: ${error.message}`);
  }

  return toPartyRow(data as GunnyPartyDbRow);
}

export async function updateGunnyBagParty(
  id: string,
  input: GunnyBagPartyInput
): Promise<GunnyPartyRow> {
  await requireAuth();
  const normalizedName = normalizeParty(input.name);
  if (!normalizedName) throw new Error("Party name is required");

  const payload = {
    name: normalizedName,
    contact_person: String(input.contactPerson ?? "").trim(),
    phone: String(input.phone ?? "").trim(),
    place: String(input.place ?? "").trim(),
    notes: String(input.notes ?? "").trim(),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("gunny_bag_parties")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Party name already exists");
    }
    throw new Error(`Failed to update gunny bag party: ${error.message}`);
  }

  return toPartyRow(data as GunnyPartyDbRow);
}
