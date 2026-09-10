"use client";

import { ColumnDef } from "@tanstack/react-table";
import { format, parseISO } from "date-fns";

import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { SoyaRowActions } from "@/features/soya/components/SoyaRowActions";
import type { SoyaPartyEntry } from "@/features/soya-parties/schemas";

/**
 * Headers are the customer's workbook headers verbatim (PARTIES half of the
 * SALES sheet, columns 13-26, plus LORRY NO and FACTORY from the per-party
 * ledger tabs). AMOUNT appears twice on purpose: column 19 is the taxable
 * value, column 23 the invoice total. FREIGHT and FRIGHT are two different
 * columns in the sheet, not a duplicate.
 */
const whole = { minimumFractionDigits: 0, maximumFractionDigits: 0 } as const;

const num = (value: number) => formatNumberIN(value, whole);
const money = (value: number) => formatCurrencyINR(value, whole);
const nowrap = {
  headClassName: "whitespace-nowrap",
  cellClassName: "whitespace-nowrap",
} as const;

export function createSoyaPartyColumns(
  deleteAction: (id: string) => Promise<void>,
): ColumnDef<SoyaPartyEntry>[] {
  return [
    {
      accessorKey: "sl_no",
      header: "SL NO",
      cell: ({ row }) => row.original.sl_no ?? "-",
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
      meta: nowrap,
    },
    {
      accessorKey: "bill_no",
      header: "BILL NO",
      cell: ({ row }) => row.original.bill_no || "-",
      meta: nowrap,
    },
    {
      accessorKey: "lorry_no",
      header: "LORRY NO",
      cell: ({ row }) => row.original.lorry_no || "-",
      meta: nowrap,
    },
    {
      accessorKey: "bags",
      header: "BAGS",
      cell: ({ row }) => num(row.original.bags),
    },
    {
      accessorKey: "net_wt",
      header: "NET WT",
      cell: ({ row }) => num(row.original.net_wt),
      meta: nowrap,
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
      meta: nowrap,
    },
    {
      accessorKey: "cgst",
      header: "2.5%CGST",
      cell: ({ row }) => money(row.original.cgst),
      meta: nowrap,
    },
    {
      accessorKey: "sgst",
      header: "2.5%SGST",
      cell: ({ row }) => money(row.original.sgst),
      meta: nowrap,
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
      meta: nowrap,
    },
    {
      accessorKey: "freight",
      header: "FREIGHT",
      cell: ({ row }) => num(row.original.freight),
      meta: nowrap,
    },
    {
      accessorKey: "party",
      header: "PARTY",
      cell: ({ row }) => row.original.party || "-",
    },
    {
      accessorKey: "fright",
      header: "FRIGHT",
      cell: ({ row }) => money(row.original.fright),
      meta: nowrap,
    },
    {
      accessorKey: "factory",
      header: "FACTORY",
      cell: ({ row }) => row.original.factory || "-",
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <SoyaRowActions
          recordId={row.original.id}
          editHref={`/soya/parties/${row.original.id}/edit`}
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
