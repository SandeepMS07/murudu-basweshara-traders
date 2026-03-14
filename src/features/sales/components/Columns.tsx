"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Edit, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { Sale } from "@/features/sales/schemas";
import { deleteSaleAction } from "@/app/sales/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function SaleActionsCell({
  sale,
}: {
  sale: Sale;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const confirmDelete = () => {
    startTransition(async () => {
      try {
        const result = await deleteSaleAction(sale.id);
        if (!result.success) {
          toast.error(result.message);
          return;
        }
        toast.success("Sale deleted");
        setConfirmOpen(false);
        router.refresh();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Failed to delete sale";
        toast.error(message);
      }
    });
  };

  return (
    <>
      <div className="flex justify-end gap-1 pr-2">
        <Link href={`/sales/${sale.id}/edit`}>
          <Button variant="ghost" size="icon" title="Edit sale">
            <Edit className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Delete sale"
          disabled={isPending}
          onClick={() => setConfirmOpen(true)}
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
            <DialogTitle className="text-zinc-100">Delete Sale</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete this sale? This action cannot be undone.
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

export function createSaleColumns(): ColumnDef<Sale>[] {
  return [
    {
      accessorKey: "sl_no",
      header: "SL NO",
      cell: ({ row }) => row.original.sl_no ?? "-",
    },
    {
      accessorKey: "bill_number",
      header: "BILL NUM",
    },
    {
      accessorKey: "sale_date",
      header: "DATE",
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
      cell: ({ row }) => formatNumberIN(row.original.net_weight),
    },
    {
      accessorKey: "factory_weight",
      header: "FACTORY",
      cell: ({ row }) => formatNumberIN(row.original.factory_weight),
    },
    {
      accessorKey: "rate",
      header: "RATE",
      cell: ({ row }) => formatNumberIN(row.original.rate),
    },
    {
      accessorKey: "flight",
      header: "FLIGHT",
      cell: ({ row }) => formatNumberIN(row.original.flight),
    },
    {
      accessorKey: "amount",
      header: "AMOUNT",
      cell: ({ row }) => formatCurrencyINR(row.original.amount),
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
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <SaleActionsCell sale={row.original} />
      ),
      meta: {
        sticky: true,
        right: "0",
        zIndex: 4,
        width: "172px",
        headClassName: "text-right pr-4",
        cellClassName: "text-right",
        boxShadow: "-8px 0 18px rgba(6, 8, 13, 0.45)",
      },
    },
  ];
}
