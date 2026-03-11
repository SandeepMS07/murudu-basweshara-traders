import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/features/auth/lib/session";
import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { getBills } from "@/features/bills/service/bill.service";
import { getPurchaseById } from "@/features/purchases/service/purchase.service";

function formatINR(value: number) {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const purchases = await getPurchases();
  const bills = await getBills();

  const totalPurchasesAmount = purchases.reduce((acc, p) => acc + (p.final_total || 0), 0);
  const totalBillsAmountParts = await Promise.all(
    bills.map(async (bill) => {
      if (!bill.id.startsWith("PUR_BILL_")) {
        return bill.final_amount || 0;
      }
      const purchaseId = bill.id.slice("PUR_BILL_".length);
      if (!purchaseId) return bill.final_amount || 0;
      const purchase = await getPurchaseById(purchaseId);
      return purchase?.final_total ?? bill.final_amount ?? 0;
    })
  );
  const totalBillsAmount = totalBillsAmountParts.reduce((acc, amount) => acc + amount, 0);
  const totalCash = purchases.reduce((acc, p) => acc + (p.cash_paid || 0), 0);
  const totalUpi = purchases.reduce((acc, p) => acc + (p.upi_paid || 0), 0);
  const pendingAmount = Math.max(totalPurchasesAmount - (totalCash + totalUpi), 0);

  const byPlace = new Map<string, number>();
  for (const p of purchases) {
    const key = (p.place || "Unknown").toUpperCase();
    byPlace.set(key, (byPlace.get(key) || 0) + p.final_total);
  }
  const topPlaces = [...byPlace.entries()]
    .map(([place, amount]) => ({ place, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
  const topPlaceMax = topPlaces[0]?.amount || 1;

  const byDate = new Map<string, number>();
  for (const p of purchases) {
    byDate.set(p.date, (byDate.get(p.date) || 0) + p.final_total);
  }
  const trend = [...byDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);
  const trendValues = trend.map((t) => t.amount);
  const trendMax = Math.max(...trendValues, 1);
  const trendPoints = trendValues
    .map((value, i) => {
      const x = trend.length === 1 ? 150 : (i / (trend.length - 1)) * 300;
      const y = 100 - (value / trendMax) * 90;
      return `${x},${y}`;
    })
    .join(" ");

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
              <div className="text-2xl font-bold text-[#ff8f6b]">{formatINR(totalPurchasesAmount)}</div>
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
              <div className="text-2xl font-bold text-[#ff8f6b]">{formatINR(totalBillsAmount)}</div>
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
                <div className="space-y-3">
                  <svg viewBox="0 0 300 110" className="h-40 w-full rounded-md border border-[#252932] bg-gradient-to-b from-[#14171d] to-[#101216] p-2">
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      points={trendPoints}
                      className="text-[#ff6a3d]"
                    />
                    {trendValues.map((value, i) => {
                      const x = trend.length === 1 ? 150 : (i / (trend.length - 1)) * 300;
                      const y = 100 - (value / trendMax) * 90;
                      return <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" className="fill-[#ff6a3d]" />;
                    })}
                  </svg>
                  <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400 md:grid-cols-5">
                    {trend.slice(-5).map((item) => (
                      <div key={item.date} className="rounded border border-[#252932] bg-[#13161b] p-2">
                        <div>{item.date}</div>
                        <div className="font-medium text-zinc-100">{formatINR(item.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-400">No purchase data yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">Collection Split</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Cash</span>
                  <span className="font-medium">{formatINR(totalCash)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#2a2d34]">
                  <div
                    className="h-2 rounded-full bg-[#ff6a3d]"
                    style={{ width: `${totalPurchasesAmount ? (totalCash / totalPurchasesAmount) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>UPI</span>
                  <span className="font-medium">{formatINR(totalUpi)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#2a2d34]">
                  <div
                    className="h-2 rounded-full bg-[#ff8f6b]"
                    style={{ width: `${totalPurchasesAmount ? (totalUpi / totalPurchasesAmount) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Pending</span>
                  <span className="font-medium">{formatINR(pendingAmount)}</span>
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
                {(purchases.reduce((acc, p) => acc + p.bags, 0) / Math.max(purchases.length, 1)).toFixed(1)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Average Net Weight</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {(purchases.reduce((acc, p) => acc + p.net_weight, 0) / Math.max(purchases.length, 1)).toFixed(1)}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">Average Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                ₹{(purchases.reduce((acc, p) => acc + p.rate, 0) / Math.max(purchases.length, 1)).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
