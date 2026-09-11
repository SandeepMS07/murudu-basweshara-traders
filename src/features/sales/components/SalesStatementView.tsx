"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Company } from "@/features/companies/schemas";
import type { Sale } from "@/features/sales/schemas";
import {
  effectivePending,
  summariseSales,
  type SalesFilter,
} from "@/features/sales/lib/sales-filter";
import { formatRangeLabel } from "@/lib/date-range";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

/**
 * The printable Sales Statement: exactly the rows the overview filter selected,
 * with column totals. The filter is resolved server-side from the query string
 * so the print output is a real page (shareable, reloadable) rather than a
 * snapshot of client state.
 */

const money = (value: number) =>
  formatCurrencyINR(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const whole = (value: number) =>
  formatNumberIN(value, { maximumFractionDigits: 0 });

const rate = (value: number) =>
  formatNumberIN(value, { maximumFractionDigits: 2 });

const displayDate = (value: string) => {
  try {
    return format(parseISO(value), "dd-MM-yyyy");
  } catch {
    return value;
  }
};

/**
 * Percentage widths for the eleven printed columns, summing to 100. Paired
 * with `table-layout: fixed` so the table fills A4 portrait exactly and long
 * party names wrap inside their cell instead of stretching the page.
 */
const COLUMN_WIDTHS = [
  "4%", // #
  "4%", // Bill
  "8.5%", // Date
  "19%", // Party
  "11%", // Lorry
  "6%", // Bags
  "8.5%", // Net Wt
  "9%", // Factory Wt
  "5%", // Rate
  "12%", // Amount
  "13%", // Received
];

interface SalesStatementViewProps {
  sales: Sale[];
  /** FIFO-effective pending, computed across every sale (not just these). */
  pendingBySaleId: Record<string, number>;
  issuerCompanies: Company[];
  buyerCompanies: Company[];
  filter: SalesFilter;
  /** Total sales on record, for the "N of M" line. */
  totalSalesCount: number;
  /** Hides the "Back" control when rendered inside the preview dialog. */
  embedded?: boolean;
}

export function SalesStatementView({
  sales,
  pendingBySaleId,
  issuerCompanies,
  buyerCompanies,
  filter,
  totalSalesCount,
  embedded = false,
}: SalesStatementViewProps) {
  const issuerNameById = useMemo(
    () =>
      new Map(
        issuerCompanies.map((company) => [
          company.id,
          company.display_name || company.name,
        ]),
      ),
    [issuerCompanies],
  );

  const sortedSales = useMemo(
    () =>
      [...sales].sort(
        (a, b) =>
          a.sale_date.localeCompare(b.sale_date) ||
          a.bill_number.localeCompare(b.bill_number, undefined, {
            numeric: true,
          }),
      ),
    [sales],
  );

  const totals = useMemo(
    () => summariseSales(sales, pendingBySaleId),
    [sales, pendingBySaleId],
  );

  // Grouped by issuer because the overview now filters by it: a statement run
  // across all issuers would otherwise give no way to read the split.
  const issuerBreakdown = useMemo(() => {
    const map = new Map<
      string,
      { name: string; bills: number; amount: number; pending: number }
    >();
    for (const sale of sales) {
      const key = sale.issuer_company_id ?? "unknown";
      const row = map.get(key) ?? {
        name: sale.issuer_company_id
          ? (issuerNameById.get(sale.issuer_company_id) ?? "Unknown")
          : "Unassigned",
        bills: 0,
        amount: 0,
        pending: 0,
      };
      row.bills += 1;
      row.amount += sale.amount;
      row.pending += effectivePending(sale, pendingBySaleId);
      map.set(key, row);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [sales, pendingBySaleId, issuerNameById]);

  const issuerLabel = filter.issuerId
    ? (issuerNameById.get(filter.issuerId) ?? "Unknown")
    : "All issuer companies";
  const buyerLabel = filter.buyerId
    ? (buyerCompanies.find((company) => company.id === filter.buyerId)?.name ??
      "Unknown")
    : "All buyer companies";

  const summaryCards = [
    { label: "Bills", value: whole(totals.count) },
    { label: "Net Weight", value: `${whole(totals.netWeight)} kg` },
    { label: "Total Amount", value: money(totals.amount) },
    { label: "Received", value: money(totals.received) },
    { label: "Pending", value: money(totals.pending) },
  ];

  return (
    <div className="min-h-screen bg-zinc-100 print:min-h-0 print:bg-white">
      <style>{`
        .statement-doc { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        /* Fixed layout + the percentage colgroup keeps the eleven columns
           inside A4 portrait; party names wrap rather than widen the page. */
        .sales-table { table-layout: fixed; width: 100%; }
        .sales-table td { overflow-wrap: anywhere; }
        /* Only the two free-text columns may wrap; a wrapped figure reads as
           two different numbers ("58,27" over "8"). */
        .sales-table .num { white-space: nowrap; overflow-wrap: normal; }
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          html, body { height: auto !important; }
          /* Repeats the column headers on every printed page. */
          thead { display: table-header-group; }
          /* ...but NOT the totals: a tfoot repeats by default, which would put
             the grand total at the foot of every page where it reads as a page
             subtotal. As a row group it prints once, after the last sale. */
          tfoot { display: table-row-group; }
          tr { break-inside: avoid; }
          /* pt, not px: print sizing should follow the paper, not the screen. */
          .sales-table { font-size: 7pt; }
          .sales-table th, .sales-table td { padding: 2px 3px; }
        }
      `}</style>

      {/* max-w-4xl, not wider: the on-screen preview should be roughly the
          shape of the A4 portrait page it prints to. */}
      <div className="mx-auto max-w-4xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          {embedded ? (
            <span />
          ) : (
            <a
              href="/sales"
              className="text-sm text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
            >
              ← Back to Sales
            </a>
          )}
          <Button
            type="button"
            onClick={() => window.print()}
            className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        <div className="statement-doc rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="h-2 rounded-t-xl bg-linear-to-r from-[#ff6a3d] to-[#ff8f6b] print:rounded-none" />

          <div className="p-6 print:p-2">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/mb-logo-bill.png"
                  alt="MB Groups"
                  className="h-12 w-auto object-contain"
                />
                <div>
                  <div className="text-lg font-bold tracking-tight text-zinc-900">
                    MB GROUPS
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    APMC Yard, Honnali
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c2410c]">
                  Sales Statement
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Generated on {format(new Date(), "dd-MM-yyyy")}
                </div>
              </div>
            </header>

            <section className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3 print:grid-cols-3">
              <div className="flex gap-2">
                <span className="w-12 shrink-0 text-zinc-400">Period</span>
                {/* nowrap: a date range broken across two lines ("31-03-" /
                    "2027") is unreadable at print size. */}
                <span className="whitespace-nowrap font-semibold text-zinc-900">
                  {formatRangeLabel(filter.range)}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="w-12 shrink-0 text-zinc-400">Issuer</span>
                <span className="font-semibold text-zinc-900">
                  {issuerLabel}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="w-12 shrink-0 text-zinc-400">Buyer</span>
                <span className="font-semibold text-zinc-900">
                  {buyerLabel}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="w-12 shrink-0 text-zinc-400">Bills</span>
                <span className="text-zinc-700">
                  {whole(totals.count)} of {whole(totalSalesCount)} sales
                </span>
              </div>
            </section>

            <section className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 print:grid-cols-5">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {card.label}
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-zinc-900">
                    {card.value}
                  </div>
                </div>
              ))}
            </section>

            <section className="mt-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                Sales
              </h2>
              {sortedSales.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-500">
                  No sales match the selected filter.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="sales-table w-full border-collapse text-[10px]">
                    <colgroup>
                      {COLUMN_WIDTHS.map((width, index) => (
                        <col key={index} style={{ width }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="bg-zinc-100 text-left text-[9px] uppercase tracking-wide text-zinc-600">
                        <Th className="text-right">#</Th>
                        <Th>Bill</Th>
                        <Th>Date</Th>
                        <Th>Party</Th>
                        <Th>Lorry</Th>
                        <Th className="text-right">Bags</Th>
                        <Th className="text-right">Net Wt</Th>
                        <Th className="text-right">Factory Wt</Th>
                        <Th className="text-right">Rate</Th>
                        <Th className="text-right">Amount</Th>
                        <Th className="text-right">Received</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSales.map((sale, index) => {
                        const received =
                          sale.amount - effectivePending(sale, pendingBySaleId);
                        return (
                          <tr
                            key={sale.id}
                            className="border-b border-zinc-200 last:border-0"
                          >
                            <Td className="num text-right text-zinc-400">
                              {index + 1}
                            </Td>
                            <Td className="font-semibold">
                              {sale.bill_number}
                            </Td>
                            <Td className="whitespace-nowrap">
                              {displayDate(sale.sale_date)}
                            </Td>
                            <Td>{sale.party || "-"}</Td>
                            <Td>{sale.lorry_number || "-"}</Td>
                            <Td className="num text-right">{whole(sale.bags)}</Td>
                            <Td className="num text-right">
                              {whole(sale.net_weight)}
                            </Td>
                            <Td className="num text-right">
                              {whole(sale.factory_weight)}
                            </Td>
                            <Td className="num text-right">{rate(sale.rate)}</Td>
                            <Td className="num text-right font-semibold">
                              {money(sale.amount)}
                            </Td>
                            <Td className="num text-right text-emerald-700">
                              {money(received)}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-zinc-300 bg-zinc-100 font-bold">
                        {/* 5 + 6 = the eleven columns above. */}
                        <Td colSpan={5} className="uppercase tracking-wide">
                          Total — {whole(totals.count)}{" "}
                          {totals.count === 1 ? "bill" : "bills"}
                        </Td>
                        <Td className="num text-right">{whole(totals.bags)}</Td>
                        <Td className="num text-right">
                          {whole(totals.netWeight)}
                        </Td>
                        <Td className="num text-right">
                          {whole(totals.factoryWeight)}
                        </Td>
                        <Td />
                        <Td className="num text-right">{money(totals.amount)}</Td>
                        <Td className="num text-right text-emerald-700">
                          {money(totals.received)}
                        </Td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            {issuerBreakdown.length > 1 ? (
              <section className="mt-5 break-inside-avoid">
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  Issuer-wise Summary
                </h2>
                <table className="w-full max-w-2xl border-collapse text-[10px]">
                  <thead>
                    <tr className="bg-zinc-100 text-left text-[9px] uppercase tracking-wide text-zinc-600">
                      <Th>Issuer Company</Th>
                      <Th className="text-right">Bills</Th>
                      <Th className="text-right">Amount</Th>
                      <Th className="text-right">Received</Th>
                      <Th className="text-right">Pending</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuerBreakdown.map((row) => (
                      <tr
                        key={row.name}
                        className="border-b border-zinc-200 last:border-0"
                      >
                        <Td>{row.name}</Td>
                        <Td className="text-right">{whole(row.bills)}</Td>
                        <Td className="text-right">{money(row.amount)}</Td>
                        <Td className="text-right text-emerald-700">
                          {money(row.amount - row.pending)}
                        </Td>
                        <Td className="text-right font-semibold text-red-600">
                          {money(row.pending)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            <footer className="mt-6 border-t border-zinc-200 pt-3 text-[9px] text-zinc-400">
              Pending is computed by settling each buyer&apos;s payments against
              their oldest bill first, across all sales on record — not only the
              period shown above.
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`border-b border-zinc-300 px-1.5 py-1.5 font-semibold ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-1.5 py-1 align-top ${className}`}>
      {children}
    </td>
  );
}
