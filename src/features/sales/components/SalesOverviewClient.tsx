"use client";

import { useMemo, useState } from "react";
import { parseISO } from "date-fns";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DateRangeFilter,
  isWithinRange,
  type DateRange,
} from "@/components/shared/DateRangeFilter";
import { SalesTableClient } from "@/features/sales/components/SalesTableClient";
import type { Sale } from "@/features/sales/schemas";
import type { Company } from "@/features/companies/schemas";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

interface SalesOverviewClientProps {
  /** Every sale; the date filter decides what is in view. */
  sales: Sale[];
  buyerCompanies: Company[];
  issuerCompanies: Company[];
  /** FIFO-effective pending, computed server-side across all sales. */
  pendingBySaleId: Record<string, number>;
  /** Default range — this financial year, matching the previous behaviour. */
  initialRange: DateRange;
  /** Today in IST as `yyyy-MM-dd`, so presets agree with the server. */
  todayIso: string;
  addSaleHref?: string;
}

const WHOLE = { minimumFractionDigits: 0, maximumFractionDigits: 0 } as const;

export function SalesOverviewClient({
  sales,
  buyerCompanies,
  issuerCompanies,
  pendingBySaleId,
  initialRange,
  todayIso,
  addSaleHref,
}: SalesOverviewClientProps) {
  const today = useMemo(() => parseISO(todayIso), [todayIso]);
  const [range, setRange] = useState<DateRange>(initialRange);
  const [issuerId, setIssuerId] = useState("");
  const [buyerId, setBuyerId] = useState("");

  const filteredSales = useMemo(
    () =>
      sales.filter((sale) => {
        if (!isWithinRange(sale.sale_date, range)) return false;
        if (issuerId && sale.issuer_company_id !== issuerId) return false;
        if (buyerId && sale.sale_company_id !== buyerId) return false;
        return true;
      }),
    [sales, range, issuerId, buyerId],
  );

  // Every card reflects the sales currently in view, so the filter bar and the
  // totals can never disagree.
  const totals = useMemo(() => {
    let netWeight = 0;
    let amount = 0;
    let pending = 0;
    for (const sale of filteredSales) {
      netWeight += sale.net_weight;
      amount += sale.amount;
      pending += pendingBySaleId[sale.id] ?? sale.pending_amount;
    }
    return {
      count: filteredSales.length,
      netWeight,
      amount,
      pending,
      // What has actually been settled against the bills in view.
      received: amount - pending,
    };
  }, [filteredSales, pendingBySaleId]);

  const cards = [
    { title: "Total Sales", value: formatNumberIN(totals.count, WHOLE) },
    {
      title: "Total Net Weight",
      value: `${formatNumberIN(totals.netWeight, WHOLE)} kg`,
    },
    {
      title: "Total Amount",
      value: formatCurrencyINR(totals.amount, { maximumFractionDigits: 0 }),
    },
    {
      title: "Total Pending",
      value: formatCurrencyINR(totals.pending, { maximumFractionDigits: 0 }),
    },
    {
      title: "Total Received",
      value: formatCurrencyINR(totals.received, { maximumFractionDigits: 0 }),
    },
  ];

  const selectClassName =
    "h-10 w-full rounded-md border border-[#2a2d34] bg-[#14161b] px-3 text-sm text-zinc-100 lg:max-w-[280px]";

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-5">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-zinc-400">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
                {card.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <DateRangeFilter value={range} onChange={setRange} today={today} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={issuerId}
            onChange={(event) => setIssuerId(event.target.value)}
            aria-label="Filter by issuer company"
            className={selectClassName}
          >
            <option value="">All issuer companies</option>
            {issuerCompanies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.display_name || company.name}
              </option>
            ))}
          </select>
          <select
            value={buyerId}
            onChange={(event) => setBuyerId(event.target.value)}
            aria-label="Filter by buyer company"
            className={selectClassName}
          >
            <option value="">All buyer companies</option>
            {buyerCompanies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <SalesTableClient
        data={filteredSales}
        buyerCompanies={buyerCompanies}
        issuerCompanies={issuerCompanies}
        pendingBySaleId={pendingBySaleId}
        addSaleHref={addSaleHref}
      />
    </>
  );
}
