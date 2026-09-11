"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { createSoyaFactoryColumns } from "@/features/soya-factory/components/Columns";
import type { SoyaFactoryEntry } from "@/features/soya-factory/schemas";
import { deleteSoyaFactoryEntryAction } from "@/app/soya/factory/actions";

interface SoyaFactoryTableClientProps {
  data: SoyaFactoryEntry[];
  factoryNames: string[];
  addHref?: string;
}

export function SoyaFactoryTableClient({
  data,
  factoryNames,
  addHref = "/soya/factory/add",
}: SoyaFactoryTableClientProps) {
  const [selectedFactory, setSelectedFactory] = useState("");

  const columns = useMemo(
    () => createSoyaFactoryColumns(deleteSoyaFactoryEntryAction),
    [],
  );

  const filteredData = useMemo(() => {
    if (!selectedFactory) return data;
    return data.filter((entry) => entry.factory === selectedFactory);
  }, [data, selectedFactory]);

  return (
    <DataTable
      columns={columns}
      data={filteredData}
      exportFileName="soya_factory"
      disablePagination
      scrollContainerClassName="max-h-[70vh]"
      searchKey="factory"
      searchPlaceholder="Filter by factory, P B no or lorry..."
      searchPredicate={(entry, query) => {
        const row = entry as SoyaFactoryEntry;
        return [row.factory, row.pb_no, row.lorry, row.party]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(query));
      }}
      toolbarRight={null}
      toolbarBelow={
        <div className="flex w-full justify-end">
          <select
            value={selectedFactory}
            onChange={(event) => setSelectedFactory(event.target.value)}
            className="h-10 w-full rounded-md border border-[#2a2d34] bg-[#14161b] px-3 text-sm text-zinc-100 lg:max-w-[320px]"
          >
            <option value="">All factories</option>
            {factoryNames.map((name) => (
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
