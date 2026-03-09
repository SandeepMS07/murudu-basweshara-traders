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
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user.email} ({user.role})</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Purchases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{purchases.length}</div>
              <p className="text-xs text-muted-foreground">Entries in workbook</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Purchase Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(totalPurchasesAmount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bills.length}</div>
              <p className="text-xs text-muted-foreground">Entries in workbook</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Bill Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatINR(totalBillsAmount)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Purchase Trend (Last {trend.length || 0} Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {trend.length > 0 ? (
                <div className="space-y-3">
                  <svg viewBox="0 0 300 110" className="h-40 w-full rounded-md border bg-gradient-to-b from-muted/30 to-background p-2">
                    <polyline
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      points={trendPoints}
                      className="text-primary"
                    />
                    {trendValues.map((value, i) => {
                      const x = trend.length === 1 ? 150 : (i / (trend.length - 1)) * 300;
                      const y = 100 - (value / trendMax) * 90;
                      return <circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" className="fill-primary" />;
                    })}
                  </svg>
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground md:grid-cols-5">
                    {trend.slice(-5).map((item) => (
                      <div key={item.date} className="rounded border p-2">
                        <div>{item.date}</div>
                        <div className="font-medium text-foreground">{formatINR(item.amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No purchase data yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Collection Split</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Cash</span>
                  <span className="font-medium">{formatINR(totalCash)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${totalPurchasesAmount ? (totalCash / totalPurchasesAmount) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>UPI</span>
                  <span className="font-medium">{formatINR(totalUpi)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: `${totalPurchasesAmount ? (totalUpi / totalPurchasesAmount) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Pending</span>
                  <span className="font-medium">{formatINR(pendingAmount)}</span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-amber-500"
                    style={{ width: `${totalPurchasesAmount ? (pendingAmount / totalPurchasesAmount) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Places by Total Amount</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topPlaces.length > 0 ? (
              topPlaces.map((item) => (
                <div key={item.place} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.place}</span>
                    <span>{formatINR(item.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-sky-500"
                      style={{ width: `${(item.amount / topPlaceMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No place-wise data yet.</p>
            )}
          </CardContent>
        </Card>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Bags / Purchase</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(purchases.reduce((acc, p) => acc + p.bags, 0) / Math.max(purchases.length, 1)).toFixed(1)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Net Weight</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(purchases.reduce((acc, p) => acc + p.net_weight, 0) / Math.max(purchases.length, 1)).toFixed(1)}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Average Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{(purchases.reduce((acc, p) => acc + p.rate, 0) / Math.max(purchases.length, 1)).toFixed(2)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
