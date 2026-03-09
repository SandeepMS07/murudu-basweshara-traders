import { AppShell } from "@/components/layout/AppShell";
import { getBills } from "@/features/bills/service/bill.service";
import { requireAuth } from "@/features/auth/lib/session";
import { BillsTableClient } from "@/features/bills/components/BillsTableClient";
import { getPurchaseById } from "@/features/purchases/service/purchase.service";
import { BillTableRow } from "@/features/bills/components/Columns";

export default async function BillsPage() {
  await requireAuth();
  const data = await getBills();
  const tableData: BillTableRow[] = await Promise.all(
    data.map(async (bill) => {
      const purchaseId = bill.id.startsWith("PUR_BILL_")
        ? bill.id.slice("PUR_BILL_".length)
        : undefined;

      if (!purchaseId) {
        return {
          ...bill,
          bill_for: "-",
          status: "done",
        };
      }

      const purchase = await getPurchaseById(purchaseId);
      return {
        ...bill,
        bill_for: purchase?.name || purchase?.mob || "-",
        status: "done",
        purchase_id: purchaseId,
      };
    })
  );

  return (
    <AppShell>
      <div className="mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bills</h1>
          <p className="text-muted-foreground">Manage your bills records here.</p>
        </div>
      </div>

      <BillsTableClient data={tableData} />
    </AppShell>
  );
}
