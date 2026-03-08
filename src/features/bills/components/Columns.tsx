"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Bill } from "@/features/bills/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type BillTableRow = Bill & {
  bill_for: string;
  status: "done";
  purchase_id?: string;
};

function BillPreviewCell({ bill }: { bill: BillTableRow }) {
  const [open, setOpen] = useState(false);
  const previewUrl = bill.purchase_id
    ? `/bills/${bill.id}/print?pid=${bill.purchase_id}&preview=1`
    : `/bills/${bill.id}/print?preview=1`;

  return (
    <>
      <Button variant="ghost" size="icon" title="View Bill" onClick={() => setOpen(true)}>
        <Eye className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>Bill Preview</DialogTitle>
          </DialogHeader>
          <div className="overflow-hidden rounded-md border bg-muted/20">
            <iframe
              src={previewUrl}
              title={`Bill preview ${bill.id}`}
              className="h-[75vh] w-full bg-white"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const billColumns: ColumnDef<BillTableRow>[] = [
  {
    accessorKey: "bill_for",
    header: "Bill For",
  },
  {
    accessorKey: "due_date",
    header: "Due Date",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      return (
        <Badge variant="default">
          {String(row.getValue("status")).toUpperCase()}
        </Badge>
      );
    },
  },
  {
    id: "view_bill",
    header: "View Bill",
    cell: ({ row }) => {
      const bill = row.original;

      return (
        <div className="pr-4">
          <BillPreviewCell bill={bill} />
        </div>
      );
    },
  },
];
