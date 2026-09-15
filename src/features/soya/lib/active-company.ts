import { cookies } from "next/headers";

import {
  getDefaultSoyaCompany,
  getSoyaCompanyById,
} from "@/features/soya-companies/service/soya-company.service";
import type { SoyaCompany } from "@/features/soya-companies/schemas";

/**
 * Which trading firm the Soya screens are currently showing.
 *
 * Held in a cookie rather than the URL, which mirrors how Tally works — one
 * company open at a time, switched deliberately. The trade-off is that a Soya
 * URL is not company-specific, so two tabs cannot show two companies at once
 * and a shared link opens in whichever company the reader last used. To keep
 * that from being a silent hazard, the open company is displayed on every Soya
 * screen; see SoyaCompanySwitcher. If per-company URLs are wanted later, the
 * routes move under /soya/[companyId] and this reads the segment instead.
 */
export const SOYA_COMPANY_COOKIE = "soya_company";

/** A year: this is a workspace preference, not a credential. */
export const SOYA_COMPANY_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The open company, or null when none has been created yet — which the pages
 * turn into a "create your first company" prompt rather than an error.
 *
 * Falls back to the default company when the cookie names one that has been
 * deleted or deactivated, so a stale cookie can never strand the user.
 */
export async function getActiveSoyaCompany(): Promise<SoyaCompany | null> {
  const store = await cookies();
  const id = store.get(SOYA_COMPANY_COOKIE)?.value;

  if (id) {
    const company = await getSoyaCompanyById(id);
    if (company && company.is_active) return company;
  }
  return getDefaultSoyaCompany();
}

/** The open company's id, or "" — convenient for scoping a query. */
export async function getActiveSoyaCompanyId(): Promise<string> {
  const company = await getActiveSoyaCompany();
  return company?.id ?? "";
}
