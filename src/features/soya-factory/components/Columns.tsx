"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";

import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { SoyaRowActions } from "@/features/soya/components/SoyaRowActions";
import type { SoyaFactoryEntry } from "@/features/soya-factory/schemas";

/**
 * Headers are the customer's workbook headers verbatim (FACTORY half of the
 * SALES sheet, columns 1-12, plus PARTY from the per-factory ledger tabs).
 * AMOUNT appears twice on purpose: column 9 is the taxable value, column 12 the
 * invoice total.
 */
const whole = { minimumFractionDigits: 0, maximumFractionDigits: 0 } as const;

const num = (value: number) => formatNumberIN(value, whole);
const money = (value: number) => formatCurrencyINR(value, whole);

export function createSoyaFactoryColumns(
  deleteAction: (id: string) => Promise<void>,
): ColumnDef<SoyaFactoryEntry>[] {
  return [
    {
      accessorKey: "sl_no",
      header: "SL NO",
      cell: ({ row }) => row.original.sl_no ?? "-",
    },
    {
      accessorKey: "factory",
      header: "FACTORY",
      cell: ({ row }) => row.original.factory || "-",
    },
    {
      accessorKey: "date",
      header: "DATE",
      cell: ({ row }) => {
        const raw = String(row.getValue("date"));
        try {
          return format(parseISO(raw), "dd-MM-yyyy");
        } catch {
          return raw;
        }
      },
      meta: { cellClassName: "whitespace-nowrap" },
    },
    {
      accessorKey: "pb_no",
      header: "P B NO",
      cell: ({ row }) => row.original.pb_no || "-",
    },
    {
      accessorKey: "lorry",
      header: "LORRY",
      cell: ({ row }) => row.original.lorry || "-",
      meta: { cellClassName: "whitespace-nowrap" },
    },
    {
      accessorKey: "bags",
      header: "BAGS",
      cell: ({ row }) => num(row.original.bags),
    },
    {
      accessorKey: "weight",
      header: "WEIGHT",
      cell: ({ row }) => num(row.original.weight),
    },
    {
      accessorKey: "rate",
      header: "RATE",
      cell: ({ row }) =>
        formatNumberIN(row.original.rate, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        }),
    },
    {
      accessorKey: "amount",
      header: "AMOUNT",
      cell: ({ row }) => money(row.original.amount),
      meta: { cellClassName: "whitespace-nowrap" },
    },
    {
      accessorKey: "gst_amount",
      header: "GST 5 %",
      cell: ({ row }) => money(row.original.gst_amount),
      meta: { headClassName: "whitespace-nowrap", cellClassName: "whitespace-nowrap" },
    },
    {
      accessorKey: "tcs",
      header: "TCS",
      cell: ({ row }) => money(row.original.tcs),
    },
    {
      accessorKey: "total_amount",
      header: "AMOUNT",
      cell: ({ row }) => (
        <div className="font-medium">{money(row.original.total_amount)}</div>
      ),
      meta: { cellClassName: "whitespace-nowrap" },
    },
    {
      accessorKey: "party",
      header: "PARTY",
      cell: ({ row }) => row.original.party || "-",
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <SoyaRowActions
          recordId={row.original.id}
          editHref={`/soya/factory/${row.original.id}/edit`}
          deleteAction={deleteAction}
        />
      ),
      meta: {
        sticky: true,
        right: "0px",
        zIndex: 30,
        width: "132px",
        headClassName:
          "whitespace-nowrap text-right pr-4 bg-[#15171c] border-l border-[#252932]",
        cellClassName: "text-right bg-[#111214] border-l border-[#252932]",
        boxShadow: "-8px 0 18px rgba(6, 8, 13, 0.45)",
      },
    },
  ];
}
