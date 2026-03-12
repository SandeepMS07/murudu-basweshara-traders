"use client";

import { DataTable } from "@/components/shared/DataTable";
import { Sale } from "@/features/sales/schemas";
import { saleColumns } from "@/features/sales/components/Columns";

interface SalesTableClientProps {
  data: Sale[];
}

export function SalesTableClient({ data }: SalesTableClientProps) {
  return (
    <DataTable
      columns={saleColumns}
      data={data}
      searchKey="party"
      searchPlaceholder="Filter by party..."
      rowClassName={() => "bg-[#111214] hover:bg-[#17191f]"}
    />
  );
}
