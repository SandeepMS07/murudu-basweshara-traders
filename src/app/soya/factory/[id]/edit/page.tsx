import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
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

  const [factories, parties] = await Promise.all([
    getSoyaFactories(),
    getSoyaParties(),
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
        initialData={entry}
        factoryOptions={factories.map((factory) => factory.name)}
        partyOptions={parties.map((party) => party.name)}
      />
    </AppShell>
  );
}
