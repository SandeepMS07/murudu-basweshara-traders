export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaPartyLedger } from "@/features/soya-parties/components/SoyaPartyLedger";
import {
  getSoyaParties,
  getSoyaPartyEntries,
  getSoyaPartyPayments,
} from "@/features/soya-parties/service/soya-party.service";

export default async function SoyaPartyMasterPage() {
  await requireSoyaAdminPage();

  // Until the migration is applied these reads fail; the page still renders a
  // notice naming the file to run instead of erroring outright.
  const [partiesResult, entriesResult, paymentsResult] =
    await Promise.allSettled([
      getSoyaParties(),
      getSoyaPartyEntries(),
      getSoyaPartyPayments(),
    ]);

  if (partiesResult.status === "rejected") {
    const message = String(
      partiesResult.reason instanceof Error
        ? partiesResult.reason.message
        : partiesResult.reason,
    );
    const friendly = message.includes("soya_part")
      ? "The Soya Parties tables are missing in Supabase. Run `supabase/soya-parties.sql` to create them."
      : message;
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Party Companies Unavailable
          </p>
          <h1 className="mt-2 text-2xl font-bold">Unable to load parties</h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">{friendly}</p>
        </div>
      </AppShell>
    );
  }

  const payments =
    paymentsResult.status === "fulfilled" ? paymentsResult.value : [];

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Party Companies
        </h1>
        <p className="text-zinc-500">
          The party master, its entries, and the payments received from it.
        </p>
      </div>
      <SoyaPartyLedger
        parties={partiesResult.value}
        entries={entriesResult.status === "fulfilled" ? entriesResult.value : []}
        payments={payments.map((payment) => ({
          id: payment.id,
          ownerId: payment.party_id,
          paid_on: payment.paid_on,
          bank: payment.bank,
          amount: payment.amount,
          remarks: payment.remarks,
        }))}
      />
    </AppShell>
  );
}
