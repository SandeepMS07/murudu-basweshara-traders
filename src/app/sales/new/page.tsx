import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { SaleForm } from "@/features/sales/components/SaleForm";

export default async function NewSalePage() {
  await requireAuth();

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Create Sale</h1>
        <p className="text-zinc-500">Enter sales details to create a new entry.</p>
      </div>
      <SaleForm />
    </AppShell>
  );
}
