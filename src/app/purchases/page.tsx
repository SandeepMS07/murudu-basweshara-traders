export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { requireAuth } from "@/features/auth/lib/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PurchasesTableClient } from "@/features/purchases/components/PurchasesTableClient";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { addDays, format } from "date-fns";
import { getFinancialYearBounds } from "@/lib/financial-year";

type PurchasesPageProps = {
  searchParams?: Promise<{ fy?: string }>;
};

function parseSelectedFinancialYear(value: string | undefined | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (!Number.isFinite(startYear) || endYear !== startYear + 1) return null;

  return {
    startYear,
    label: `${startYear}-${endYear}`,
    start: `${startYear}-04-01`,
    end: `${endYear}-03-31`,
  };
}

export default async function PurchasesPage({
  searchParams,
}: PurchasesPageProps) {
  await requireAuth();
  const params = (await searchParams) || {};
  const data = await getPurchases();
  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const currentFy = getFinancialYearBounds(nowIst);
  const currentFyStartYear = Number(currentFy.start.slice(0, 4));
  const selectedFy = parseSelectedFinancialYear(params.fy);
  const fyStart = selectedFy?.start ?? currentFy.start;
  const fyEnd = selectedFy?.end ?? currentFy.end;
  const selectedFyLabel =
    selectedFy?.label ?? `${currentFyStartYear}-${currentFyStartYear + 1}`;

  const firstFyStartYear = data.reduce((minYear, purchase) => {
    const [yearPart, monthPart] = purchase.date.split("-");
    const year = Number(yearPart);
    const month = Number(monthPart);
    if (!Number.isFinite(year) || !Number.isFinite(month)) return minYear;
    const purchaseFyStartYear = month >= 4 ? year : year - 1;
    return Math.min(minYear, purchaseFyStartYear);
  }, currentFyStartYear);
  const fyOptions: string[] = [];
  for (let year = currentFyStartYear; year >= firstFyStartYear; year -= 1) {
    fyOptions.push(`${year}-${year + 1}`);
  }
  if (!fyOptions.includes(selectedFyLabel)) {
    fyOptions.unshift(selectedFyLabel);
  }

  const scopedData = data.filter(
    (purchase) => purchase.date >= fyStart && purchase.date <= fyEnd,
  );
  const totals = scopedData.reduce(
    (acc, purchase) => {
      acc.bags += purchase.bags;
      acc.weight += purchase.net_weight;
      acc.amount += purchase.final_total;
      return acc;
    },
    { bags: 0, weight: 0, amount: 0 },
  );
  const todayKey = format(nowIst, "yyyy-MM-dd");
  const todaysTotals = scopedData.reduce(
    (acc, purchase) => {
      if (purchase.date !== todayKey) return acc;
      acc.bags += purchase.bags;
      acc.weight += purchase.net_weight;
      return acc;
    },
    { bags: 0, weight: 0 },
  );
  const averageRate = totals.weight > 0 ? totals.amount / totals.weight : 0;
  const last7Start = addDays(nowIst, -6);
  const last7 = scopedData.filter(
    (purchase) => purchase.date >= format(last7Start, "yyyy-MM-dd"),
  );
  const last7Totals = last7.reduce(
    (acc, purchase) => {
      acc.weight += purchase.net_weight;
      acc.amount += purchase.final_total;
      return acc;
    },
    { weight: 0, amount: 0 },
  );
  const last7AverageRate =
    last7Totals.weight > 0 ? last7Totals.amount / last7Totals.weight : 0;

  const fyControl = (
    <form method="get" className="flex items-center gap-1.5">
      <select
        id="fy"
        name="fy"
        defaultValue={selectedFyLabel}
        className="h-10 min-w-[120px] rounded-md border border-[#2a2d34] bg-[#14161b] px-2.5 text-sm text-zinc-100 outline-none focus:border-[#ff8f6b]/50"
        aria-label="Financial year"
      >
        {fyOptions.map((fy) => (
          <option key={fy} value={fy}>
            {fy}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="h-10 rounded-md border border-[#2a2d34] bg-[#17191f] px-2.5 text-sm text-zinc-100 hover:bg-[#1d2026]"
      >
        Apply
      </button>
    </form>
  );

  return (
    <AppShell>
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

      <PurchasesTableClient
        data={scopedData}
        addHref="/purchases/new"
        fyControl={fyControl}
      />
    </AppShell>
  );
}
