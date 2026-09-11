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

  // Company names here are long ("SRI MURUDA BASAVESHWARA TRADERS"), so the
  // select is allowed to shrink and the full name goes in a tooltip.
  const selectedIssuer = issuerCompanies.find((c) => c.id === issuerId);
  const selectedIssuerName = selectedIssuer
    ? selectedIssuer.display_name || selectedIssuer.name
    : null;
  const selectedBuyerName =
    buyerCompanies.find((c) => c.id === buyerId)?.name ?? null;

  const isFiltered =
    range.from !== initialRange.from ||
    range.to !== initialRange.to ||
    issuerId !== "" ||
    buyerId !== "";

  const resetFilters = () => {
    setRange(initialRange);
    setIssuerId("");
    setBuyerId("");
  };

  const selectClassName =
    "h-9 min-w-36 flex-1 cursor-pointer truncate rounded-lg bg-[#0f1115] px-2.5 text-xs text-zinc-100 ring-1 ring-inset ring-[#242832] outline-none sm:max-w-60 focus-visible:ring-[#ff6a3d]";

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

      <div className="mb-3 rounded-xl border border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] p-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} today={today} />

          {/* flex-1 with a min width: these give up space first, so the pills
              and date inputs keep their size instead of wrapping. */}
          <select
            value={issuerId}
            onChange={(event) => setIssuerId(event.target.value)}
            aria-label="Filter by issuer company"
            title={selectedIssuerName ?? "All issuer companies"}
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
            title={selectedBuyerName ?? "All buyer companies"}
            className={selectClassName}
          >
            <option value="">All buyer companies</option>
            {buyerCompanies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2 pl-1">
            <span className="whitespace-nowrap text-xs text-zinc-500">
              {formatNumberIN(totals.count, WHOLE)} of{" "}
              {formatNumberIN(sales.length, WHOLE)} sales
            </span>
            {isFiltered ? (
              <button
                type="button"
                onClick={resetFilters}
                className="cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 ring-1 ring-inset ring-[#242832] transition-colors hover:bg-[#1b1e25] hover:text-zinc-100"
              >
                Clear filters
              </button>
            ) : null}
          </div>
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
