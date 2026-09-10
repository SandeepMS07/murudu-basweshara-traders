"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Edit + delete cell shared by both Soya entry tables.
 *
 * Deliberately not the maize createPurchaseColumns actions cell: that one
 * hardcodes the maize print route and gates on useCanEdit(module) against the
 * shared RBAC keys. Soya has no module key — it is admin-only and gated at the
 * page — and no bill-generation flow.
 */
export function SoyaRowActions({
  editHref,
  recordId,
  deleteAction,
}: {
  editHref: string;
  recordId: string;
  deleteAction: (id: string) => Promise<void>;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const confirmDelete = () => {
    startTransition(async () => {
      try {
        await deleteAction(recordId);
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
        <Link href={editHref}>
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
