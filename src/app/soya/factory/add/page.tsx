import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getSoyaCompanies } from "@/features/soya-companies/service/soya-company.service";
import { getActiveSoyaCompanyScope } from "@/features/soya/lib/company-scope";
import { SoyaFactoryForm } from "@/features/soya-factory/components/SoyaFactoryForm";
import {
  getNextSoyaFactorySlNo,
  getSoyaFactories,
} from "@/features/soya-factory/service/soya-factory.service";
import { getSoyaParties } from "@/features/soya-parties/service/soya-party.service";

export default async function NewSoyaFactoryEntryPage() {
  await requireSoyaAdminPage();
  const scope = await getActiveSoyaCompanyScope();

  const today = new Date().toISOString().split("T")[0];
  const [slNoResult, factoriesResult, partiesResult] = await Promise.allSettled([
    getNextSoyaFactorySlNo(scope, today),
    getSoyaFactories(scope),
    getSoyaParties(scope),
  ]);
  const companies = await getSoyaCompanies().catch(() => []);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Create Factory Entry
        </h1>
        <p className="text-zinc-500">
          Enter the purchase details to create a new Soya factory entry.
        </p>
      </div>
      <SoyaFactoryForm
        companies={companies
          .filter((company) => company.is_active)
          .map((company) => ({ id: company.id, name: company.name }))}
        defaultCompanyId={scope.companyId}
        nextSlNo={slNoResult.status === "fulfilled" ? slNoResult.value : 1}
        factoryOptions={
          factoriesResult.status === "fulfilled"
            ? factoriesResult.value.map((factory) => factory.name)
            : []
        }
        partyOptions={
          partiesResult.status === "fulfilled"
            ? partiesResult.value.map((party) => party.name)
            : []
        }
      />
    </AppShell>
  );
}
