export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/features/auth/lib/session";
import { GunnyTableClient } from "@/features/gunny/components/GunnyTableClient";
import {
  getGunnyPaymentAllocations,
  getGunnyRecords,
} from "@/features/gunny/service/gunny.service";
import { type GunnyRecord } from "@/features/gunny/schemas";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

export default async function GunnyOverviewPage() {
  await requireAuth();
  let records: GunnyRecord[] = [];
  let loadError: string | null = null;

  try {
    const [rawRecords, allocations] = await Promise.all([
      getGunnyRecords(),
      getGunnyPaymentAllocations(),
    ]);
    const paidByRecord = allocations.reduce<Map<string, number>>((acc, allocation) => {
      acc.set(
        allocation.record_id,
        (acc.get(allocation.record_id) ?? 0) + allocation.amount,
      );
      return acc;
    }, new Map());
    records = rawRecords.map((row) => {
      const paidAmount = paidByRecord.get(row.id) ?? 0;
      return {
        ...row,
        paid_amount: paidAmount,
        pending_amount: Math.max(row.amount - paidAmount, 0),
      };
    });
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Failed to load gunny records";
  }

  if (loadError) {
    const friendlyMessage = loadError.includes("public.gunny_bags")
      ? "Gunny tables are missing in Supabase. Run the updated `supabase/schema.sql` to create them."
      : loadError;

    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Gunny Unavailable
          </p>
          <h1 className="mt-2 text-2xl font-bold">Unable to load gunny records</h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">
            {friendlyMessage}
          </p>
        </div>
      </AppShell>
    );
  }

  const totals = records.reduce(
    (acc, row) => {
      acc.bags += row.bags;
      acc.amount += row.amount;
      acc.paid += row.paid_amount;
      acc.pending += row.pending_amount;
      return acc;
    },
    { bags: 0, amount: 0, paid: 0, pending: 0 },
  );

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Gunny Bags Overview</h1>
        <p className="text-zinc-500">Manage gunny bag purchase records and track pending amounts.</p>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b]"><CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Total Bags</CardTitle></CardHeader><CardContent className="pt-0"><p className="text-2xl font-semibold text-[#ff8f6b]">{formatNumberIN(totals.bags, { maximumFractionDigits: 0 })}</p></CardContent></Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b]"><CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Total Amount</CardTitle></CardHeader><CardContent className="pt-0"><p className="text-2xl font-semibold text-[#ff8f6b]">{formatCurrencyINR(totals.amount, { maximumFractionDigits: 0 })}</p></CardContent></Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b]"><CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Paid</CardTitle></CardHeader><CardContent className="pt-0"><p className="text-2xl font-semibold text-[#ff8f6b]">{formatCurrencyINR(totals.paid, { maximumFractionDigits: 0 })}</p></CardContent></Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b]"><CardHeader className="pb-2"><CardTitle className="text-sm text-zinc-400">Pending</CardTitle></CardHeader><CardContent className="pt-0"><p className="text-2xl font-semibold text-[#ff8f6b]">{formatCurrencyINR(totals.pending, { maximumFractionDigits: 0 })}</p></CardContent></Card>
      </div>

      <GunnyTableClient data={records} />
    </AppShell>
  );
}
