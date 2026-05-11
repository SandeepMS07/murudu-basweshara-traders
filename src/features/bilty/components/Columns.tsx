"use client";

import { type ColumnDef } from "@tanstack/react-table";
import {
  createPurchaseColumns,
  type PurchaseColumnOptions,
} from "@/features/purchases/components/Columns";
import { type Bilty } from "@/features/bilty/schemas";
import {
  deleteBiltyAction,
  generateBillFromBiltyAction,
} from "@/app/bilty/actions";

export function createBiltyColumns(
  options: PurchaseColumnOptions,
): ColumnDef<Bilty>[] {
  return createPurchaseColumns({
    ...options,
    nameHeaderLabel: "PARTY",
    nameAccessorKey: "party",
    showPlaceColumn: false,
    showMobColumn: false,
    showBagLessColumn: false,
    editHrefBase: "/bilty",
    deleteAction: deleteBiltyAction,
    generateBillAction: generateBillFromBiltyAction,
    deleteSuccessMessage: "Bilty deleted",
    deleteErrorMessage: "Failed to delete bilty",
    generateBillSuccessMessage: "Bill generated from bilty",
    generateBillErrorMessage: "Failed to generate bilty bill",
    deleteDialogTitle: "Delete Bilty",
    deleteDialogDescription:
      "Are you sure you want to delete this bilty? This action cannot be undone.",
    generateBillDialogTitle: "Generate Bill",
    generateBillDialogDescription:
      "Preview the invoice below, then click Generate Bill.",
    billIdPrefix: "BILTY_BILL_",
  }) as unknown as ColumnDef<Bilty>[];
}
