export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaFactoryPartiesManager } from "@/features/soya-factory/components/SoyaFactoryPartiesManager";
import {
  type Bilty,
  type BiltyParty,
  type BiltyPartyPayment,
} from "@/features/bilty/schemas";
import {
  getSoyaFactoryParties,
  getSoyaFactoryPartyPayments,
  getSoyaFactoryRecords,
} from "@/features/soya-factory/service/soya-factory.service";

export default async function SoyaFactoryPartiesPage() {
  await requireSoyaAdminPage();

  let parties: BiltyParty[] = [];
  let records: Bilty[] = [];
  let payments: BiltyPartyPayment[] = [];
  let loadError: string | null = null;

  try {
    [parties, records, payments] = await Promise.all([
      getSoyaFactoryParties(),
      getSoyaFactoryRecords(),
      getSoyaFactoryPartyPayments(),
    ]);
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Failed to load soya factory parties";
  }

  if (loadError) {
    const friendlyMessage = loadError.includes("soya_bilty")
      ? "The Soya Factory tables are missing in Supabase. Run `supabase/soya-factory.sql` to create them."
      : loadError;

    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Factory Parties Unavailable
          </p>
          <h1 className="mt-2 text-2xl font-bold">Unable to load parties</h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">
            {friendlyMessage}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Factory Parties
        </h1>
        <p className="text-zinc-500">
          Manage the party master used in Soya factory entries.
        </p>
      </div>
      <SoyaFactoryPartiesManager
        parties={parties}
        biltys={records}
        payments={payments}
      />
    </AppShell>
  );
}
