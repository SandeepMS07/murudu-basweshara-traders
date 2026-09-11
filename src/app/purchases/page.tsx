export const dynamic = "force-dynamic";

import { format } from "date-fns";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { PurchasesOverviewClient } from "@/features/purchases/components/PurchasesOverviewClient";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { getFinancialYearBounds } from "@/lib/financial-year";

export default async function PurchasesPage() {
  await requireAuth();
  const purchases = await getPurchases();
  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const { start: fyStart, end: fyEnd } = getFinancialYearBounds(nowIst);

  return (
    <AppShell>
      {/* The financial-year dropdown that used to live here is gone: the date
          range filter supersedes it and still defaults to the current FY. */}
      <PurchasesOverviewClient
        purchases={purchases}
        initialRange={{ from: fyStart, to: fyEnd }}
        todayIso={format(nowIst, "yyyy-MM-dd")}
        addHref="/purchases/new"
      />
    </AppShell>
  );
}
