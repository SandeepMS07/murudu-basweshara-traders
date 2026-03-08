import { AppShell } from "@/components/layout/AppShell";
import { BillForm } from "@/features/bills/components/BillForm";
import { requireAuth } from "@/features/auth/lib/session";
import { getBillById } from "@/features/bills/service/bill.service";
import { notFound, redirect } from "next/navigation";

export default async function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();

  if (user.role !== "admin" && user.role !== "operator") {
    redirect("/bills");
  }

  const { id } = await params;
  const bill = await getBillById(id);

  if (!bill) {
    notFound();
  }

  if (bill.source === "manual") {
    return (
      <AppShell>
        <div className="p-4 border border-destructive bg-destructive/10 text-destructive rounded-md">
          <h2 className="font-bold">Cannot Edit Read-Only Record</h2>
          <p>Manual records imported from the original BILL sheet cannot be edited.</p>
        </div>
      </AppShell>
    );
  }

  if (id.startsWith("PUR_BILL_")) {
    const purchaseId = id.slice("PUR_BILL_".length);
    if (purchaseId) {
      redirect(`/purchases/${purchaseId}/edit`);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit Bill</h1>
        <p className="text-muted-foreground">Modify an existing app-created bill record.</p>
      </div>
      <BillForm initialData={bill} />
    </AppShell>
  );
}
