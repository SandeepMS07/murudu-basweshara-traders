"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { addDays, format, parseISO } from "date-fns";
import { FileText, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import {
  filterRecords,
  ledgerFilterToParams,
  partyOptions,
  summariseRecords,
  type LedgerFilter,
  type LedgerRecord,
  type PartyOf,
} from "@/features/purchases/lib/record-filter";
import type { DateRange } from "@/lib/date-range";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { printIframeAs } from "@/lib/print-iframe";

/**
 * The Purchases and Bilty overview shell: KPI cards, the date-range + party
 * filter bar, and the printable statement. Both modules share one record shape
 * and one set of cards, so this is written once and the module-specific table
 * arrives through `renderTable`.
 */

const WHOLE = { minimumFractionDigits: 0, maximumFractionDigits: 0 } as const;

interface TradeOverviewClientProps<T extends LedgerRecord> {
  /** Every record; the filter decides what is in view. */
  records: T[];
  partyOf: PartyOf<T>;
  /** "Seller" / "Party" — labels the filter and the statement column. */
  partyLabel: string;
  /** Given explicitly: naive "+s" turns "Party" into "Partys". */
  partyLabelPlural: string;
  /** Default range — this financial year, matching the previous behaviour. */
  initialRange: DateRange;
  /** Today in IST as `yyyy-MM-dd`, so presets agree with the server. */
  todayIso: string;
  statementPath: string;
  statementFilePrefix: string;
  /** The module's own table, rendered with the filtered rows. */
  renderTable: (rows: T[]) => ReactNode;
}

export function TradeOverviewClient<T extends LedgerRecord>({
  records,
  partyOf,
  partyLabel,
  partyLabelPlural,
  initialRange,
  todayIso,
  statementPath,
  statementFilePrefix,
  renderTable,
}: TradeOverviewClientProps<T>) {
  const today = useMemo(() => parseISO(todayIso), [todayIso]);
  const [range, setRange] = useState<DateRange>(initialRange);
  const [party, setParty] = useState("");
  const [statementOpen, setStatementOpen] = useState(false);
  const statementFrameRef = useRef<HTMLIFrameElement>(null);

  const filter: LedgerFilter = useMemo(() => ({ range, party }), [range, party]);

  const filtered = useMemo(
    () => filterRecords(records, filter, partyOf),
    [records, filter, partyOf],
  );

  // Every card reflects the records currently in view, so the filter bar and
  // the totals can never disagree. The statement runs the same two helpers.
  const totals = useMemo(() => summariseRecords(filtered), [filtered]);

  const parties = useMemo(
    () => partyOptions(records, partyOf),
    [records, partyOf],
  );

  // "Today" and "last 7 days" stay anchored to the real date rather than the
  // filter, so they keep meaning the same thing as the range is moved.
  const todayKey = todayIso;
  const todaysTotals = useMemo(() => {
    let bags = 0;
    let weight = 0;
    for (const record of filtered) {
      if (record.date !== todayKey) continue;
      bags += record.bags;
      weight += record.net_weight;
    }
    return { bags, weight };
  }, [filtered, todayKey]);

  const last7AverageRate = useMemo(() => {
    const since = format(addDays(today, -6), "yyyy-MM-dd");
    let weight = 0;
    let amount = 0;
    for (const record of filtered) {
      if (record.date < since) continue;
      weight += record.net_weight;
      amount += record.final_total;
    }
    return weight > 0 ? amount / weight : 0;
  }, [filtered, today]);

  const isFiltered =
    range.from !== initialRange.from ||
    range.to !== initialRange.to ||
    party !== "";

  const resetFilters = () => {
    setRange(initialRange);
    setParty("");
  };

  // The statement is a real server-rendered page, so the filter travels as a
  // query string rather than as client state.
  const statementHref = useMemo(() => {
    const params = ledgerFilterToParams(filter);
    params.set("embed", "1");
    return `${statementPath}?${params.toString()}`;
  }, [filter, statementPath]);

  const statementFileName = useMemo(
    () =>
      `${statementFilePrefix} ${party || "All"} ${format(new Date(), "dd-MM-yyyy")}`,
    [party, statementFilePrefix],
  );

  const cards: { title: string; value: string; note?: string }[] = [
    { title: "Total Bags", value: formatNumberIN(totals.bags, WHOLE) },
    {
      title: "Total Weight",
      value: `${formatNumberIN(totals.netWeight, WHOLE)} kg`,
    },
    {
      title: "Total Amount",
      value: formatCurrencyINR(totals.total, { maximumFractionDigits: 0 }),
    },
    {
      title: "Average Rate",
      value: `${formatCurrencyINR(totals.averageRate, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}/kg`,
      note: `Last 7 days avg: ${formatCurrencyINR(last7AverageRate, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}/kg`,
    },
    { title: "Today Bags", value: formatNumberIN(todaysTotals.bags, WHOLE) },
    {
      title: "Today Weight",
      value: `${formatNumberIN(todaysTotals.weight, WHOLE)} kg`,
    },
  ];

  const selectClassName =
    "h-9 min-w-36 flex-1 cursor-pointer truncate rounded-lg bg-[#0f1115] px-2.5 text-xs text-zinc-100 ring-1 ring-inset ring-[#242832] outline-none sm:max-w-60 focus-visible:ring-[#ff6a3d]";

  return (
    <>
      <div className="mb-2 grid grid-cols-2 gap-3 sm:mb-3 xl:grid-cols-6">
        {cards.map((card) => (
          <Card
            key={card.title}
            className="border-[#1f2229] bg-linear-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
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
              {card.note ? (
                <p className="mt-1 text-sm font-semibold text-[#f6c18a]">
                  {card.note}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-3 rounded-xl border border-[#1f2229] bg-linear-to-b from-[#17191f] to-[#14161b] p-2.5 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={setRange} today={today} />

          <select
            value={party}
            onChange={(event) => setParty(event.target.value)}
            aria-label={`Filter by ${partyLabel.toLowerCase()}`}
            title={party || `All ${partyLabelPlural.toLowerCase()}`}
            className={selectClassName}
          >
            <option value="">All {partyLabelPlural.toLowerCase()}</option>
            {parties.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <div className="ml-auto flex items-center gap-2 pl-1">
            <span className="whitespace-nowrap text-xs text-zinc-500">
              {formatNumberIN(totals.count, WHOLE)} of{" "}
              {formatNumberIN(records.length, WHOLE)}
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
            <button
              type="button"
              onClick={() => setStatementOpen(true)}
              className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#ff6a3d] px-2.5 py-1.5 text-xs font-semibold text-white shadow-[0_1px_6px_rgba(255,106,61,0.35)] transition-colors hover:bg-[#ff5a28]"
            >
              <FileText className="h-3.5 w-3.5" />
              View Statement
            </button>
          </div>
        </div>
      </div>

      {renderTable(filtered)}

      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[92vh] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden rounded-xl border border-[#2a2d34] bg-[#15171c] p-0 sm:max-w-5xl"
        >
          <div className="flex items-center justify-between border-b border-[#2a2d34] px-4 py-2.5">
            <span className="text-sm font-medium text-zinc-200">
              {statementFilePrefix}
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  printIframeAs(
                    statementFrameRef.current?.contentWindow,
                    statementFileName,
                  )
                }
                className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStatementOpen(false)}
                className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              >
                Close
              </Button>
            </div>
          </div>
          {statementOpen ? (
            <iframe
              ref={statementFrameRef}
              src={statementHref}
              title={statementFilePrefix}
              className="min-h-0 flex-1 bg-white"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
