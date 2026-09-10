import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaTradeForm } from "@/features/soya-trade/components/SoyaTradeForm";
import { soyaPartyLabels } from "@/features/soya-parties/config";
import {
  getSoyaParties,
  getSoyaPartyEntryById,
  getSoyaPartyIssuers,
} from "@/features/soya-parties/service/soya-party.service";
import {
  createSoyaPartyAction,
  createSoyaPartyEntryAction,
  getNextSoyaPartyBillNumberAction,
  updateSoyaPartyEntryAction,
} from "../../actions";

export default async function EditSoyaPartyEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSoyaAdminPage();

  const { id } = await params;
  const record = await getSoyaPartyEntryById(id);
  if (!record) {
    notFound();
  }

  const [parties, issuers] = await Promise.all([
    getSoyaParties(),
    getSoyaPartyIssuers(),
  ]);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Edit Party Entry
        </h1>
        <p className="text-zinc-500">
          Update the details for bill {record.bill_number}.
        </p>
      </div>
      <SoyaTradeForm
        initialData={record}
        buyerCompanies={parties}
        issuerCompanies={issuers}
        canCreateBuyer
        entityLabel={soyaPartyLabels.entityLabel}
        partyLabel={soyaPartyLabels.partyLabel}
        listHref={soyaPartyLabels.listHref}
        partyType={soyaPartyLabels.partyType}
        createAction={createSoyaPartyEntryAction}
        updateAction={updateSoyaPartyEntryAction}
        nextBillNumberAction={getNextSoyaPartyBillNumberAction}
        createPartyAction={createSoyaPartyAction}
      />
    </AppShell>
  );
}
