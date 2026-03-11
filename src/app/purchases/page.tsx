import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { requireAuth } from "@/features/auth/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PurchasesTableClient } from "@/features/purchases/components/PurchasesTableClient";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

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
  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Purchases</h1>
          <p className="text-zinc-500">Manage your purchases records here.</p>
        </div>
        <Link href="/purchases/new">
          <Button className="border border-[#2a2d34] bg-[#17191f] text-zinc-100 hover:bg-[#1d2026]">
            <Plus className="mr-2 h-4 w-4" />
            Add Purchase
          </Button>
        </Link>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Total Bags</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#ff8f6b]">
              {formatNumberIN(totals.bags, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Total Weight</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#ff8f6b]">
              {formatNumberIN(totals.weight)} kg
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader>
            <CardTitle className="text-sm text-zinc-400">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-[#ff8f6b]">
              {formatCurrencyINR(totals.amount)}
            </p>
          </CardContent>
        </Card>
      </div>

      <PurchasesTableClient data={data} />
    </AppShell>
  );
}
