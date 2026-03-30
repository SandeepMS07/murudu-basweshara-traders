import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { GunnyBagsOverview } from "@/features/gunny-bags/components/GunnyBagsOverview";
import { getGunnyBagsOverview } from "@/features/gunny-bags/service/gunny-bag.service";

export default async function GunnyBagsPage() {
  await requireAuth();
  const overview = getGunnyBagsOverview();

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">Gunny Bags</h1>
        <p className="mt-1 text-sm text-zinc-500">Overview from the GUNNY BAGS sheet.</p>
      </div>
      <GunnyBagsOverview
        purchases={overview.purchases}
        payments={overview.payments}
        purchaseOverview={overview.purchaseOverview}
        partyLedger={overview.partyLedger}
      />
    </AppShell>
  );
}
