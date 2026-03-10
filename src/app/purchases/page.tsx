import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { requireAuth } from "@/features/auth/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PurchasesTableClient } from "@/features/purchases/components/PurchasesTableClient";

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
    { bags: 0, weight: 0, amount: 0 }
  );
  const formatter = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  });

  return (
    <AppShell>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Purchases</h1>
          <p className="text-muted-foreground">Manage your purchases records here.</p>
        </div>
        <Link href="/purchases/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Purchase
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card className="border-0 bg-gradient-to-br from-emerald-50 via-white to-emerald-100 shadow">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Bags</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-emerald-900">
              {formatter.format(totals.bags)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-sky-50 via-white to-sky-100 shadow">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Weight</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-sky-900">
              {formatter.format(totals.weight)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 bg-gradient-to-br from-orange-50 via-white to-orange-100 shadow">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-orange-900">
              ₹{formatter.format(totals.amount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <PurchasesTableClient data={data} />
    </AppShell>
  );
}
