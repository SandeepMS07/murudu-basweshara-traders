import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { GunnyForm } from "@/features/gunny/components/GunnyForm";
import {
  getGunnyRecordById,
  getGunnySellers,
  getNextGunnyBillNoPreview,
} from "@/features/gunny/service/gunny.service";

export default async function EditGunnyPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const { id } = await params;
  const record = await getGunnyRecordById(id);

  if (!record) {
    redirect("/gunny");
  }

  const [nextBillNo, sellers] = await Promise.all([
    getNextGunnyBillNoPreview(record.date),
    getGunnySellers(),
  ]);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Edit Gunny Record</h1>
        <p className="text-zinc-500">Update gunny bag purchase details.</p>
      </div>
      <GunnyForm
        initialData={record}
        nextBillNo={nextBillNo}
        sellerOptions={sellers.map((seller) => seller.name)}
      />
    </AppShell>
  );
}
