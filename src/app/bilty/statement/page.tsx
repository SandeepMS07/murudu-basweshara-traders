export const dynamic = "force-dynamic";

import { format } from "date-fns";
import { Inter } from "next/font/google";

import { requireAuth } from "@/features/auth/lib/session";
import { getBiltys } from "@/features/bilty/service/bilty.service";
import type { Bilty } from "@/features/bilty/schemas";
import { TradeStatementView } from "@/features/purchases/components/TradeStatementView";
import {
  filterRecords,
  ledgerFilterFromParams,
} from "@/features/purchases/lib/record-filter";

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
  return { title: `Bilty Statement ${format(new Date(), "dd-MM-yyyy")}` };
}

export default async function BiltyStatementPage({
  searchParams,
}: {
  searchParams?: Promise<StatementSearchParams>;
}) {
  // Same gate as /bilty itself: src/proxy.ts already resolves this path to the
  // "bilty" module, so a view-only operator may read the statement.
  await requireAuth();

  const params = (await searchParams) || {};
  const filter = ledgerFilterFromParams(params);
  const biltys = await getBiltys();
  const filtered = filterRecords(biltys, filter, (bilty: Bilty) => bilty.party);

  return (
    <div className={inter.className}>
      <TradeStatementView
        records={filtered}
        partyKey="party"
        filter={filter}
        documentTitle="Bilty Statement"
        partyLabel="Party"
        partyLabelPlural="Parties"
        totalRecordCount={biltys.length}
        backHref="/bilty"
        backLabel="Bilty"
        embedded={params.embed === "1"}
      />
    </div>
  );
}
