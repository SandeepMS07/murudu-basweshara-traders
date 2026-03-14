"use client";

import { useCallback, useMemo, useState } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { createSaleColumns } from "@/features/sales/components/Columns";
import { Sale } from "@/features/sales/schemas";
import { Company } from "@/features/companies/schemas";

interface SalesTableClientProps {
  data: Sale[];
  buyerCompanies: Company[];
}

export function SalesTableClient({
  data,
  buyerCompanies,
}: SalesTableClientProps) {
  const [selectedBuyerId, setSelectedBuyerId] = useState("");

  const filteredData = useMemo(() => {
    if (!selectedBuyerId) return data;
    return data.filter((sale) => sale.sale_company_id === selectedBuyerId);
  }, [data, selectedBuyerId]);

  const columns = useMemo(() => createSaleColumns(), []);

  const partyRowClass = useCallback((party: string) => {
    const normalized = (party || "unknown").trim().toLowerCase();
    let hash = 0;
    for (let i = 0; i < normalized.length; i += 1) {
      hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
    }
    const palette = [
      "bg-[#111214] hover:bg-[#17191f]",
      "bg-[#15120f] hover:bg-[#1b1611]",
      "bg-[#101a16] hover:bg-[#14201b]",
      "bg-[#111725] hover:bg-[#162033]",
    ];
    return palette[hash % palette.length];
  }, []);

  const toolbarRight = (
    <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
      <select
        value={selectedBuyerId}
        onChange={(event) => {
          setSelectedBuyerId(event.target.value);
        }}
        className="h-10 rounded-md border border-[#2a2d34] bg-[#14161b] px-3 text-sm text-zinc-100"
      >
        <option value="">All buyer companies</option>
        {buyerCompanies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={filteredData}
        searchKey="party"
        searchPlaceholder="Filter by party..."
        toolbarRight={toolbarRight}
        rowClassName={(row) => partyRowClass(row.original.party)}
      />
    </>
  );
}
