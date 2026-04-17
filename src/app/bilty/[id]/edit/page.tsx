import { AppShell } from "@/components/layout/AppShell";
import { BiltyForm } from "@/features/bilty/components/BiltyForm";
import { requireAuth } from "@/features/auth/lib/session";
import {
  getBiltyById,
  getBiltyParties,
} from "@/features/bilty/service/bilty.service";
import { getBillById } from "@/features/bills/service/bill.service";
import { notFound, redirect } from "next/navigation";

export default async function EditBiltyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();

  if (user.role !== "admin" && user.role !== "operator") {
    redirect("/bilty");
  }

  const { id } = await params;
  const bilty = await getBiltyById(id);
  const linkedBill = await getBillById(`BILTY_BILL_${id}`);
  const parties = await getBiltyParties();

  if (!bilty) {
    notFound();
  }

  if (bilty.source === "manual") {
    return (
      <AppShell>
        <div className="p-4 border border-destructive bg-destructive/10 text-destructive rounded-md">
          <h2 className="font-bold">Cannot Edit Read-Only Record</h2>
          <p>Manual records imported from the original BILTY sheet cannot be edited.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Edit Bilty</h1>
        <p className="text-muted-foreground">Modify an existing app-created bilty record.</p>
      </div>
      <BiltyForm
        initialData={bilty}
        linkedBillNo={linkedBill?.bill_no}
        partyOptions={parties.map((party) => party.name)}
      />
    </AppShell>
  );
}
