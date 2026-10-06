export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getActiveSoyaCompanyScope } from "@/features/soya/lib/company-scope";
import { SoyaFactoryLedger } from "@/features/soya-factory/components/SoyaFactoryLedger";
import {
  getSoyaFactories,
  getSoyaFactoryEntries,
  getSoyaFactoryPayments,
} from "@/features/soya-factory/service/soya-factory.service";
import { getSoyaCounterparties } from "@/features/soya/service/counterparty-gst.service";

export default async function SoyaFactoryMasterPage() {
  await requireSoyaAdminPage();
  const scope = await getActiveSoyaCompanyScope();

  // Until the migration is applied these reads fail; the page still renders a
  // notice naming the file to run instead of erroring outright.
  const [factoriesResult, entriesResult, paymentsResult] =
    await Promise.allSettled([
      getSoyaFactories(scope),
      getSoyaFactoryEntries(scope),
      getSoyaFactoryPayments(scope),
    ]);

  if (factoriesResult.status === "rejected") {
    const message = String(
      factoriesResult.reason instanceof Error
        ? factoriesResult.reason.message
        : factoriesResult.reason,
    );
    const friendly = message.includes("soya_factor")
      ? "The Soya Factory tables are missing in Supabase. Run `supabase/soya-factory.sql` to create them."
      : message;
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Factory Parties Unavailable
          </p>
          <h1 className="mt-2 text-2xl font-bold">Unable to load factories</h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">{friendly}</p>
        </div>
      </AppShell>
    );
  }

  const payments =
    paymentsResult.status === "fulfilled" ? paymentsResult.value : [];

  // GST identity of the same records, shown as a tab in the ledger. Absent
  // (null) if the company layer is not migrated; the ledger works without it.
  const gstRows = await getSoyaCounterparties("factory", scope).catch(() => null);

  return (
    <AppShell>
      <SoyaFactoryLedger
        gstRows={gstRows}
        activeCompanyId={scope.companyId}
        factories={factoriesResult.value}
        entries={entriesResult.status === "fulfilled" ? entriesResult.value : []}
        payments={payments.map((payment) => ({
          id: payment.id,
          ownerId: payment.factory_id,
          paid_on: payment.paid_on,
          bank: payment.bank,
          amount: payment.amount,
        }))}
      />
    </AppShell>
  );
}
