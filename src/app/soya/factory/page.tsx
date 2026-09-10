export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { type Bilty } from "@/features/bilty/schemas";
import { SoyaFactoryTableClient } from "@/features/soya-factory/components/SoyaFactoryTableClient";
import { getSoyaFactoryRecords } from "@/features/soya-factory/service/soya-factory.service";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { getFinancialYearBounds } from "@/lib/financial-year";
import { addDays, format } from "date-fns";

export default async function SoyaFactoryPage() {
  await requireSoyaAdminPage();

  let data: Bilty[] = [];
  let loadError: string | null = null;

  try {
    data = await getSoyaFactoryRecords();
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Failed to load soya factory records";
  }

  if (loadError) {
    const friendlyMessage = loadError.includes("soya_bilty")
      ? "The Soya Factory tables are missing in Supabase. Run `supabase/soya-factory.sql` to create them."
      : loadError;

    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Factory Unavailable
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            Unable to load factory records
          </h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">
            {friendlyMessage}
          </p>
        </div>
      </AppShell>
    );
  }

  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const { start: fyStart, end: fyEnd } = getFinancialYearBounds(nowIst);
  const scopedData = data.filter(
    (record) => record.date >= fyStart && record.date <= fyEnd,
  );
  const totals = scopedData.reduce(
    (acc, record) => {
      acc.bags += record.bags;
      acc.weight += record.net_weight;
      acc.amount += record.final_total;
      return acc;
    },
    { bags: 0, weight: 0, amount: 0 },
  );
  const todayKey = format(nowIst, "yyyy-MM-dd");
  const todaysTotals = scopedData.reduce(
    (acc, record) => {
      if (record.date !== todayKey) return acc;
      acc.bags += record.bags;
      acc.weight += record.net_weight;
      return acc;
    },
    { bags: 0, weight: 0 },
  );
  const averageRate = totals.weight > 0 ? totals.amount / totals.weight : 0;
  const last7Start = addDays(nowIst, -6);
  const last7 = scopedData.filter(
    (record) => record.date >= format(last7Start, "yyyy-MM-dd"),
  );
  const last7Totals = last7.reduce(
    (acc, record) => {
      acc.weight += record.net_weight;
      acc.amount += record.final_total;
      return acc;
    },
    { weight: 0, amount: 0 },
  );
  const last7AverageRate =
    last7Totals.weight > 0 ? last7Totals.amount / last7Totals.weight : 0;

  const cardClassName =
    "border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]";
  const valueClassName =
    "text-2xl font-semibold text-[#ff8f6b] sm:text-3xl";

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Factory Overview
        </h1>
        <p className="text-zinc-500">
          Track Soya factory totals, recent activity, and the full record list.
        </p>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-3 sm:mb-3 xl:grid-cols-6">
        <Card className={cardClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total Bags</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className={valueClassName}>
              {formatNumberIN(totals.bags, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </CardContent>
        </Card>
        <Card className={cardClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">
              Total Weight
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className={valueClassName}>
              {formatNumberIN(totals.weight, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              kg
            </p>
          </CardContent>
        </Card>
        <Card className={cardClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className={valueClassName}>
              {formatCurrencyINR(totals.amount, { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className={cardClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">
              Average Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className={valueClassName}>
              {formatCurrencyINR(averageRate, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              /kg
            </p>
            <p className="mt-1 text-sm font-semibold text-[#f6c18a]">
              Last 7 days avg:{" "}
              {formatCurrencyINR(last7AverageRate, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              /kg
            </p>
          </CardContent>
        </Card>
        <Card className={cardClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Today Bags</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className={valueClassName}>
              {formatNumberIN(todaysTotals.bags, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </CardContent>
        </Card>
        <Card className={cardClassName}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">
              Today Weight
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className={valueClassName}>
              {formatNumberIN(todaysTotals.weight, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              kg
            </p>
          </CardContent>
        </Card>
      </div>

      <SoyaFactoryTableClient data={scopedData} addHref="/soya/factory/add" />
    </AppShell>
  );
}
