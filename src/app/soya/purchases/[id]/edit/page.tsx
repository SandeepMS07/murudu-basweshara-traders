import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaTradeForm } from "@/features/soya-trade/components/SoyaTradeForm";
import { soyaPurchaseLabels } from "@/features/soya-purchases/config";
import {
  getSoyaPurchaseById,
  getSoyaPurchaseIssuers,
  getSoyaSuppliers,
} from "@/features/soya-purchases/service/soya-purchase.service";
import {
  createSoyaPurchaseAction,
  createSoyaSupplierAction,
  getNextSoyaPurchaseBillNumberAction,
  updateSoyaPurchaseAction,
} from "../../actions";

export default async function EditSoyaPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSoyaAdminPage();

  const { id } = await params;
  const record = await getSoyaPurchaseById(id);
  if (!record) {
    notFound();
  }

  const [suppliers, issuers] = await Promise.all([
    getSoyaSuppliers(),
    getSoyaPurchaseIssuers(),
  ]);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Edit Soya Purchase
        </h1>
        <p className="text-zinc-500">
          Update the details for bill {record.bill_number}.
        </p>
      </div>
      <SoyaTradeForm
        initialData={record}
        buyerCompanies={suppliers}
        issuerCompanies={issuers}
        canCreateBuyer
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
