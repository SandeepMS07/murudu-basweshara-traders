export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaCompaniesManager } from "@/features/soya-companies/components/SoyaCompaniesManager";
import { getSoyaCompanies } from "@/features/soya-companies/service/soya-company.service";
import { getActiveSoyaCompany } from "@/features/soya/lib/active-company";

export default async function SoyaCompaniesPage() {
  await requireSoyaAdminPage();

  // Until the migration is applied this read fails; the page names the file to
  // run rather than erroring outright, matching the other Soya screens.
  let companies;
  try {
    companies = await getSoyaCompanies();
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    const friendly = message.includes("soya_companies")
      ? "The Soya company table is missing in Supabase. Run `supabase/soya-companies.sql` to create it."
      : message;
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Companies Unavailable
          </p>
          <h1 className="mt-2 text-2xl font-bold">Unable to load companies</h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">{friendly}</p>
        </div>
      </AppShell>
    );
  }

  const active = await getActiveSoyaCompany();

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Companies
        </h1>
        <p className="text-zinc-500">
          The trading firms you invoice from. Everything in Soya — factories,
          parties and bills — belongs to one of them.
        </p>
      </div>

      <SoyaCompaniesManager
        companies={companies}
        activeId={active?.id ?? ""}
      />
    </AppShell>
  );
}
