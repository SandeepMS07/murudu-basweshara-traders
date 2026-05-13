import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { GunnyForm } from "@/features/gunny/components/GunnyForm";
import { getGunnySellers, getNextGunnyBillNoPreview } from "@/features/gunny/service/gunny.service";

export default async function AddGunnyPage() {
  await requireAuth();
  const [nextBillNo, sellers] = await Promise.all([
    getNextGunnyBillNoPreview(new Date().toISOString().slice(0, 10)),
    getGunnySellers(),
  ]);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Add Gunny Record</h1>
        <p className="text-zinc-500">Enter gunny bag purchase details.</p>
      </div>
      <GunnyForm nextBillNo={nextBillNo} sellerOptions={sellers.map((seller) => seller.name)} />
    </AppShell>
  );
}
