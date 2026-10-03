import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getSoyaCompanies } from "@/features/soya-companies/service/soya-company.service";
import { getActiveSoyaCompanyScope } from "@/features/soya/lib/company-scope";
import { SoyaPartyForm } from "@/features/soya-parties/components/SoyaPartyForm";
import {
  getNextSoyaPartyIdentifiers,
  getSoyaParties,
} from "@/features/soya-parties/service/soya-party.service";
import { getSoyaFactories } from "@/features/soya-factory/service/soya-factory.service";

export default async function NewSoyaPartyEntryPage() {
  await requireSoyaAdminPage();
  const scope = await getActiveSoyaCompanyScope();

  const today = new Date().toISOString().split("T")[0];
  const [idsResult, partiesResult, factoriesResult] = await Promise.allSettled([
    getNextSoyaPartyIdentifiers(scope, today),
    getSoyaParties(scope),
    getSoyaFactories(scope),
  ]);
  const companies = await getSoyaCompanies().catch(() => []);

  const ids =
    idsResult.status === "fulfilled"
      ? idsResult.value
      : { nextSlNo: 1, nextBillNo: "1" };

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Create Party Entry
        </h1>
        <p className="text-zinc-500">
          Enter the sale details to create a new Soya party entry.
        </p>
      </div>
      <SoyaPartyForm
        companies={companies
          .filter((company) => company.is_active)
          .map((company) => ({ id: company.id, name: company.name }))}
        defaultCompanyId={scope.companyId}
        nextSlNo={ids.nextSlNo}
        nextBillNo={ids.nextBillNo}
        partyOptions={
          partiesResult.status === "fulfilled"
            ? partiesResult.value.map((party) => party.name)
            : []
        }
        factoryOptions={
          factoriesResult.status === "fulfilled"
            ? factoriesResult.value.map((factory) => factory.name)
            : []
        }
      />
    </AppShell>
  );
}
