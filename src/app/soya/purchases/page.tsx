import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import {
  getSoyaPurchases,
  getSoyaSuppliers,
  getSoyaSupplierPaymentAllocations,
  getSoyaSupplierPayments,
} from "@/features/soya-purchases/service/soya-purchase.service";
import { SoyaTradeTableClient } from "@/features/soya-trade/components/SoyaTradeTableClient";
import { soyaPurchaseColumnsConfig } from "@/features/soya-purchases/config";
import { deleteSoyaPurchaseAction } from "./actions";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { getFinancialYearBounds } from "@/lib/financial-year";
import { computeEffectiveSalePending } from "@/features/companies/lib/payment-allocation";

export default async function SoyaPurchasesPage() {
  await requireSoyaAdminPage();

  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const { start: fyStart, end: fyEnd } = getFinancialYearBounds(nowIst);
  const lastFyReference = new Date(
    nowIst.getFullYear() - 1,
    nowIst.getMonth(),
    nowIst.getDate(),
  );
  const { start: lastFyStart } = getFinancialYearBounds(lastFyReference);

  const [purchasesResult, suppliersResult, paymentsResult, allocationsResult] =
    await Promise.allSettled([
      getSoyaPurchases(),
      getSoyaSuppliers(),
      getSoyaSupplierPayments(),
      getSoyaSupplierPaymentAllocations(),
    ]);

  // Until the migration is applied these reads fail; the page still renders so
  // the module is inspectable rather than erroring outright.
  for (const [label, result] of [
    ["soya purchases", purchasesResult],
    ["soya suppliers", suppliersResult],
    ["soya supplier payments", paymentsResult],
    ["soya supplier allocations", allocationsResult],
  ] as const) {
    if (result.status === "rejected") {
      console.error(`Failed to load ${label}`, result.reason);
    }
  }

  const purchases =
    purchasesResult.status === "fulfilled" ? purchasesResult.value : [];
  const suppliers =
    suppliersResult.status === "fulfilled" ? suppliersResult.value : [];
  const payments =
    paymentsResult.status === "fulfilled" ? paymentsResult.value : [];
  const allocations =
    allocationsResult.status === "fulfilled" ? allocationsResult.value : [];

  const scoped = purchases.filter(
    (record) => record.sale_date >= fyStart && record.sale_date <= fyEnd,
  );
  const tableRecords = purchases.filter(
    (record) => record.sale_date >= lastFyStart && record.sale_date <= fyEnd,
  );

  const totalNetWeight = scoped.reduce((sum, r) => sum + r.net_weight, 0);
  const totalAmount = scoped.reduce((sum, r) => sum + r.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  const pendingByRecordId =
    payments.length > 0 || allocations.length > 0
      ? computeEffectiveSalePending(scoped, payments, allocations).pendingBySaleId
      : {};
  const totalPending = scoped.reduce(
    (sum, r) => sum + (pendingByRecordId[r.id] ?? r.pending_amount),
    0,
  );

  const tablePendingByRecordId =
    payments.length > 0 || allocations.length > 0
      ? computeEffectiveSalePending(tableRecords, payments, allocations)
          .pendingBySaleId
      : {};

  const cards = [
    {
      title: "Total Purchases",
      value: formatNumberIN(scoped.length, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    },
    {
      title: "Total Net Weight",
      value: `${formatNumberIN(totalNetWeight, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} kg`,
    },
    {
      title: "Total Amount",
      value: formatCurrencyINR(totalAmount, { maximumFractionDigits: 0 }),
    },
    {
      title: "Balance Payable",
      value: formatCurrencyINR(totalPending, { maximumFractionDigits: 0 }),
    },
    {
      title: "Total Paid",
      value: formatCurrencyINR(totalPaid, { maximumFractionDigits: 0 }),
    },
  ];

  return (
    <AppShell>
      <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-5">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SoyaTradeTableClient
        data={tableRecords}
        buyerCompanies={suppliers}
        pendingBySaleId={tablePendingByRecordId}
        addSaleHref="/soya/purchases/new"
        entityLabel="Purchase"
        exportFileName="soya_purchases"
        columnsConfig={{
          ...soyaPurchaseColumnsConfig,
          deleteAction: deleteSoyaPurchaseAction,
        }}
      />
    </AppShell>
  );
}
