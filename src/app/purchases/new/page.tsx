import { AppShell } from "@/components/layout/AppShell";
import { PurchaseForm } from "@/features/purchases/components/PurchaseForm";
import { requireAuth } from "@/features/auth/lib/session";

export default async function NewPurchasePage() {
  await requireAuth();

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Create Purchase</h1>
        <p className="text-zinc-500">Enter purchase details to create a new entry.</p>
      </div>
      <PurchaseForm />
    </AppShell>
  );
}
