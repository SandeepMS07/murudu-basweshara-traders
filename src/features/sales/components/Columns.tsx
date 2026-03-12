"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Edit } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { Sale } from "@/features/sales/schemas";

export const saleColumns: ColumnDef<Sale>[] = [
  {
    accessorKey: "sl_no",
    header: "SL NO",
    cell: ({ row }) => row.original.sl_no ?? "-",
  },
  {
    accessorKey: "bill_number",
    header: "BILL NO",
  },
  {
    accessorKey: "sale_date",
    header: "DATE",
  },
  {
    accessorKey: "party",
    header: "PARTY",
  },
  {
    accessorKey: "lorry_number",
    header: "LORRY",
  },
  {
    accessorKey: "bags",
    header: "BAGS",
    cell: ({ row }) => formatNumberIN(row.original.bags, { maximumFractionDigits: 0 }),
  },
  {
    accessorKey: "net_weight",
    header: "NET WT",
    cell: ({ row }) => formatNumberIN(row.original.net_weight),
  },
  {
    accessorKey: "rate",
    header: "RATE",
    cell: ({ row }) => formatCurrencyINR(row.original.rate),
  },
  {
    accessorKey: "flight",
    header: "FLIGHT",
    cell: ({ row }) => formatCurrencyINR(row.original.flight),
  },
  {
    accessorKey: "amount",
    header: "AMOUNT",
    cell: ({ row }) => formatCurrencyINR(row.original.amount),
  },
  {
    accessorKey: "factory_rate",
    header: "FACTORY RATE",
    cell: ({ row }) => formatCurrencyINR(row.original.factory_rate),
  },
  {
    accessorKey: "factory_amount",
    header: "FACTORY AMOUNT",
    cell: ({ row }) => formatCurrencyINR(row.original.factory_amount),
  },
  {
    accessorKey: "pending_amount",
    header: "PENDING",
    cell: ({ row }) => formatCurrencyINR(row.original.pending_amount),
  },
  {
    accessorKey: "payment_terms",
    header: "PAYMENT TERMS",
    cell: ({ row }) => row.original.payment_terms || "-",
  },
  {
    accessorKey: "source",
    header: "SOURCE",
    cell: ({ row }) => row.original.source.toUpperCase(),
  },
  {
    id: "actions",
    header: "ACTIONS",
    cell: ({ row }) => (
      <div className="flex justify-end pr-2">
        <Link href={`/sales/${row.original.id}/edit`}>
          <Button variant="ghost" size="icon" title="Edit sale">
            <Edit className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    ),
    meta: {
      sticky: true,
      right: "0",
      zIndex: 4,
      width: "120px",
      headClassName: "text-right pr-4",
      cellClassName: "text-right",
      boxShadow: "-8px 0 18px rgba(6, 8, 13, 0.45)",
    },
  },
];
