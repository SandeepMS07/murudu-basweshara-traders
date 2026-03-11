import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/features/auth/lib/session";
import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { getBills } from "@/features/bills/service/bill.service";
import { PurchaseTrendChart } from "@/features/dashboard/components/PurchaseTrendChart";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

export default async function DashboardPage() {
  const user = await requireAuth();
  const purchases = await getPurchases();
  const bills = await getBills();

  const totalPurchasesAmount = purchases.reduce((acc, p) => acc + (p.final_total || 0), 0);
  const rtgsAmount = purchases
    .filter((p) => p.payment_through === "RTGS")
    .reduce((acc, p) => acc + (p.final_total || 0), 0);
  const upiAmount = purchases
    .filter((p) => p.payment_through === "UPI")
    .reduce((acc, p) => acc + (p.final_total || 0), 0);
  const pendingAmount = purchases
    .filter((p) => p.payment_through === "none")
    .reduce((acc, p) => acc + (p.final_total || 0), 0);
  // Bill amount is counted only for completed payment modes.
  const totalBillsAmount = rtgsAmount + upiAmount;

  const byDate = new Map<string, number>();
  for (const p of purchases) {
    byDate.set(p.date, (byDate.get(p.date) || 0) + p.final_total);
  }
  const trend = [...byDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);

  return (
    <AppShell>
      <div className="flex flex-col gap-6 text-zinc-100">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-zinc-500">Welcome back, {user.email} ({user.role})</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">{purchases.length}</div>
              <p className="text-xs text-zinc-500">Entries in workbook</p>
            </CardContent>
          </Card>
          
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Purchase Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">{formatCurrencyINR(totalPurchasesAmount)}</div>
            </CardContent>
          </Card>

          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">{bills.length}</div>
              <p className="text-xs text-zinc-500">Entries in workbook</p>
            </CardContent>
          </Card>
          
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Total Bill Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">{formatCurrencyINR(totalBillsAmount)}</div>
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

          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">Payment Through</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>RTGS</span>
                  <span className="font-medium">{formatCurrencyINR(rtgsAmount)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#2a2d34]">
                  <div
                    className="h-2 rounded-full bg-[#ff6a3d]"
                    style={{ width: `${totalPurchasesAmount ? (rtgsAmount / totalPurchasesAmount) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>UPI</span>
                  <span className="font-medium">{formatCurrencyINR(upiAmount)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#2a2d34]">
                  <div
                    className="h-2 rounded-full bg-[#ff8f6b]"
                    style={{ width: `${totalPurchasesAmount ? (upiAmount / totalPurchasesAmount) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Pending</span>
                  <span className="font-medium">{formatCurrencyINR(pendingAmount)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#2a2d34]">
                  <div
                    className="h-2 rounded-full bg-[#ffb79e]"
                    style={{ width: `${totalPurchasesAmount ? (pendingAmount / totalPurchasesAmount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
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
