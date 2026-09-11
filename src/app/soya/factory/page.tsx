export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaFactoryTableClient } from "@/features/soya-factory/components/SoyaFactoryTableClient";
import {
  getSoyaFactories,
  getSoyaFactoryEntries,
  getSoyaFactoryPayments,
} from "@/features/soya-factory/service/soya-factory.service";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { getFinancialYearBounds } from "@/lib/financial-year";

export default async function SoyaFactoryPage() {
  await requireSoyaAdminPage();

  // Until the migration is applied these reads fail; the page still renders a
  // notice naming the file to run instead of erroring outright.
  const [entriesResult, factoriesResult, paymentsResult] =
    await Promise.allSettled([
      getSoyaFactoryEntries(),
      getSoyaFactories(),
      getSoyaFactoryPayments(),
    ]);

  if (entriesResult.status === "rejected") {
    console.error("Failed to load soya factory entries", entriesResult.reason);
    const message = String(
      entriesResult.reason instanceof Error
        ? entriesResult.reason.message
        : entriesResult.reason,
    );
    const friendly = message.includes("soya_factory")
      ? "The Soya Factory tables are missing in Supabase. Run `supabase/soya-factory.sql` to create them."
      : message;
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Factory Unavailable
          </p>
          <h1 className="mt-2 text-2xl font-bold">Unable to load factory entries</h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">{friendly}</p>
        </div>
      </AppShell>
    );
  }

  const entries = entriesResult.value;
  const factories =
    factoriesResult.status === "fulfilled" ? factoriesResult.value : [];
  const payments =
    paymentsResult.status === "fulfilled" ? paymentsResult.value : [];

  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const { start: fyStart, end: fyEnd } = getFinancialYearBounds(nowIst);
  const scoped = entries.filter(
    (entry) => entry.date >= fyStart && entry.date <= fyEnd,
  );

  const totalBags = scoped.reduce((sum, entry) => sum + entry.bags, 0);
  const totalWeight = scoped.reduce((sum, entry) => sum + entry.weight, 0);
  const totalAmount = scoped.reduce((sum, entry) => sum + entry.total_amount, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  const whole = { minimumFractionDigits: 0, maximumFractionDigits: 0 } as const;
  const cards = [
    { title: "Total Entries", value: formatNumberIN(scoped.length, whole) },
    { title: "Total Bags", value: formatNumberIN(totalBags, whole) },
    { title: "Total Weight", value: `${formatNumberIN(totalWeight, whole)} kg` },
    { title: "Total Amount", value: formatCurrencyINR(totalAmount, whole) },
    { title: "Total Paid", value: formatCurrencyINR(totalPaid, whole) },
    {
      title: "Balance Payable",
      value: formatCurrencyINR(totalAmount - totalPaid, whole),
    },
  ];

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Factory Overview
        </h1>
        <p className="text-zinc-500">
          Soya purchases from factories, for the current financial year.
        </p>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">{card.title}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <SoyaFactoryTableClient
        data={entries}
        factoryNames={factories.map((factory) => factory.name)}
        addHref="/soya/factory/add"
      />
    </AppShell>
  );
}
