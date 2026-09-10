import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
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

  const [parties, factories] = await Promise.all([
    getSoyaParties(),
    getSoyaFactories(),
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
        initialData={entry}
        partyOptions={parties.map((party) => party.name)}
        factoryOptions={factories.map((factory) => factory.name)}
      />
    </AppShell>
  );
}
