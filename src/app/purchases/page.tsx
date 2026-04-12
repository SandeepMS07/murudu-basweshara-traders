import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { requireAuth } from "@/features/auth/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PurchasesTableClient } from "@/features/purchases/components/PurchasesTableClient";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { addDays, format } from "date-fns";

export default async function PurchasesPage() {
  await requireAuth();
  const data = await getPurchases();
  const totals = data.reduce(
    (acc, purchase) => {
      acc.bags += purchase.bags;
      acc.weight += purchase.net_weight;
      acc.amount += purchase.final_total;
      return acc;
    },
    { bags: 0, weight: 0, amount: 0 },
  );
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const todaysTotals = data.reduce(
    (acc, purchase) => {
      if (purchase.date !== todayKey) return acc;
      acc.bags += purchase.bags;
      acc.weight += purchase.net_weight;
      return acc;
    },
    { bags: 0, weight: 0 },
  );
  const averageRate = totals.weight > 0 ? totals.amount / totals.weight : 0;
  const today = new Date();
  const last7Start = addDays(today, -6);
  const last7 = data.filter((purchase) => purchase.date >= format(last7Start, "yyyy-MM-dd"));
  const last7Totals = last7.reduce(
    (acc, purchase) => {
      acc.weight += purchase.net_weight;
      acc.amount += purchase.final_total;
      return acc;
    },
    { weight: 0, amount: 0 }
  );
  const last7AverageRate =
    last7Totals.weight > 0 ? last7Totals.amount / last7Totals.weight : 0;
  return (
    <AppShell>
      <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">
            Purchases
          </h1>
          <p className="text-zinc-500">Manage your purchases records here.</p>
        </div>
        <Link href="/purchases/new">
          <Button className="h-10 w-full border border-[#2a2d34] bg-[#17191f] px-4 text-zinc-100 hover:bg-[#1d2026] sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            Add Purchase
          </Button>
        </Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 xl:grid-cols-6">
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
            <CardTitle className="text-sm text-zinc-400">
              Total Weight
            </CardTitle>
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
            <CardTitle className="text-sm text-zinc-400">
              Total Amount
            </CardTitle>
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
            <CardTitle className="text-sm text-zinc-400">Average Rate</CardTitle>
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
            <CardTitle className="text-sm text-zinc-400">Today Weight</CardTitle>
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

      <PurchasesTableClient data={data} />
    </AppShell>
  );
}
