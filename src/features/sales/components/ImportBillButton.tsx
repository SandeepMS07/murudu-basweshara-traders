"use client";

import { useRef, useState, useTransition } from "react";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { importSalesFromBillAction } from "@/app/sales/actions";

export function ImportBillButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const onImport = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Please choose an XLSX file");
      return;
    }

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        const result = await importSalesFromBillAction(formData);
        toast.success(
          `Import complete: inserted ${result.inserted}, updated ${result.updated}, skipped ${result.skipped}, failed ${result.failed}`
        );
        if (result.errors.length > 0) {
          toast.warning("Some rows failed. Check server logs or retry.");
        }
        setOpen(false);
        if (fileRef.current) {
          fileRef.current.value = "";
        }
        setFileName("");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Import failed");
      }
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="border-[#2a2d34] bg-[#17191f] text-zinc-100 hover:bg-[#1d2026]"
      >
        <Upload className="mr-2 h-4 w-4" />
        Import BILL
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Import BILL Sheet</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Upload workbook to import BILL rows and sync buyer companies from COMPANY tab.
            </DialogDescription>
          </DialogHeader>
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-[#3a3d44] bg-[#1b1e24] p-4 text-sm text-zinc-300">
            <FileSpreadsheet className="h-5 w-5 text-zinc-400" />
            <span className="truncate">{fileName || "Choose purchage.xlsx"}</span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
            />
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onImport}
              disabled={isPending}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
