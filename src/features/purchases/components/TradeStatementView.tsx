"use client";

import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  summariseRecords,
  type LedgerFilter,
  type LedgerRecord,
} from "@/features/purchases/lib/record-filter";
import { formatRangeLabel } from "@/lib/date-range";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

/**
 * The printable statement shared by Purchases and Bilty: the rows the overview
 * filter selected, with column totals. Modelled on the Sales statement and
 * printed on the same A4 portrait page; the two modules differ only in their
 * heading, counterparty label and whether a PLACE column is shown.
 */

const money = (value: number) =>
  formatCurrencyINR(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

const whole = (value: number) =>
  formatNumberIN(value, { maximumFractionDigits: 0 });

const decimal = (value: number) =>
  formatNumberIN(value, { maximumFractionDigits: 2 });

const displayDate = (value: string) => {
  try {
    return format(parseISO(value), "dd-MM-yyyy");
  } catch {
    return value;
  }
};

/**
 * Percentage widths summing to 100, paired with `table-layout: fixed` so the
 * table fills A4 portrait exactly. Two variants because Bilty has no bag-less
 * deduction and gives that width back to the party name — the same split the
 * shared column factory already makes via `showBagLessColumn`.
 */
const WIDTHS_WITH_BAG_LESS = [
  "3.5%", // #
  "5%", // Bill
  "8%", // Date
  "20%", // Seller
  "5.5%", // Bags
  "8%", // Net Wt
  "5%", // Rate
  "11%", // Amount
  "8%", // Bag Less
  "7%", // Add
  "8%", // Paid
  "11%", // Total
];

const WIDTHS_WITHOUT_BAG_LESS = [
  "3.5%", // #
  "5%", // Bill
  "8.5%", // Date
  "26%", // Party
  "5.5%", // Bags
  "8.5%", // Net Wt
  "5%", // Rate
  "12%", // Amount
  "7%", // Add
  "8%", // Paid
  "11%", // Total
];

interface TradeStatementViewProps<T extends LedgerRecord> {
  records: T[];
  /**
   * The field holding the counterparty name ("name" for Purchases, "party" for
   * Bilty). A key rather than an accessor function because this component is
   * rendered by a server component, and functions cannot cross that boundary.
   */
  partyKey: keyof T & string;
  filter: LedgerFilter;
  /** "Purchases Statement" / "Bilty Statement". */
  documentTitle: string;
  /** "Seller" / "Party" — labels both the filter line and the name column. */
  partyLabel: string;
  /** Given explicitly: naive "+s" turns "Party" into "Partys". */
  partyLabelPlural: string;
  /**
   * Purchases deducts a per-bag amount before the total; Bilty does not. The
   * column is needed for the row to add up:
   * total = amount - bag less + add - paid.
   */
  showBagLess?: boolean;
  bagLessOfKey?: keyof T & string;
  /** Total records on file, for the "N of M" line. */
  totalRecordCount: number;
  /** Where the non-embedded "Back" link points. */
  backHref: string;
  backLabel: string;
  /** Hides the "Back" control when rendered inside the preview dialog. */
  embedded?: boolean;
}

export function TradeStatementView<T extends LedgerRecord>({
  records,
  partyKey,
  filter,
  documentTitle,
  partyLabel,
  partyLabelPlural,
  showBagLess = false,
  bagLessOfKey,
  totalRecordCount,
  backHref,
  backLabel,
  embedded = false,
}: TradeStatementViewProps<T>) {
  const partyOf = useMemo(
    () => (record: T) => String(record[partyKey] ?? ""),
    [partyKey],
  );
  const bagLessOf = useMemo(
    () => (record: T) =>
      bagLessOfKey ? Number(record[bagLessOfKey] ?? 0) || 0 : 0,
    [bagLessOfKey],
  );

  const sorted = useMemo(
    () =>
      [...records].sort(
        (a, b) => a.date.localeCompare(b.date) || a.bill_no - b.bill_no,
      ),
    [records],
  );

  const totals = useMemo(() => summariseRecords(records), [records]);

  const widths = showBagLess
    ? WIDTHS_WITH_BAG_LESS
    : WIDTHS_WITHOUT_BAG_LESS;

  const bagLessTotal = useMemo(
    () => records.reduce((sum, record) => sum + bagLessOf(record), 0),
    [records, bagLessOf],
  );

  const summaryCards = [
    { label: "Records", value: whole(totals.count) },
    { label: "Total Bags", value: whole(totals.bags) },
    { label: "Net Weight", value: `${whole(totals.netWeight)} kg` },
    { label: "Total Amount", value: money(totals.total) },
    {
      label: "Avg Rate",
      value: `${formatCurrencyINR(totals.averageRate, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}/kg`,
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-100 print:min-h-0 print:bg-white">
      <style>{`
        .statement-doc { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .ledger-table { table-layout: fixed; width: 100%; }
        .ledger-table td { overflow-wrap: anywhere; }
        /* A wrapped figure reads as two different numbers ("58,27" over "8"). */
        .ledger-table .num { white-space: nowrap; overflow-wrap: normal; }
        /* Column titles stay on one line so the header row keeps an even height. */
        .ledger-table th { white-space: nowrap; vertical-align: bottom; }
        @page { size: A4 portrait; margin: 10mm; }
        @media print {
          html, body { height: auto !important; }
          /* Repeats the column headers on every printed page... */
          thead { display: table-header-group; }
          /* ...but NOT the totals: a tfoot repeats by default, which would put
             the grand total at the foot of every page where it reads as a page
             subtotal. As a row group it prints once, after the last record. */
          tfoot { display: table-row-group; }
          tr { break-inside: avoid; }
          /* pt, not px: print sizing should follow the paper, not the screen. */
          .ledger-table { font-size: 7pt; }
          .ledger-table th, .ledger-table td { padding: 2px 3px; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          {embedded ? (
            <span />
          ) : (
            <a
              href={backHref}
              className="text-sm text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
            >
              ← Back to {backLabel}
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
                  {documentTitle}
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Generated on {format(new Date(), "dd-MM-yyyy")}
                </div>
              </div>
            </header>

            <section className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-3 print:grid-cols-3">
              <div className="flex gap-2">
                <span className="w-12 shrink-0 text-zinc-400">Period</span>
                {/* nowrap: a date range broken across two lines is unreadable. */}
                <span className="whitespace-nowrap font-semibold text-zinc-900">
                  {formatRangeLabel(filter.range)}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="w-12 shrink-0 text-zinc-400">
                  {partyLabel}
                </span>
                <span className="font-semibold text-zinc-900">
                  {filter.party || `All ${partyLabelPlural.toLowerCase()}`}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="w-12 shrink-0 text-zinc-400">Records</span>
                <span className="text-zinc-700">
                  {whole(totals.count)} of {whole(totalRecordCount)}
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
                Records
              </h2>
              {sorted.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-300 px-3 py-6 text-center text-xs text-zinc-500">
                  No records match the selected filter.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="ledger-table w-full border-collapse text-[10px]">
                    <colgroup>
                      {widths.map((width, index) => (
                        <col key={index} style={{ width }} />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="bg-zinc-100 text-left text-[9px] uppercase tracking-wide text-zinc-600">
                        <Th className="text-right">#</Th>
                        <Th>Bill</Th>
                        <Th>Date</Th>
                        <Th>{partyLabel}</Th>
                        <Th className="text-right">Bags</Th>
                        <Th className="text-right">Net Wt</Th>
                        <Th className="text-right">Rate</Th>
                        <Th className="text-right">Amount</Th>
                        {showBagLess ? (
                          <Th className="text-right">Bag Less</Th>
                        ) : null}
                        <Th className="text-right">Add</Th>
                        <Th className="text-right">Paid</Th>
                        <Th className="text-right">Total</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((record, index) => (
                        <tr
                          key={record.id}
                          className="border-b border-zinc-200 last:border-0"
                        >
                          <Td className="num text-right text-zinc-400">
                            {index + 1}
                          </Td>
                          <Td className="num font-semibold">
                            {record.bill_no}
                          </Td>
                          <Td className="num">{displayDate(record.date)}</Td>
                          <Td>{partyOf(record) || "-"}</Td>
                          <Td className="num text-right">
                            {whole(record.bags)}
                          </Td>
                          <Td className="num text-right">
                            {whole(record.net_weight)}
                          </Td>
                          <Td className="num text-right">
                            {decimal(record.rate)}
                          </Td>
                          <Td className="num text-right">
                            {money(record.amount)}
                          </Td>
                          {showBagLess ? (
                            <Td className="num text-right">
                              {bagLessOf(record) ? money(bagLessOf(record)) : "-"}
                            </Td>
                          ) : null}
                          <Td className="num text-right">
                            {record.add_amount ? money(record.add_amount) : "-"}
                          </Td>
                          <Td className="num text-right text-emerald-700">
                            {record.cash_paid + record.upi_paid
                              ? money(record.cash_paid + record.upi_paid)
                              : "-"}
                          </Td>
                          <Td className="num text-right font-semibold">
                            {money(record.final_total)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-zinc-300 bg-zinc-100 font-bold">
                        <Td colSpan={4} className="uppercase tracking-wide">
                          Total — {whole(totals.count)}{" "}
                          {totals.count === 1 ? "record" : "records"}
                        </Td>
                        <Td className="num text-right">{whole(totals.bags)}</Td>
                        <Td className="num text-right">
                          {whole(totals.netWeight)}
                        </Td>
                        <Td />
                        <Td className="num text-right">
                          {money(totals.amount)}
                        </Td>
                        {showBagLess ? (
                          <Td className="num text-right">
                            {bagLessTotal ? money(bagLessTotal) : "-"}
                          </Td>
                        ) : null}
                        <Td className="num text-right">
                          {totals.addAmount ? money(totals.addAmount) : "-"}
                        </Td>
                        <Td className="num text-right text-emerald-700">
                          {totals.paid ? money(totals.paid) : "-"}
                        </Td>
                        <Td className="num text-right">{money(totals.total)}</Td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <footer className="mt-6 border-t border-zinc-200 pt-3 text-[9px] text-zinc-400">
              Total = Amount{showBagLess ? " − Bag Less" : ""} + Add − Paid, so
              it is the balance outstanding on each record, not the gross value.
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
