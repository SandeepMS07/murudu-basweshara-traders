import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { requireAuth } from "@/features/auth/lib/session";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";
import { PurchasesTableClient } from "@/features/purchases/components/PurchasesTableClient";

export default async function PurchasesPage() {
  await requireAuth();
  const data = await getPurchases();

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

      <PurchasesTableClient data={data} />
    </AppShell>
  );
}
