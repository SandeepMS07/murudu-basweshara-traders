import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { GunnyBagsOverview } from "@/features/gunny-bags/components/GunnyBagsOverview";
import { getGunnyBagsOverview } from "@/features/gunny-bags/service/gunny-bag.service";

export default async function GunnyBagsPage() {
  await requireAuth();
  const overview = await getGunnyBagsOverview();

  return (
    <AppShell wide>
      <GunnyBagsOverview
        purchases={overview.purchases}
        payments={overview.payments}
        sales={overview.sales}
        saleParties={overview.saleParties}
        purchaseOverview={overview.purchaseOverview}
        parties={overview.parties}
        stockSummary={overview.stockSummary}
      />
    </AppShell>
  );
}
