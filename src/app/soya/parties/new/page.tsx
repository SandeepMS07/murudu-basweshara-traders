import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaTradeForm } from "@/features/soya-trade/components/SoyaTradeForm";
import { soyaPartyLabels } from "@/features/soya-parties/config";
import {
  getNextSoyaPartyIdentifiersForDate,
  getSoyaParties,
  getSoyaPartyIssuers,
} from "@/features/soya-parties/service/soya-party.service";
import {
  createSoyaPartyAction,
  createSoyaPartyEntryAction,
  getNextSoyaPartyBillNumberAction,
  updateSoyaPartyEntryAction,
} from "../actions";

export default async function NewSoyaPartyEntryPage() {
  await requireSoyaAdminPage();

  const [partiesResult, issuersResult, nextIdsResult] = await Promise.allSettled(
    [
      getSoyaParties(),
      getSoyaPartyIssuers(),
      getNextSoyaPartyIdentifiersForDate(
        new Date().toISOString().split("T")[0],
      ),
    ],
  );

  const parties = partiesResult.status === "fulfilled" ? partiesResult.value : [];
  const issuers = issuersResult.status === "fulfilled" ? issuersResult.value : [];
  const nextIds =
    nextIdsResult.status === "fulfilled"
      ? nextIdsResult.value
      : { nextSlNo: 1, nextBillNumber: "1" };

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Create Party Entry
        </h1>
        <p className="text-zinc-500">
          Enter the details to create a new Soya party entry.
        </p>
      </div>
      <SoyaTradeForm
        buyerCompanies={parties}
        issuerCompanies={issuers}
        canCreateBuyer
        initialSlNo={nextIds.nextSlNo}
        initialBillNumber={nextIds.nextBillNumber}
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
