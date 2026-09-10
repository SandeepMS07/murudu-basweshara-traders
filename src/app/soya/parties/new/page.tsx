import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaPartyForm } from "@/features/soya-parties/components/SoyaPartyForm";
import {
  getNextSoyaPartyIdentifiers,
  getSoyaParties,
} from "@/features/soya-parties/service/soya-party.service";
import { getSoyaFactories } from "@/features/soya-factory/service/soya-factory.service";

export default async function NewSoyaPartyEntryPage() {
  await requireSoyaAdminPage();

  const today = new Date().toISOString().split("T")[0];
  const [idsResult, partiesResult, factoriesResult] = await Promise.allSettled([
    getNextSoyaPartyIdentifiers(today),
    getSoyaParties(),
    getSoyaFactories(),
  ]);

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
