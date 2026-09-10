"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { createSoyaPartyColumns } from "@/features/soya-parties/components/Columns";
import type { SoyaPartyEntry } from "@/features/soya-parties/schemas";
import { deleteSoyaPartyEntryAction } from "@/app/soya/parties/actions";

interface SoyaPartyTableClientProps {
  data: SoyaPartyEntry[];
  partyNames: string[];
  addHref?: string;
}

export function SoyaPartyTableClient({
  data,
  partyNames,
  addHref = "/soya/parties/new",
}: SoyaPartyTableClientProps) {
  const [selectedParty, setSelectedParty] = useState("");

  const columns = useMemo(
    () => createSoyaPartyColumns(deleteSoyaPartyEntryAction),
    [],
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
      toolbarBelow={
        <div className="flex w-full justify-end">
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
