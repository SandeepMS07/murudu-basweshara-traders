import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/features/auth/lib/session";
import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { getSales } from "@/features/sales/service/sale.service";
import { getGunnyBagStockSummary } from "@/features/gunny-bags/service/gunny-bag.service";
import { PurchaseTrendChart } from "@/features/dashboard/components/PurchaseTrendChart";
import { BarTrendChart } from "@/features/dashboard/components/BarTrendChart";
import { DonutBreakdownChart } from "@/features/dashboard/components/DonutBreakdownChart";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

export default async function DashboardPage() {
  const user = await requireAuth();
  const purchases = await getPurchases();
  const sales = await getSales();
  const gunnyStock = await getGunnyBagStockSummary();

  const totalPurchasesAmount = purchases.reduce((acc, p) => acc + (p.final_total || 0), 0);
  const totalSalesAmount = sales.reduce((acc, s) => acc + (s.amount || 0), 0);
  const totalSalesPending = sales.reduce((acc, s) => acc + (s.pending_amount || 0), 0);
  const totalPurchasedBags = purchases.reduce((acc, p) => acc + Number(p.bags || 0), 0);
  const totalSoldBags = sales.reduce((acc, s) => acc + Number(s.bags || 0), 0);
  const stockBags = totalPurchasedBags - totalSoldBags;
  const totalPurchasedNetWeight = purchases.reduce((acc, p) => acc + Number(p.net_weight || 0), 0);
  const totalSoldNetWeight = sales.reduce((acc, s) => acc + Number(s.net_weight || 0), 0);
  const stockWeight = totalPurchasedNetWeight - totalSoldNetWeight;
  const rtgsAmount = purchases
    .filter((p) => p.payment_through === "RTGS")
    .reduce((acc, p) => acc + (p.final_total || 0), 0);
  const upiAmount = purchases
    .filter((p) => p.payment_through === "UPI")
    .reduce((acc, p) => acc + (p.final_total || 0), 0);
  const pendingAmount = purchases
    .filter((p) => p.payment_through === "none")
    .reduce((acc, p) => acc + (p.final_total || 0), 0);
  const byDate = new Map<string, number>();
  for (const p of purchases) {
    byDate.set(p.date, (byDate.get(p.date) || 0) + p.final_total);
  }
  const trend = [...byDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);

  const salesByDate = new Map<string, number>();
  for (const sale of sales) {
    salesByDate.set(sale.sale_date, (salesByDate.get(sale.sale_date) || 0) + sale.amount);
  }
  const salesTrend = [...salesByDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);
  const realizedSalesAmount = totalSalesAmount - totalSalesPending;
  const collectionPercent = totalSalesAmount > 0 ? (realizedSalesAmount / totalSalesAmount) * 100 : 0;
  const paymentCoveragePercent = totalPurchasesAmount > 0 ? ((rtgsAmount + upiAmount) / totalPurchasesAmount) * 100 : 0;
  const gunnyUtilizationPercent = gunnyStock.totalBags > 0 ? (gunnyStock.usedBags / gunnyStock.totalBags) * 100 : 0;
  const stockBagsNegative = stockBags < 0;
  const stockWeightNegative = stockWeight < 0;
  const gunnyLeftNegative = gunnyStock.leftBags < 0;

  return (
    <AppShell>
      <div className="flex flex-col gap-6 text-zinc-100">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-zinc-500">Welcome back, {user.email} ({user.role})</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Purchases</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold text-[#ff8f6b]">{formatCurrencyINR(totalPurchasesAmount)}</div>
              <p className="text-xs text-zinc-500">{purchases.length} entries</p>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Sales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="text-2xl font-bold text-[#ff8f6b]">{formatCurrencyINR(totalSalesAmount)}</div>
              <p className="text-xs text-zinc-500">{sales.length} entries</p>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Receivables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold text-[#ff8f6b]">{formatCurrencyINR(totalSalesPending)}</div>
              <p className="text-xs text-zinc-500">
                Collected: {formatCurrencyINR(realizedSalesAmount)} ({formatNumberIN(collectionPercent, { maximumFractionDigits: 1 })}%)
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Purchase Payments Coverage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold text-emerald-300">
                {formatNumberIN(paymentCoveragePercent, { maximumFractionDigits: 1 })}%
              </div>
              <p className="text-xs text-zinc-500">
                Paid: {formatCurrencyINR(rtgsAmount + upiAmount)} / {formatCurrencyINR(totalPurchasesAmount)}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Stock Bags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className={`text-2xl font-bold ${stockBagsNegative ? "text-[#ff6a3d]" : "text-[#ff8f6b]"}`}>
                {formatNumberIN(stockBags, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-zinc-500">
                Purchased {formatNumberIN(totalPurchasedBags, { maximumFractionDigits: 0 })} | Sold {formatNumberIN(totalSoldBags, { maximumFractionDigits: 0 })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Stock Weight</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className={`text-2xl font-bold ${stockWeightNegative ? "text-[#ff6a3d]" : "text-[#ff8f6b]"}`}>
                {formatNumberIN(stockWeight, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg
              </div>
              <p className="text-xs text-zinc-500">
                In {formatNumberIN(totalPurchasedNetWeight, { maximumFractionDigits: 2 })} | Out {formatNumberIN(totalSoldNetWeight, { maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Gunny Bags Left</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className={`text-2xl font-bold ${gunnyLeftNegative ? "text-[#ff6a3d]" : "text-[#ff8f6b]"}`}>
                {formatNumberIN(gunnyStock.leftBags, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-zinc-500">
                Total {formatNumberIN(gunnyStock.totalBags, { maximumFractionDigits: 2 })} | Used {formatNumberIN(gunnyStock.usedBags, { maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">Purchase Trend (Last {trend.length || 0} Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {trend.length > 0 ? (
                <PurchaseTrendChart data={trend} />
              ) : (
                <p className="text-sm text-zinc-400">No purchase data yet.</p>
              )}
            </CardContent>
          </Card>

          <DonutBreakdownChart
            title="Payment Through"
            slices={[
              { label: "RTGS", value: rtgsAmount, color: "#ff6a3d" },
              { label: "UPI", value: upiAmount, color: "#ff9b78" },
              { label: "Pending", value: pendingAmount, color: "#7f8796" },
            ]}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">Sales Trend (Last {salesTrend.length || 0} Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {salesTrend.length > 0 ? (
                <BarTrendChart data={salesTrend} barColor="#5b90ff" />
              ) : (
                <p className="text-sm text-zinc-400">No sales data yet.</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">Sales Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-[#2a2d34] bg-[#15171c] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Sales Amount</p>
                <p className="mt-1 text-xl font-semibold text-[#ff8f6b]">{formatCurrencyINR(totalSalesAmount)}</p>
              </div>
              <div className="rounded-md border border-[#2a2d34] bg-[#15171c] p-3">
                <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Pending Amount</p>
                <p className="mt-1 text-xl font-semibold text-[#ff8f6b]">{formatCurrencyINR(totalSalesPending)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Gunny Bags In Stock</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(gunnyStock.leftBags, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Gunny Sold Bags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(gunnyStock.usedBags, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-xs text-zinc-500">Utilization: {formatNumberIN(gunnyUtilizationPercent, { maximumFractionDigits: 1 })}%</p>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Gunny Purchased Bags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(gunnyStock.totalBags, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 2,
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Average Bags / Purchase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(
                  purchases.reduce((acc, p) => acc + p.bags, 0) / Math.max(purchases.length, 1),
                  { minimumFractionDigits: 1, maximumFractionDigits: 1 }
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Average Net Weight</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(
                  purchases.reduce((acc, p) => acc + p.net_weight, 0) / Math.max(purchases.length, 1),
                  { minimumFractionDigits: 1, maximumFractionDigits: 1 }
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Average Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatCurrencyINR(
                  purchases.reduce((acc, p) => acc + p.rate, 0) / Math.max(purchases.length, 1)
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
