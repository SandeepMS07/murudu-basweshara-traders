import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import {
  getSoyaParties,
  getSoyaPartyEntries,
  getSoyaPartyPaymentAllocations,
  getSoyaPartyPayments,
} from "@/features/soya-parties/service/soya-party.service";
import { SoyaTradeTableClient } from "@/features/soya-trade/components/SoyaTradeTableClient";
import { soyaPartyColumnsConfig } from "@/features/soya-parties/config";
import { deleteSoyaPartyEntryAction } from "./actions";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { getFinancialYearBounds } from "@/lib/financial-year";
import { computeEffectiveSalePending } from "@/features/companies/lib/payment-allocation";

export default async function SoyaPartiesPage() {
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

  const [entriesResult, partiesResult, paymentsResult, allocationsResult] =
    await Promise.allSettled([
      getSoyaPartyEntries(),
      getSoyaParties(),
      getSoyaPartyPayments(),
      getSoyaPartyPaymentAllocations(),
    ]);

  // Until the migration is applied these reads fail; the page still renders so
  // the module is inspectable rather than erroring outright.
  for (const [label, result] of [
    ["soya party entries", entriesResult],
    ["soya parties", partiesResult],
    ["soya party payments", paymentsResult],
    ["soya party allocations", allocationsResult],
  ] as const) {
    if (result.status === "rejected") {
      console.error(`Failed to load ${label}`, result.reason);
    }
  }

  const entries = entriesResult.status === "fulfilled" ? entriesResult.value : [];
  const parties = partiesResult.status === "fulfilled" ? partiesResult.value : [];
  const payments =
    paymentsResult.status === "fulfilled" ? paymentsResult.value : [];
  const allocations =
    allocationsResult.status === "fulfilled" ? allocationsResult.value : [];

  const scoped = entries.filter(
    (record) => record.sale_date >= fyStart && record.sale_date <= fyEnd,
  );
  const tableRecords = entries.filter(
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
      title: "Total Entries",
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
      title: "Balance Pending",
      value: formatCurrencyINR(totalPending, { maximumFractionDigits: 0 }),
    },
    {
      title: "Total Received",
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
        buyerCompanies={parties}
        pendingBySaleId={tablePendingByRecordId}
        addSaleHref="/soya/parties/new"
        entityLabel="Entry"
        exportFileName="soya_parties"
        columnsConfig={{
          ...soyaPartyColumnsConfig,
          deleteAction: deleteSoyaPartyEntryAction,
        }}
      />
    </AppShell>
  );
}
