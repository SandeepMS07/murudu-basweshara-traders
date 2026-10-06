import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import {
  soyaCounterpartyGstFields,
  validateCounterpartyGst,
} from "@/features/soya-companies/schemas";
import {
  effectiveRegistrationType,
  stateCodeFromGstin,
} from "@/features/soya/lib/gst";
import {
  companyScopeFilter,
  getSoyaCompanyScopeFor,
  type SoyaCompanyScope,
} from "@/features/soya/lib/company-scope";
import { z } from "zod";

/**
 * GST identity on the two counterparty masters — factories we buy from, and
 * parties we sell to.
 *
 * One module for both because the shape is identical and a firm can be both. It
 * deliberately does NOT touch the ledger services: those own the name, the
 * entries and the payments, and this owns only the GST columns the invoicing
 * work added. Keeping the write paths separate means the invoicing feature
 * cannot regress the trading ledger that already works.
 */

export type CounterpartyKind = "factory" | "party";

const TABLES: Record<CounterpartyKind, string> = {
  factory: "soya_factories",
  party: "soya_parties",
};

/** Where a counterparty's bills and payments live, for the delete guard. */
const USAGE: Record<
  CounterpartyKind,
  { entries: string; nameColumn: string; payments: string; idColumn: string; label: string }
> = {
  factory: {
    entries: "soya_factory_entries",
    nameColumn: "factory",
    payments: "soya_factory_payments",
    idColumn: "factory_id",
    label: "Factory",
  },
  party: {
    entries: "soya_party_entries",
    nameColumn: "party",
    payments: "soya_party_payments",
    idColumn: "party_id",
    label: "Party",
  },
};

const COLUMNS =
  "id,name,company_id,gstin,state_code,registration_type,address,place,pincode,phone";

export interface SoyaCounterparty {
  id: string;
  name: string;
  company_id: string;
  gstin: string;
  state_code: string;
  registration_type: string;
  address: string;
  place: string;
  pincode: string;
  phone: string;
}

export const counterpartyGstSchema = z
  .object(soyaCounterpartyGstFields)
  .superRefine(validateCounterpartyGst);

export type CounterpartyGstInput = z.infer<typeof counterpartyGstSchema>;

function s(value: string | null | undefined): string {
  return value ?? "";
}

function toCounterparty(row: Record<string, unknown>): SoyaCounterparty {
  return {
    id: String(row.id),
    name: String(row.name),
    company_id: s(row.company_id as string),
    gstin: s(row.gstin as string),
    state_code: s(row.state_code as string),
    // Read through the GSTIN rule, so a no-GSTIN party saved before it existed
    // still reaches the invoice form as URD.
    registration_type: effectiveRegistrationType(
      s(row.gstin as string),
      s(row.registration_type as string),
    ),
    address: s(row.address as string),
    place: s(row.place as string),
    pincode: s(row.pincode as string),
    phone: s(row.phone as string),
  };
}

/**
 * The open company's counterparties, the same set its ledger lists — so the
 * GST table and the ledger below it always agree. Deleted rows are left out.
 * Unassigned rows belong to the default company (see company-scope.ts).
 */
export async function getSoyaCounterparties(
  kind: CounterpartyKind,
  scope: SoyaCompanyScope,
): Promise<SoyaCounterparty[]> {
  const { data, error } = await supabaseServer
    .from(TABLES[kind])
    .select(COLUMNS)
    .is("deleted_at", null)
    .or(companyScopeFilter(scope))
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toCounterparty);
}

/** Just the sell-side parties, with enough detail to fill an invoice. */
export async function getSoyaPartiesForInvoicing(
  companyId: string,
): Promise<SoyaCounterparty[]> {
  return getSoyaCounterparties("party", await getSoyaCompanyScopeFor(companyId));
}

export async function updateSoyaCounterpartyGst(
  kind: CounterpartyKind,
  id: string,
  input: CounterpartyGstInput,
): Promise<SoyaCounterparty> {
  await requireRole(["admin"]);
  const parsed = counterpartyGstSchema.parse(input);

  // The GSTIN is authoritative about the state; a mismatched manual choice is
  // a typo, not an override.
  const derived = stateCodeFromGstin(parsed.gstin);
  const stateCode = derived || parsed.state_code;

  const { data, error } = await supabaseServer
    .from(TABLES[kind])
    // GST details only. Which company a counterparty belongs to is not edited
    // here: each company's screen shows its own records.
    .update({
      gstin: parsed.gstin,
      state_code: stateCode,
      registration_type: effectiveRegistrationType(parsed.gstin, parsed.registration_type),
      address: parsed.address,
      place: parsed.place,
      pincode: parsed.pincode,
      phone: parsed.phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toCounterparty(data);
}

/** Moves every unassigned row onto a company in one step. */
export async function assignUnassignedCounterparties(
  kind: CounterpartyKind,
  companyId: string,
): Promise<number> {
  await requireRole(["admin"]);
  const { data, error } = await supabaseServer
    .from(TABLES[kind])
    .update({ company_id: companyId, updated_at: new Date().toISOString() })
    .is("company_id", null)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

/**
 * Hides a counterparty (sets deleted_at); nothing is erased, and adding the same
 * name again in the same company brings it back.
 *
 * Refused while it has bills or payments in its company: its payments only
 * count towards balances through a visible record, so hiding one in use would
 * silently change what is owed.
 */
export async function softDeleteSoyaCounterparty(
  kind: CounterpartyKind,
  id: string,
): Promise<void> {
  await requireRole(["admin"]);
  const usage = USAGE[kind];

  const { data: row, error: rowError } = await supabaseServer
    .from(TABLES[kind])
    .select("id,name,company_id,deleted_at")
    .eq("id", id)
    .maybeSingle();
  if (rowError) throw new Error(rowError.message);
  if (!row || row.deleted_at) throw new Error(`${usage.label} not found`);

  const scope = await getSoyaCompanyScopeFor(row.company_id as string | null);
  const [entries, payments] = await Promise.all([
    supabaseServer
      .from(usage.entries)
      .select("id", { head: true, count: "exact" })
      .eq(usage.nameColumn, row.name)
      .or(companyScopeFilter(scope)),
    supabaseServer
      .from(usage.payments)
      .select("id", { head: true, count: "exact" })
      .eq(usage.idColumn, id),
  ]);
  if (entries.error) throw new Error(entries.error.message);
  if (payments.error) throw new Error(payments.error.message);

  const bills = entries.count ?? 0;
  const paid = payments.count ?? 0;
  if (bills > 0 || paid > 0) {
    const parts = [
      bills ? `${bills} bill${bills === 1 ? "" : "s"}` : "",
      paid ? `${paid} payment${paid === 1 ? "" : "s"}` : "",
    ].filter(Boolean);
    throw new Error(
      `Cannot delete ${row.name}: it still has ${parts.join(" and ")} in this company.`,
    );
  }

  const { error } = await supabaseServer
    .from(TABLES[kind])
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
