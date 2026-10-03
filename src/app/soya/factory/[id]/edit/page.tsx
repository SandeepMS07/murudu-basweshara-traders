import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getSoyaCompanies } from "@/features/soya-companies/service/soya-company.service";
import { getSoyaCompanyScopeFor } from "@/features/soya/lib/company-scope";
import { SoyaFactoryForm } from "@/features/soya-factory/components/SoyaFactoryForm";
import {
  getSoyaFactories,
  getSoyaFactoryEntryById,
} from "@/features/soya-factory/service/soya-factory.service";
import { getSoyaParties } from "@/features/soya-parties/service/soya-party.service";

export default async function EditSoyaFactoryEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSoyaAdminPage();

  const { id } = await params;
  const entry = await getSoyaFactoryEntryById(id);
  if (!entry) {
    notFound();
  }

  // Options come from the entry's own company, not the sidebar's.
  const scope = await getSoyaCompanyScopeFor(entry.company_id);
  const [factories, parties, companies] = await Promise.all([
    getSoyaFactories(scope),
    getSoyaParties(scope),
    getSoyaCompanies(),
  ]);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Edit Factory Entry
        </h1>
        <p className="text-zinc-500">
          Update the details for P B NO {entry.pb_no || "-"}.
        </p>
      </div>
      <SoyaFactoryForm
        companies={companies
          .filter((company) => company.is_active)
          .map((company) => ({ id: company.id, name: company.name }))}
        defaultCompanyId={scope.companyId}
        initialData={entry}
        factoryOptions={factories.map((factory) => factory.name)}
        partyOptions={parties.map((party) => party.name)}
      />
    </AppShell>
  );
}
