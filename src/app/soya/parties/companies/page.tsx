export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getActiveSoyaCompanyScope } from "@/features/soya/lib/company-scope";
import { SoyaPartyLedger } from "@/features/soya-parties/components/SoyaPartyLedger";
import {
  getSoyaParties,
  getSoyaPartyCreditDays,
  getSoyaPartyEntries,
  getSoyaPartyPayments,
} from "@/features/soya-parties/service/soya-party.service";
import { getSoyaCounterparties } from "@/features/soya/service/counterparty-gst.service";

export default async function SoyaPartyMasterPage() {
  await requireSoyaAdminPage();
  const scope = await getActiveSoyaCompanyScope();

  // Until the migration is applied these reads fail; the page still renders a
  // notice naming the file to run instead of erroring outright.
  const [partiesResult, entriesResult, paymentsResult] =
    await Promise.allSettled([
      getSoyaParties(scope),
      getSoyaPartyEntries(scope),
      getSoyaPartyPayments(scope),
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

  // GST identity of the same records, shown as a tab in the ledger. Absent
  // (null) if the company layer is not migrated; the ledger works without it.
  const [gstRows, creditDays] = await Promise.all([
    getSoyaCounterparties("party", scope).catch(() => null),
    getSoyaPartyCreditDays(scope),
  ]);

  return (
    <AppShell>
      <SoyaPartyLedger
        gstRows={gstRows}
        activeCompanyId={scope.companyId}
        creditDays={Object.fromEntries(creditDays)}
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
