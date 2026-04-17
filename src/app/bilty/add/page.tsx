import { AppShell } from "@/components/layout/AppShell";
import { BiltyForm } from "@/features/bilty/components/BiltyForm";
import { requireAuth } from "@/features/auth/lib/session";
import {
  getBiltyParties,
  getNextBiltyBillNoPreview,
} from "@/features/bilty/service/bilty.service";

export default async function NewBiltyPage() {
  await requireAuth();
  const today = new Date().toISOString().split("T")[0];
  const nextBillNo = await getNextBiltyBillNoPreview(today);
  const parties = await getBiltyParties();

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Create Bilty</h1>
        <p className="text-zinc-500">Enter bilty details to create a new entry.</p>
      </div>
      <BiltyForm
        nextBillNo={nextBillNo}
        partyOptions={parties.map((party) => party.name)}
      />
    </AppShell>
  );
}
