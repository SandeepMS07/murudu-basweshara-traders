import { AppShell } from "@/components/layout/AppShell";
import { PurchaseForm } from "@/features/purchases/components/PurchaseForm";
import { requireAuth } from "@/features/auth/lib/session";
import { getPurchaseById } from "@/features/purchases/service/purchase.service";
import { notFound, redirect } from "next/navigation";

export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();

  if (user.role !== "admin" && user.role !== "operator") {
    redirect("/purchases");
  }

  const { id } = await params;
  const purchase = await getPurchaseById(id);

  if (!purchase) {
    notFound();
  }

  if (purchase.source === "manual") {
    return (
      <AppShell>
        <div className="p-4 border border-destructive bg-destructive/10 text-destructive rounded-md">
          <h2 className="font-bold">Cannot Edit Read-Only Record</h2>
          <p>Manual records imported from the original PURCHASE sheet cannot be edited.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit Purchase</h1>
        <p className="text-muted-foreground">Modify an existing app-created purchase record.</p>
      </div>
      <PurchaseForm initialData={purchase} />
    </AppShell>
  );
}
