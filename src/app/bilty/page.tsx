export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BiltysTableClient } from "@/features/bilty/components/BiltysTableClient";
import { type Bilty } from "@/features/bilty/schemas";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { addDays, format } from "date-fns";
import { getFinancialYearBounds } from "@/lib/financial-year";
import { getBiltys } from "@/features/bilty/service/bilty.service";

export default async function BiltyPage() {
  await requireAuth();
  let data: Bilty[] = [];
  let loadError: string | null = null;

  try {
    data = await getBiltys();
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Failed to load bilty records";
  }

  if (loadError) {
    const friendlyMessage = loadError.includes("public.bilty")
      ? "Bilty table is missing in Supabase. Run the updated `supabase/schema.sql` to create it."
      : loadError;

    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Bilty Unavailable
          </p>
          <h1 className="mt-2 text-2xl font-bold">Unable to load bilty records</h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">
            {friendlyMessage}
          </p>
        </div>
      </AppShell>
    );
  }

  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const { start: fyStart, end: fyEnd } = getFinancialYearBounds(nowIst);
  const scopedData = data.filter(
    (bilty) => bilty.date >= fyStart && bilty.date <= fyEnd
  );
  const totals = scopedData.reduce(
    (acc, bilty) => {
      acc.bags += bilty.bags;
      acc.weight += bilty.net_weight;
      acc.amount += bilty.final_total;
      return acc;
    },
    { bags: 0, weight: 0, amount: 0 },
  );
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todaysTotals = scopedData.reduce(
    (acc, bilty) => {
      if (bilty.date !== todayKey) return acc;
      acc.bags += bilty.bags;
      acc.weight += bilty.net_weight;
      return acc;
    },
    { bags: 0, weight: 0 },
  );
  const averageRate = totals.weight > 0 ? totals.amount / totals.weight : 0;
  const today = new Date();
  const last7Start = addDays(today, -6);
  const last7 = scopedData.filter(
    (bilty) => bilty.date >= format(last7Start, "yyyy-MM-dd"),
  );
  const last7Totals = last7.reduce(
    (acc, bilty) => {
      acc.weight += bilty.net_weight;
      acc.amount += bilty.final_total;
      return acc;
    },
    { weight: 0, amount: 0 },
  );
  const last7AverageRate =
    last7Totals.weight > 0 ? last7Totals.amount / last7Totals.weight : 0;

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Bilty Overview
        </h1>
        <p className="text-zinc-500">
          Track bilty totals, recent activity, and the full record list.
        </p>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-3 sm:mb-3 xl:grid-cols-6">
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total Bags</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
              {formatNumberIN(totals.bags, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total Weight</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
              {formatNumberIN(totals.weight, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              kg
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total Amount</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
              {formatCurrencyINR(totals.amount, {
                maximumFractionDigits: 0,
              })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">
              Average Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
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
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Today Bags</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
              {formatNumberIN(todaysTotals.bags, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">
              Today Weight
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
              {formatNumberIN(todaysTotals.weight, {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}{" "}
              kg
            </p>
          </CardContent>
        </Card>
      </div>

      <BiltysTableClient data={scopedData} addHref="/bilty/add" />
    </AppShell>
  );
}
