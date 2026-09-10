import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaTradeForm } from "@/features/soya-trade/components/SoyaTradeForm";
import { soyaPurchaseLabels } from "@/features/soya-purchases/config";
import {
  getNextSoyaPurchaseIdentifiersForDate,
  getSoyaPurchaseIssuers,
  getSoyaSuppliers,
} from "@/features/soya-purchases/service/soya-purchase.service";
import {
  createSoyaPurchaseAction,
  createSoyaSupplierAction,
  getNextSoyaPurchaseBillNumberAction,
  updateSoyaPurchaseAction,
} from "../actions";

export default async function NewSoyaPurchasePage() {
  await requireSoyaAdminPage();

  const [suppliersResult, issuersResult, nextIdsResult] =
    await Promise.allSettled([
      getSoyaSuppliers(),
      getSoyaPurchaseIssuers(),
      getNextSoyaPurchaseIdentifiersForDate(
        new Date().toISOString().split("T")[0],
      ),
    ]);

  const suppliers =
    suppliersResult.status === "fulfilled" ? suppliersResult.value : [];
  const issuers =
    issuersResult.status === "fulfilled" ? issuersResult.value : [];
  const nextIds =
    nextIdsResult.status === "fulfilled"
      ? nextIdsResult.value
      : { nextSlNo: 1, nextBillNumber: "1" };

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Create Soya Purchase
        </h1>
        <p className="text-zinc-500">
          Enter purchase details to create a new entry.
        </p>
      </div>
      <SoyaTradeForm
        buyerCompanies={suppliers}
        issuerCompanies={issuers}
        canCreateBuyer
        initialSlNo={nextIds.nextSlNo}
        initialBillNumber={nextIds.nextBillNumber}
        entityLabel={soyaPurchaseLabels.entityLabel}
        partyLabel={soyaPurchaseLabels.partyLabel}
        listHref={soyaPurchaseLabels.listHref}
        partyType={soyaPurchaseLabels.partyType}
        createAction={createSoyaPurchaseAction}
        updateAction={updateSoyaPurchaseAction}
        nextBillNumberAction={getNextSoyaPurchaseBillNumberAction}
        createPartyAction={createSoyaSupplierAction}
      />
    </AppShell>
  );
}
