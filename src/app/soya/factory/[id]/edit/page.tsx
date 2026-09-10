import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaFactoryForm } from "@/features/soya-factory/components/SoyaFactoryForm";
import {
  getSoyaFactoryParties,
  getSoyaFactoryRecordById,
} from "@/features/soya-factory/service/soya-factory.service";

export default async function EditSoyaFactoryEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSoyaAdminPage();

  const { id } = await params;
  const record = await getSoyaFactoryRecordById(id);
  if (!record) {
    notFound();
  }

  const parties = await getSoyaFactoryParties();

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Edit Factory Entry
        </h1>
        <p className="text-zinc-500">
          Update the details for bill {record.bill_no || "-"}.
        </p>
      </div>
      <SoyaFactoryForm
        initialData={record}
        partyOptions={parties.map((party) => party.name)}
      />
    </AppShell>
  );
}
