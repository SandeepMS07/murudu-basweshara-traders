import { AppShell } from "@/components/layout/AppShell";
import { BillForm } from "@/features/bills/components/BillForm";
import { requireAuth } from "@/features/auth/lib/session";

export default async function NewBillPage() {
  await requireAuth();

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Create Bill</h1>
        <p className="text-muted-foreground">Add a new record to the APP_BILL sheet.</p>
      </div>
      <BillForm />
    </AppShell>
  );
}
