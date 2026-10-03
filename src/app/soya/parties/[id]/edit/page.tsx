import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getSoyaCompanies } from "@/features/soya-companies/service/soya-company.service";
import { getSoyaCompanyScopeFor } from "@/features/soya/lib/company-scope";
import { SoyaPartyForm } from "@/features/soya-parties/components/SoyaPartyForm";
import {
  getSoyaParties,
  getSoyaPartyEntryById,
} from "@/features/soya-parties/service/soya-party.service";
import { getSoyaFactories } from "@/features/soya-factory/service/soya-factory.service";

export default async function EditSoyaPartyEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSoyaAdminPage();

  const { id } = await params;
  const entry = await getSoyaPartyEntryById(id);
  if (!entry) {
    notFound();
  }

  // Options come from the entry's own company, not the sidebar's.
  const scope = await getSoyaCompanyScopeFor(entry.company_id);
  const [parties, factories, companies] = await Promise.all([
    getSoyaParties(scope),
    getSoyaFactories(scope),
    getSoyaCompanies(),
  ]);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Edit Party Entry
        </h1>
        <p className="text-zinc-500">
          Update the details for BILL NO {entry.bill_no || "-"}.
        </p>
      </div>
      <SoyaPartyForm
        companies={companies
          .filter((company) => company.is_active)
          .map((company) => ({ id: company.id, name: company.name }))}
        defaultCompanyId={scope.companyId}
        initialData={entry}
        partyOptions={parties.map((party) => party.name)}
        factoryOptions={factories.map((factory) => factory.name)}
      />
    </AppShell>
  );
}
