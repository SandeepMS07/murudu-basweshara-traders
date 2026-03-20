import { AppShell } from "@/components/layout/AppShell";
import { PurchaseForm } from "@/features/purchases/components/PurchaseForm";
import { requireAuth } from "@/features/auth/lib/session";
import { getNextPurchaseBillNoPreview } from "@/features/purchases/service/purchase.service";

export default async function NewPurchasePage() {
  await requireAuth();
  const nextBillNo = await getNextPurchaseBillNoPreview();

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Create Purchase</h1>
        <p className="text-zinc-500">Enter purchase details to create a new entry.</p>
      </div>
      <PurchaseForm nextBillNo={nextBillNo} />
    </AppShell>
  );
}
