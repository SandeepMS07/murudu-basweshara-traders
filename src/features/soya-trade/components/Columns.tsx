"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { addDays, format, isValid, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import type { SoyaTrade } from "@/features/soya-trade/schemas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteResult = { success: true } | { success: false; message: string };

export type SoyaTradeColumnsConfig = {
  /** e.g. "Purchase" — used in titles, dialogs and toasts. */
  entityLabel: string;
  /** Base path for the edit link, e.g. "/soya/purchases". */
  editHrefBase: string;
  deleteAction: (id: string) => Promise<DeleteResult>;
};

function SoyaTradeActionsCell({
  record,
  config,
}: {
  record: SoyaTrade;
  config: SoyaTradeColumnsConfig;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { entityLabel, editHrefBase, deleteAction } = config;

  const confirmDelete = () => {
    startTransition(async () => {
      try {
        const result = await deleteAction(record.id);
        if (!result.success) {
          toast.error(result.message);
          return;
        }
        toast.success(`${entityLabel} deleted`);
        setConfirmOpen(false);
        router.refresh();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to delete ${entityLabel.toLowerCase()}`,
        );
      }
    });
  };

  return (
    <>
      <div className="flex justify-end gap-1 pr-2">
        <Link href={`${editHrefBase}/${record.id}/edit`}>
          <Button
            variant="ghost"
            size="icon"
            title={`Edit ${entityLabel.toLowerCase()}`}
            className="cursor-pointer"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title={`Delete ${entityLabel.toLowerCase()}`}
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
            <DialogTitle className="text-zinc-100">
              Delete {entityLabel}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete this{" "}
              {entityLabel.toLowerCase()}? This action cannot be undone.
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

export function createSoyaTradeColumns(
  pendingByRecordId: Record<string, number>,
  config: SoyaTradeColumnsConfig,
): ColumnDef<SoyaTrade>[] {
  const parseTermDays = (terms: string | null | undefined) => {
    const parsed = Number.parseInt(String(terms ?? "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  };

  const getDueDate = (sale: SoyaTrade) => {
    const saleDate = parseISO(sale.sale_date);
    if (!isValid(saleDate)) return null;
    return addDays(saleDate, parseTermDays(sale.payment_terms));
  };

  return [
    {
      accessorKey: "bill_number",
      header: "BILL NUM",
    },
    {
      accessorKey: "sale_date",
      header: "DATE",
      cell: ({ row }) => {
        const rawDate = String(row.getValue("sale_date"));
        try {
          return format(parseISO(rawDate), "dd-MM-yyyy");
        } catch {
          return rawDate;
        }
      },
    },
    {
      accessorKey: "lorry_number",
      header: "LORRY NUM",
    },
    {
      accessorKey: "bags",
      header: "BAGS",
      cell: ({ row }) =>
        formatNumberIN(row.original.bags, { maximumFractionDigits: 0 }),
    },
    {
      accessorKey: "net_weight",
      header: "NET WEIGHT",
      cell: ({ row }) =>
        formatNumberIN(row.original.net_weight, { maximumFractionDigits: 0 }),
    },
    {
      accessorKey: "factory_weight",
      header: "FACTORY",
      cell: ({ row }) =>
        formatNumberIN(row.original.factory_weight, { maximumFractionDigits: 0 }),
    },
    {
      accessorKey: "rate",
      header: "RATE",
      cell: ({ row }) => formatNumberIN(row.original.rate, { maximumFractionDigits: 2 }),
    },
    {
      accessorKey: "flight",
      header: "FLIGHT",
      cell: ({ row }) =>
        formatNumberIN(row.original.flight, { maximumFractionDigits: 0 }),
    },
    {
      accessorKey: "amount",
      header: "AMOUNT",
      cell: ({ row }) =>
        formatCurrencyINR(row.original.amount, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }),
    },
    {
      accessorKey: "party",
      header: "PARTY",
    },
    {
      accessorKey: "payment_terms",
      header: "PAYMENT",
      cell: ({ row }) => row.original.payment_terms || "-",
    },
    {
      accessorKey: "pending_amount",
      header: "PENDING",
      cell: ({ row }) =>
        formatCurrencyINR(
          Math.max(
            pendingByRecordId[row.original.id] ?? row.original.pending_amount,
            0,
          ),
          { minimumFractionDigits: 0, maximumFractionDigits: 0 }
        ),
      meta: {
        width: "170px",
        headClassName: "whitespace-nowrap",
        cellClassName: "whitespace-nowrap",
      },
    },
    {
      id: "due_date",
      header: "DUE DATE",
      cell: ({ row }) => {
        const dueDate = getDueDate(row.original);
        if (!dueDate) return "-";
        return format(dueDate, "dd-MM-yyyy");
      },
      meta: {
        width: "170px",
        headClassName: "whitespace-nowrap",
        cellClassName: "whitespace-nowrap pr-10",
      },
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <SoyaTradeActionsCell record={row.original} config={config} />
      ),
      meta: {
        sticky: true,
        right: "0",
        zIndex: 30,
        width: "136px",
        headClassName: "whitespace-nowrap text-right pr-4 bg-[#15171c] border-l border-[#252932]",
        cellClassName: "text-right bg-[#111214] border-l border-[#252932]",
        boxShadow: "-8px 0 18px rgba(6, 8, 13, 0.45)",
      },
    },
  ];
}
