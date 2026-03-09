"use client";

import { DataTable } from "@/components/shared/DataTable";
import { purchaseColumns } from "@/features/purchases/components/Columns";
import { Purchase } from "@/features/purchases/schemas";

interface PurchasesTableClientProps {
  data: Purchase[];
}

export function PurchasesTableClient({ data }: PurchasesTableClientProps) {
  return (
    <DataTable
      columns={purchaseColumns}
      data={data}
      searchKey="name"
      searchPlaceholder="Filter by name..."
    />
  );
}
