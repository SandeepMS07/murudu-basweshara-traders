"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import {
  createSoyaPartyColumns,
  getSoyaPartyDueDate,
} from "@/features/soya-parties/components/Columns";
import type { SoyaPartyEntry } from "@/features/soya-parties/schemas";
import { deleteSoyaPartyEntryAction } from "@/app/soya/parties/actions";

interface SoyaPartyTableClientProps {
  data: SoyaPartyEntry[];
  partyNames: string[];
  addHref?: string;
  /** Unpaid amount per bill; adds the due columns and row colours. */
  pendingById?: Record<string, number>;
}

/** The maize Sales legend, colours and order included. */
const LEGEND = [
  { label: "Overdue (date crossed)", box: "border-[#3b1b1b] bg-[#2a1111]/40", dot: "bg-[#ef4444]" },
  { label: "Due Today", box: "border-[#3d3418] bg-[#2a2412]/40", dot: "bg-[#f59e0b]" },
  { label: "Cleared", box: "border-[#1d3a27] bg-[#102015]/30", dot: "bg-[#22c55e]" },
  { label: "Upcoming", box: "border-[#2a2d34] bg-[#15171c]", dot: "bg-[#71717a]" },
];

export function SoyaPartyTableClient({
  data,
  partyNames,
  addHref = "/soya/parties/new",
  pendingById,
}: SoyaPartyTableClientProps) {
  const [selectedParty, setSelectedParty] = useState("");

  const columns = useMemo(
    () => createSoyaPartyColumns(deleteSoyaPartyEntryAction, pendingById),
    [pendingById],
  );

  const todayStart = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }, []);

  // Same statuses and colours as maize Sales.
  const getRowClassName = useCallback(
    (entry: SoyaPartyEntry) => {
      if (!pendingById) return "";
      if ((pendingById[entry.id] ?? 0) <= 0) {
        return "bg-[#102015]/30 text-[#c7f2d2] hover:bg-[#16301f]/45";
      }
      const dueDate = getSoyaPartyDueDate(entry);
      if (!dueDate) return "";
      const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      if (dueStart.getTime() < todayStart.getTime()) {
        return "bg-[#2a1111]/40 text-[#f5d3d3] hover:bg-[#361616]/50";
      }
      if (dueStart.getTime() === todayStart.getTime()) {
        return "bg-[#2a2412]/40 text-[#f7e3b0] hover:bg-[#352d16]/50";
      }
      return "";
    },
    [pendingById, todayStart],
  );

  const filteredData = useMemo(() => {
    if (!selectedParty) return data;
    return data.filter((entry) => entry.party === selectedParty);
  }, [data, selectedParty]);

  return (
    <DataTable
      columns={columns}
      data={filteredData}
      exportFileName="soya_parties"
      disablePagination
      scrollContainerClassName="max-h-[70vh]"
      searchKey="party"
      searchPlaceholder="Filter by party, bill no or lorry..."
      searchPredicate={(entry, query) => {
        const row = entry as SoyaPartyEntry;
        return [row.party, row.bill_no, row.lorry_no, row.factory]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(query));
      }}
      toolbarRight={null}
      rowClassName={(row) => getRowClassName(row.original)}
      toolbarBelow={
        <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          {pendingById ? (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              {LEGEND.map((item) => (
                <div
                  key={item.label}
                  className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border px-2 py-1 text-xs text-zinc-200 ${item.box}`}
                >
                  <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                  {item.label}
                </div>
              ))}
            </div>
          ) : (
            <span />
          )}
          <select
            value={selectedParty}
            onChange={(event) => setSelectedParty(event.target.value)}
            className="h-10 w-full rounded-md border border-[#2a2d34] bg-[#14161b] px-3 text-sm text-zinc-100 lg:max-w-[320px]"
          >
            <option value="">All parties</option>
            {partyNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      }
      toolbarFarRight={
        addHref ? (
          <Link href={addHref} className="w-full sm:w-auto">
            <Button className="h-10 w-full border border-[#2a2d34] bg-[#17191f] px-4 text-zinc-100 hover:bg-[#1d2026] sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </Link>
        ) : null
      }
    />
  );
}
