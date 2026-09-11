"use client";

import { PurchasesTableClient } from "@/features/purchases/components/PurchasesTableClient";
import { TradeOverviewClient } from "@/features/purchases/components/TradeOverviewClient";
import type { Purchase } from "@/features/purchases/schemas";
import type { DateRange } from "@/lib/date-range";

/**
 * Exists because `partyOf` and `renderTable` are functions: a server component
 * cannot pass those across the client boundary, so the wiring lives here.
 */
interface PurchasesOverviewClientProps {
  purchases: Purchase[];
  initialRange: DateRange;
  todayIso: string;
  addHref?: string;
}

export function PurchasesOverviewClient({
  purchases,
  initialRange,
  todayIso,
  addHref,
}: PurchasesOverviewClientProps) {
  return (
    <TradeOverviewClient
      records={purchases}
      partyOf={(purchase) => purchase.name}
      partyLabel="Seller"
      partyLabelPlural="Sellers"
      initialRange={initialRange}
      todayIso={todayIso}
      statementPath="/purchases/statement"
      statementFilePrefix="Purchases Statement"
      renderTable={(rows) => (
        <PurchasesTableClient data={rows} addHref={addHref} />
      )}
    />
  );
}
