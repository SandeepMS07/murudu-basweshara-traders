import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import {
  soyaCounterpartyGstFields,
  validateCounterpartyGst,
} from "@/features/soya-companies/schemas";
import { stateCodeFromGstin } from "@/features/soya/lib/gst";
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
  .extend({ company_id: z.string().trim().default("") })
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
    registration_type: s(row.registration_type as string) || "regular",
    address: s(row.address as string),
    place: s(row.place as string),
    pincode: s(row.pincode as string),
    phone: s(row.phone as string),
  };
}

/**
 * Everyone on the master, whichever company they belong to.
 *
 * Deliberately NOT filtered by the open company: the three rows that predate
 * companies have company_id null, and hiding them would make them impossible to
 * assign. The UI shows which company each belongs to instead.
 */
export async function getSoyaCounterparties(
  kind: CounterpartyKind,
): Promise<SoyaCounterparty[]> {
  const { data, error } = await supabaseServer
    .from(TABLES[kind])
    .select("id,name,company_id,gstin,state_code,registration_type,address,place,pincode,phone")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(toCounterparty);
}

/** Just the sell-side parties, with enough detail to fill an invoice. */
export async function getSoyaPartiesForInvoicing(
  companyId: string,
): Promise<SoyaCounterparty[]> {
  const all = await getSoyaCounterparties("party");
  // Unassigned parties stay available: excluding them would make an invoice
  // impossible for exactly the rows that predate companies.
  return all.filter((party) => !party.company_id || party.company_id === companyId);
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
    .update({
      company_id: parsed.company_id || null,
      gstin: parsed.gstin,
      state_code: stateCode,
      registration_type: parsed.registration_type,
      address: parsed.address,
      place: parsed.place,
      pincode: parsed.pincode,
      phone: parsed.phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id,name,company_id,gstin,state_code,registration_type,address,place,pincode,phone")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "Another record with this name already belongs to that company. Names are unique per company.",
      );
    }
    throw new Error(error.message);
  }
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
