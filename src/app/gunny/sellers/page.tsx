import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { GunnySellersManager } from "@/features/gunny/components/GunnySellersManager";
import {
  getGunnyPaymentAllocations,
  getGunnyRecords,
  getGunnySellerPayments,
  getGunnySellers,
} from "@/features/gunny/service/gunny.service";

export default async function GunnySellersPage() {
  await requireAuth();
  const [sellers, records, payments, allocations] = await Promise.all([
    getGunnySellers(),
    getGunnyRecords(),
    getGunnySellerPayments(),
    getGunnyPaymentAllocations(),
  ]);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Gunny Sellers</h1>
        <p className="text-zinc-500">Manage seller details, purchase details and payment ledger.</p>
      </div>
      <GunnySellersManager
        sellers={sellers}
        records={records}
        payments={payments}
        allocations={allocations}
      />
    </AppShell>
  );
}
