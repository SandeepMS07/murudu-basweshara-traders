import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaFactoryForm } from "@/features/soya-factory/components/SoyaFactoryForm";
import {
  getNextSoyaFactoryBillNoPreview,
  getSoyaFactoryParties,
} from "@/features/soya-factory/service/soya-factory.service";

export default async function NewSoyaFactoryEntryPage() {
  await requireSoyaAdminPage();

  const today = new Date().toISOString().split("T")[0];

  // Until the migration is applied these reads fail; the form still renders so
  // the module is inspectable rather than erroring outright.
  const [nextBillNoResult, partiesResult] = await Promise.allSettled([
    getNextSoyaFactoryBillNoPreview(today),
    getSoyaFactoryParties(),
  ]);

  const nextBillNo =
    nextBillNoResult.status === "fulfilled" ? nextBillNoResult.value : 1;
  const parties = partiesResult.status === "fulfilled" ? partiesResult.value : [];

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Create Factory Entry
        </h1>
        <p className="text-zinc-500">
          Enter the details to create a new Soya factory entry.
        </p>
      </div>
      <SoyaFactoryForm
        nextBillNo={nextBillNo}
        partyOptions={parties.map((party) => party.name)}
      />
    </AppShell>
  );
}
