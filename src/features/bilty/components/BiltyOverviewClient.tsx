"use client";

import { BiltysTableClient } from "@/features/bilty/components/BiltysTableClient";
import { TradeOverviewClient } from "@/features/purchases/components/TradeOverviewClient";
import type { Bilty } from "@/features/bilty/schemas";
import type { DateRange } from "@/lib/date-range";

/**
 * Bilty reuses the Purchases overview shell the same way its columns already
 * reuse `createPurchaseColumns` — the two record shapes are identical apart
 * from where the counterparty name lives.
 */
interface BiltyOverviewClientProps {
  biltys: Bilty[];
  initialRange: DateRange;
  todayIso: string;
  addHref?: string;
}

export function BiltyOverviewClient({
  biltys,
  initialRange,
  todayIso,
  addHref,
}: BiltyOverviewClientProps) {
  return (
    <TradeOverviewClient
      records={biltys}
      partyOf={(bilty) => bilty.party}
      partyLabel="Party"
      partyLabelPlural="Parties"
      initialRange={initialRange}
      todayIso={todayIso}
      statementPath="/bilty/statement"
      statementFilePrefix="Bilty Statement"
      renderTable={(rows) => <BiltysTableClient data={rows} addHref={addHref} />}
    />
  );
}
