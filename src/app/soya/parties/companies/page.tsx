export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaPartyLedgerManager } from "@/features/soya-parties/components/SoyaPartyLedgerManager";
import { getSoyaCompanies } from "@/features/soya-companies/service/soya-company.service";
import {
  getSoyaPartyEntries,
  getSoyaPartyPaymentAllocations,
  getSoyaPartyPayments,
} from "@/features/soya-parties/service/soya-party.service";

export default async function SoyaPartyCompaniesPage() {
  await requireSoyaAdminPage();

  // Until the migration is applied these reads fail; the page still renders so
  // the module is inspectable rather than erroring outright.
  const [companiesResult, entriesResult, paymentsResult, allocationsResult] =
    await Promise.allSettled([
      getSoyaCompanies(),
      getSoyaPartyEntries(),
      getSoyaPartyPayments(),
      getSoyaPartyPaymentAllocations(),
    ]);

  for (const [label, result] of [
    ["soya companies", companiesResult],
    ["soya party entries", entriesResult],
    ["soya party payments", paymentsResult],
    ["soya party allocations", allocationsResult],
  ] as const) {
    if (result.status === "rejected") {
      console.error(`Failed to load ${label}`, result.reason);
    }
  }

  return (
    <AppShell>
      <SoyaPartyLedgerManager
        companies={
          companiesResult.status === "fulfilled" ? companiesResult.value : []
        }
        sales={entriesResult.status === "fulfilled" ? entriesResult.value : []}
        payments={
          paymentsResult.status === "fulfilled" ? paymentsResult.value : []
        }
        allocations={
          allocationsResult.status === "fulfilled" ? allocationsResult.value : []
        }
      />
    </AppShell>
  );
}
