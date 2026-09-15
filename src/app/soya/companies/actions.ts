"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { requireRole } from "@/features/auth/lib/session";
import {
  createSoyaCompany,
  deleteSoyaCompany,
  getSoyaCompanies,
  updateSoyaCompany,
} from "@/features/soya-companies/service/soya-company.service";
import {
  soyaCompanySchema,
  type SoyaCompany,
} from "@/features/soya-companies/schemas";
import {
  getActiveSoyaCompany,
  SOYA_COMPANY_COOKIE,
  SOYA_COMPANY_COOKIE_MAX_AGE,
} from "@/features/soya/lib/active-company";

export async function createSoyaCompanyAction(data: unknown) {
  const parsed = soyaCompanySchema.parse(data);
  const created = await createSoyaCompany(parsed);
  revalidatePath("/soya", "layout");
  return created;
}

export async function updateSoyaCompanyAction(id: string, data: unknown) {
  const parsed = soyaCompanySchema.parse(data);
  const updated = await updateSoyaCompany(id, parsed);
  revalidatePath("/soya", "layout");
  return updated;
}

export async function deleteSoyaCompanyAction(id: string) {
  await deleteSoyaCompany(id);

  // A deleted company must not stay selected, or every Soya screen would fall
  // back silently and the user would not know which firm they are looking at.
  const store = await cookies();
  if (store.get(SOYA_COMPANY_COOKIE)?.value === id) {
    store.delete(SOYA_COMPANY_COOKIE);
  }
  revalidatePath("/soya", "layout");
}

/** Switches the open company. Every Soya screen re-reads this on next render. */
export async function setActiveSoyaCompanyAction(id: string) {
  await requireRole(["admin"]);

  const companies = await getSoyaCompanies();
  const target = companies.find((company) => company.id === id);
  if (!target) throw new Error("That company no longer exists");
  if (!target.is_active) throw new Error(`${target.name} is marked inactive`);

  const store = await cookies();
  store.set(SOYA_COMPANY_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SOYA_COMPANY_COOKIE_MAX_AGE,
  });
  revalidatePath("/soya", "layout");
}

/**
 * Read side for the switcher, which lives in the client-rendered sidebar and so
 * cannot be handed server data as props.
 */
export async function listSoyaCompaniesAction(): Promise<{
  companies: SoyaCompany[];
  activeId: string;
  /** False when the migration has not been run yet. */
  ready: boolean;
}> {
  await requireRole(["admin"]);
  try {
    const [companies, active] = await Promise.all([
      getSoyaCompanies(),
      getActiveSoyaCompany(),
    ]);
    return { companies, activeId: active?.id ?? "", ready: true };
  } catch {
    return { companies: [], activeId: "", ready: false };
  }
}
