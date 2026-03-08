"use client";

import { DataTable } from "@/components/shared/DataTable";
import { billColumns } from "@/features/bills/components/Columns";
import { BillTableRow } from "@/features/bills/components/Columns";

interface BillsTableClientProps {
  data: BillTableRow[];
}

export function BillsTableClient({ data }: BillsTableClientProps) {
  return (
    <DataTable
      columns={billColumns}
      data={data}
      searchKey="bill_for"
      searchPlaceholder="Filter by bill for..."
    />
  );
}
