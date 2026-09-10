import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { getFinancialYearBounds } from "@/lib/financial-year";

export default async function SoyaDashboardPage() {
  await requireSoyaAdminPage();

  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const currentFy = getFinancialYearBounds(nowIst);
  const fyStartYear = Number(currentFy.start.slice(0, 4));
  const fyLabel = `${fyStartYear}-${fyStartYear + 1}`;

  // Soya has no records yet — the Purchases, Bilty and Sales modules land in
  // the following phases, and these cards read from their tables then.
  const totalPurchasesAmount = 0;
  const totalSalesAmount = 0;
  const totalBags = 0;
  const totalNetWeight = 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 text-zinc-100">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Soya Overview
            </h2>
            <p className="text-xs text-zinc-500">
              Financial year {fyLabel} · Soya data only, separate from Maize
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Purchase Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatCurrencyINR(totalPurchasesAmount, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Sales Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatCurrencyINR(totalSalesAmount, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Bags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(totalBags, { maximumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Net Weight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(totalNetWeight, { maximumFractionDigits: 0 })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-[#1f2229] bg-[#14161b] text-zinc-100">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-zinc-400">
              The Soya workspace is set up. Purchases, Bilty and Sales modules
              are being added next — their numbers will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
