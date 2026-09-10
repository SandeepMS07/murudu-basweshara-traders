"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import type { Bilty, PaymentMethod } from "@/features/bilty/schemas";

/**
 * Soya Factory columns.
 *
 * Deliberately NOT built on createPurchaseColumns, which the maize bilty table
 * reuses: that helper hardcodes the maize print route (/bills/:id/print) and
 * gates its actions on useCanEdit(module) against the shared RBAC module keys.
 * Soya has neither a bill-generation flow (see supabase/soya-factory.sql) nor a
 * module key — it is admin-only and gated at the page — so it gets its own
 * definition with just Edit and Delete.
 */
export interface SoyaFactoryColumnOptions {
  paymentMethodById: Record<string, PaymentMethod>;
  paymentDateById: Record<string, string | null>;
  onPaymentMethodChange: (id: string, method: PaymentMethod) => void;
  onPaymentDateChange: (id: string, date: string | null) => void;
  deleteAction: (id: string) => Promise<void>;
}

const paymentSelectOptions: { label: string; value: PaymentMethod }[] = [
  { label: "RTGS", value: "RTGS" },
  { label: "UPI", value: "UPI" },
  { label: "Cash", value: "CASH" },
  { label: "None", value: "none" },
];

const wholeNumber = {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
} as const;

function SoyaFactoryActionsCell({
  record,
  deleteAction,
}: {
  record: Bilty;
  deleteAction: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const confirmDelete = () => {
    startTransition(async () => {
      try {
        await deleteAction(record.id);
        toast.success("Entry deleted");
        setConfirmOpen(false);
        router.refresh();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete entry",
        );
      }
    });
  };

  return (
    <>
      <div className="flex justify-end gap-1 pr-2">
        <Link href={`/soya/factory/${record.id}/edit`}>
          <Button
            variant="ghost"
            size="icon"
            title="Edit entry"
            className="cursor-pointer"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Delete entry"
          disabled={isPending}
          onClick={() => setConfirmOpen(true)}
          className="cursor-pointer"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          showCloseButton={false}
          className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        >
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Delete Entry</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete this entry? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-4 -mb-4 rounded-b-xl border-t border-[#2a2d34] bg-[#15171c] p-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirmOpen(false)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={confirmDelete}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function createSoyaFactoryColumns(
  options: SoyaFactoryColumnOptions,
): ColumnDef<Bilty>[] {
  const {
    paymentMethodById,
    paymentDateById,
    onPaymentMethodChange,
    onPaymentDateChange,
    deleteAction,
  } = options;

  return [
    {
      id: "bill_no",
      header: "BILL NO",
      cell: ({ row }) => row.original.bill_no || "-",
    },
    {
      accessorKey: "party",
      header: "PARTY",
    },
    {
      accessorKey: "date",
      header: "DATE",
      cell: ({ row }) => {
        const rawDate = String(row.getValue("date"));
        try {
          return format(parseISO(rawDate), "dd-MM-yyyy");
        } catch {
          return rawDate;
        }
      },
    },
    {
      accessorKey: "bags",
      header: "BAGS",
      cell: ({ row }) => formatNumberIN(Number(row.getValue("bags")), wholeNumber),
    },
    {
      accessorKey: "weight",
      header: "WEIGHT",
      cell: ({ row }) =>
        formatNumberIN(Number(row.getValue("weight")), wholeNumber),
    },
    {
      accessorKey: "less_weight",
      header: "LESS",
      cell: ({ row }) =>
        formatNumberIN(Number(row.getValue("less_weight")), wholeNumber),
    },
    {
      accessorKey: "net_weight",
      header: "NET WEIGHT",
      cell: ({ row }) =>
        formatNumberIN(Number(row.getValue("net_weight")), wholeNumber),
    },
    {
      accessorKey: "rate",
      header: "RATE",
      cell: ({ row }) =>
        formatCurrencyINR(Number(row.getValue("rate")), {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }),
    },
    {
      accessorKey: "amount",
      header: "AMOUNT",
      cell: ({ row }) =>
        formatCurrencyINR(Number(row.getValue("amount")), wholeNumber),
    },
    {
      accessorKey: "add_amount",
      header: "ADD",
      cell: ({ row }) =>
        formatCurrencyINR(Number(row.getValue("add_amount")), wholeNumber),
    },
    {
      accessorKey: "cash_paid",
      header: "CASH",
      cell: ({ row }) =>
        formatCurrencyINR(Number(row.getValue("cash_paid")), wholeNumber),
    },
    {
      accessorKey: "upi_paid",
      header: "PHONE PAY",
      cell: ({ row }) =>
        formatCurrencyINR(Number(row.getValue("upi_paid")), wholeNumber),
    },
    {
      accessorKey: "final_total",
      header: "TOTAL AMOUNT",
      cell: ({ row }) => (
        <div className="font-medium">
          {formatCurrencyINR(Number(row.getValue("final_total")), wholeNumber)}
        </div>
      ),
    },
    {
      id: "payment_through",
      header: "PAYMENT THROUGH",
      cell: ({ row }) => {
        const id = row.original.id;
        const current = paymentMethodById[id] ?? "none";
        return (
          <select
            value={current}
            onChange={(event) =>
              onPaymentMethodChange(id, event.target.value as PaymentMethod)
            }
            className="w-full cursor-pointer rounded border border-[#2a2d34] bg-[#17191f] px-2 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-300"
          >
            {paymentSelectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      id: "payment_date",
      header: "PAYMENT DATE",
      cell: ({ row }) => {
        const id = row.original.id;
        const method = paymentMethodById[id] ?? "none";
        const paymentDate = paymentDateById[id] ?? null;
        return (
          <input
            type="date"
            value={paymentDate ?? ""}
            disabled={method === "none"}
            onChange={(event) =>
              onPaymentDateChange(
                id,
                event.target.value ? event.target.value : null,
              )
            }
            className="w-full cursor-pointer rounded border border-[#2a2d34] bg-[#17191f] px-2 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          />
        );
      },
    },
    {
      accessorKey: "bag_avg",
      header: "BAG AVG",
      cell: ({ row }) =>
        formatNumberIN(Number(row.getValue("bag_avg")), wholeNumber),
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <SoyaFactoryActionsCell
          record={row.original}
          deleteAction={deleteAction}
        />
      ),
      meta: {
        sticky: true,
        right: "0px",
        zIndex: 30,
        width: "132px",
        headClassName: "bg-[#15171c] border-l border-[#252932]",
        cellClassName: "bg-[#111214] border-l border-[#252932]",
        boxShadow: "-8px 0 12px rgba(0, 0, 0, 0.45)",
      },
    },
  ];
}
