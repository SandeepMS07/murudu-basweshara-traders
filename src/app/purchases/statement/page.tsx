export const dynamic = "force-dynamic";

import { format } from "date-fns";
import { Inter } from "next/font/google";

import { requireAuth } from "@/features/auth/lib/session";
import { TradeStatementView } from "@/features/purchases/components/TradeStatementView";
import {
  filterRecords,
  ledgerFilterFromParams,
} from "@/features/purchases/lib/record-filter";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import type { Purchase } from "@/features/purchases/schemas";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

type StatementSearchParams = {
  from?: string;
  to?: string;
  party?: string;
  embed?: string;
};

export async function generateMetadata() {
  return { title: `Purchases Statement ${format(new Date(), "dd-MM-yyyy")}` };
}

export default async function PurchasesStatementPage({
  searchParams,
}: {
  searchParams?: Promise<StatementSearchParams>;
}) {
  // Same gate as /purchases itself: src/proxy.ts already resolves this path to
  // the "purchases" module, so a view-only operator may read the statement.
  await requireAuth();

  const params = (await searchParams) || {};
  const filter = ledgerFilterFromParams(params);
  const purchases = await getPurchases();
  const filtered = filterRecords(
    purchases,
    filter,
    (purchase: Purchase) => purchase.name,
  );

  return (
    <div className={inter.className}>
      <TradeStatementView
        records={filtered}
        partyKey="name"
        bagLessOfKey="bag_less"
        showBagLess
        filter={filter}
        documentTitle="Purchases Statement"
        partyLabel="Seller"
        partyLabelPlural="Sellers"
        totalRecordCount={purchases.length}
        backHref="/purchases"
        backLabel="Purchases"
        embedded={params.embed === "1"}
      />
    </div>
  );
}
