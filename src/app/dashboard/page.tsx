import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/features/auth/lib/session";
import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { getBills } from "@/features/bills/service/bill.service";
import { getPurchaseById } from "@/features/purchases/service/purchase.service";

export default async function DashboardPage() {
  const user = await requireAuth();
  
  // Fetch basic stats
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
              <div className="text-2xl font-bold">₹{totalPurchasesAmount.toLocaleString("en-IN")}</div>
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
              <div className="text-2xl font-bold">₹{totalBillsAmount.toLocaleString("en-IN")}</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
