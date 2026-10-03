import "server-only";

import {
  getDefaultSoyaCompany,
  getSoyaCompanyById,
} from "@/features/soya-companies/service/soya-company.service";
import { getActiveSoyaCompany } from "@/features/soya/lib/active-company";

/**
 * Which company's Factory and Parties rows a query may see.
 *
 * Rows saved before company_id existed have it NULL, and nobody can say which
 * firm each belonged to. They are treated as the DEFAULT company's — shown
 * under it, counted in its bill-number series, and given its id the next time
 * they are saved — so they are never invisible and never counted twice.
 * `supabase/soya-company-backfill.sql` writes that assignment permanently; this
 * keeps the app correct whether or not it has been run. A row can be moved to
 * another company from its edit form.
 */
export type SoyaCompanyScope = {
  /** "" only when no company exists yet; then just unassigned rows match. */
  companyId: string;
  /** True for the default company: it also owns the unassigned rows. */
  includeUnassigned: boolean;
};

// Ids are generated with crypto.randomUUID(). Checked because the id is
// interpolated into a PostgREST `or` filter string.
const SAFE_ID = /^[A-Za-z0-9-]+$/;

async function defaultCompanyId(): Promise<string> {
  return (await getDefaultSoyaCompany())?.id ?? "";
}

function build(companyId: string, defaultId: string): SoyaCompanyScope {
  if (companyId && !SAFE_ID.test(companyId)) {
    throw new Error("Invalid company id");
  }
  return { companyId, includeUnassigned: !companyId || companyId === defaultId };
}

/** The company open in the sidebar. */
export async function getActiveSoyaCompanyScope(): Promise<SoyaCompanyScope> {
  const [active, defaultId] = await Promise.all([
    getActiveSoyaCompany(),
    defaultCompanyId(),
  ]);
  return build(active?.id ?? defaultId, defaultId);
}

/**
 * The scope a stored row belongs to — for a statement or rename that must
 * follow the record, not whichever company the sidebar has open.
 */
export async function getSoyaCompanyScopeFor(
  companyId: string | null | undefined,
): Promise<SoyaCompanyScope> {
  const defaultId = await defaultCompanyId();
  if (!companyId) return build(defaultId, defaultId);

  const company = await getSoyaCompanyById(companyId);
  if (!company) throw new Error("Company not found");
  return build(company.id, defaultId);
}

/** A company picked on a form, or the sidebar's when none was picked. */
export async function resolveSoyaCompanyScope(
  companyId?: string,
): Promise<SoyaCompanyScope> {
  return companyId ? getSoyaCompanyScopeFor(companyId) : getActiveSoyaCompanyScope();
}

/**
 * A PostgREST `or` filter selecting the scope's rows on a table with a
 * `company_id` column. Use as `query.or(companyScopeFilter(scope))`; a
 * one-condition `or` is valid and keeps every call site the same shape.
 */
export function companyScopeFilter(scope: SoyaCompanyScope): string {
  if (!scope.companyId) return "company_id.is.null";
  if (scope.includeUnassigned) {
    return `company_id.eq.${scope.companyId},company_id.is.null`;
  }
  return `company_id.eq.${scope.companyId}`;
}
