import { AppShell } from "@/components/layout/AppShell";
import { PurchaseForm } from "@/features/purchases/components/PurchaseForm";
import { requireAuth } from "@/features/auth/lib/session";

export default async function NewPurchasePage() {
  await requireAuth();

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create Purchase</h1>
        <p className="text-muted-foreground">Add a new record to the APP_PURCHASE sheet.</p>
      </div>
      <PurchaseForm />
    </AppShell>
  );
}
