"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ReactNode } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { createPurchaseColumns } from "@/features/purchases/components/Columns";
import { Purchase, PaymentMethod } from "@/features/purchases/schemas";
import { updatePurchasePaymentThroughAction } from "@/app/purchases/actions";
import { toast } from "sonner";
import { formatCurrencyINR } from "@/lib/number-format";
import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/features/auth/components/AuthProvider";

interface PurchasesTableClientProps {
  data: Purchase[];
  fyControl?: ReactNode;
  addHref?: string;
  addButtonLabel?: string;
  exportFileName?: string;
  columnsFactory?: typeof createPurchaseColumns;
  updatePaymentThroughAction?: typeof updatePurchasePaymentThroughAction;
}

const paymentRowStyles: Record<PaymentMethod, string> = {
  RTGS: "bg-[#251810]/45 text-[#ffd7c7] hover:bg-[#2f1d13]/55",
  UPI: "bg-[#121d33]/45 text-[#c7d7ff] hover:bg-[#162444]/55",
  CASH: "bg-[#1f1710]/45 text-[#f2d5b5] hover:bg-[#281c12]/55",
  none: "bg-[#111214] text-zinc-200 hover:bg-[#17191f]",
};

const paymentBadgeStyles: Record<PaymentMethod, string> = {
  RTGS: "border-[#ff8f6b]/40 bg-[#ff8f6b]/12 text-[#ffb295]",
  UPI: "border-[#3b82f6]/45 bg-[#1d4ed8]/18 text-[#93c5fd]",
  CASH: "border-[#f59e0b]/45 bg-[#b45309]/15 text-[#fcd34d]",
  none: "border-[#4b5563]/45 bg-[#2a2f3a]/40 text-[#d1d5db]",
};

export function PurchasesTableClient({
  data,
  fyControl,
  addHref,
  addButtonLabel = "Add Purchase",
  exportFileName = "purchases",
  columnsFactory = createPurchaseColumns,
  updatePaymentThroughAction = updatePurchasePaymentThroughAction,
}: PurchasesTableClientProps) {
  const canEdit = useCanEdit("purchases");
  const [, startTransition] = useTransition();
  const [paymentMethodOverrides, setPaymentMethodOverrides] = useState<
    Record<string, PaymentMethod>
  >({});
  const [paymentDateOverrides, setPaymentDateOverrides] = useState<
    Record<string, string | null>
  >({});

  const paymentMethods = useMemo(
    () =>
      Object.fromEntries(
        data.map((purchase) => [
          purchase.id,
          paymentMethodOverrides[purchase.id] ?? purchase.payment_through ?? "none",
        ])
      ) as Record<string, PaymentMethod>,
    [data, paymentMethodOverrides]
  );

  const paymentDates = useMemo(
    () =>
      Object.fromEntries(
        data.map((purchase) => [
          purchase.id,
          paymentDateOverrides[purchase.id] ?? purchase.payment_date ?? null,
        ])
      ) as Record<string, string | null>,
    [data, paymentDateOverrides]
  );

  const handlePaymentMethodChange = useCallback(
    (purchaseId: string, method: PaymentMethod) => {
      const previous = paymentMethods[purchaseId] ?? "none";
      const previousDate = paymentDates[purchaseId] ?? null;
      const nextDate =
        method === "none"
          ? null
          : previousDate ?? new Date().toISOString().split("T")[0];

      setPaymentMethodOverrides((current) => ({
        ...current,
        [purchaseId]: method,
      }));
      setPaymentDateOverrides((current) => ({
        ...current,
        [purchaseId]: nextDate,
      }));

      startTransition(async () => {
        try {
          await updatePaymentThroughAction(purchaseId, method, nextDate);
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to save payment method";
          toast.error(message);
          setPaymentMethodOverrides((current) => ({
            ...current,
            [purchaseId]: previous,
          }));
          setPaymentDateOverrides((current) => ({
            ...current,
            [purchaseId]: previousDate,
          }));
        }
      });
    },
    [paymentDates, paymentMethods, startTransition, updatePaymentThroughAction]
  );

  const handlePaymentDateChange = useCallback(
    (purchaseId: string, paymentDate: string | null) => {
      const currentMethod = paymentMethods[purchaseId] ?? "none";
      if (currentMethod === "none") return;
      const previousDate = paymentDates[purchaseId] ?? null;

      setPaymentDateOverrides((current) => ({
        ...current,
        [purchaseId]: paymentDate,
      }));

      startTransition(async () => {
        try {
          await updatePaymentThroughAction(
            purchaseId,
            currentMethod,
            paymentDate
          );
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to save payment date";
          toast.error(message);
          setPaymentDateOverrides((current) => ({
            ...current,
            [purchaseId]: previousDate,
          }));
        }
      });
    },
    [paymentDates, paymentMethods, startTransition, updatePaymentThroughAction]
  );

  const columns = useMemo(
    () =>
      columnsFactory({
        paymentMethodById: paymentMethods,
        paymentDateById: paymentDates,
        onPaymentMethodChange: handlePaymentMethodChange,
        onPaymentDateChange: handlePaymentDateChange,
      }),
    [
      paymentDates,
      paymentMethods,
      handlePaymentMethodChange,
      handlePaymentDateChange,
      columnsFactory,
    ]
  );

  const paymentLegend = useMemo(() => {
    const summary: Record<PaymentMethod, { count: number; amount: number }> = {
      RTGS: { count: 0, amount: 0 },
      UPI: { count: 0, amount: 0 },
      CASH: { count: 0, amount: 0 },
      none: { count: 0, amount: 0 },
    };

    data.forEach((purchase) => {
      const method = paymentMethods[purchase.id] ?? purchase.payment_through ?? "none";
      summary[method].count += 1;
      summary[method].amount += purchase.final_total;
    });

    return summary;
  }, [data, paymentMethods]);

  return (
    <DataTable
      columns={columns}
      data={data}
      exportFileName={exportFileName}
      disablePagination
      scrollContainerClassName="max-h-[70vh]"
      searchKey="name"
      searchPlaceholder="Filter by name or phone..."
      searchPredicate={(purchase, query) => {
        const normalizedName = (purchase.name || "").toLowerCase();
        const normalizedPhone = (purchase.mob || "").replace(/\D/g, "");
        const queryDigits = query.replace(/\D/g, "");

        return (
          normalizedName.includes(query) ||
          (!!queryDigits && normalizedPhone.includes(queryDigits))
        );
      }}
      toolbarRight={null}
      toolbarBelow={
        <div className="flex w-full items-start justify-between gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible xl:pb-0">
            {(["RTGS", "UPI", "CASH", "none"] as const).map((method) => (
              <div
                key={method}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${paymentBadgeStyles[method]}`}
              >
                <span className="font-semibold">{method === "none" ? "None" : method}</span>
                <span className="text-zinc-300/90">• {paymentLegend[method].count}</span>
                <span className="hidden text-zinc-200/90 md:inline">
                  {formatCurrencyINR(paymentLegend[method].amount, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            ))}
          </div>
          {fyControl ? <div className="shrink-0">{fyControl}</div> : null}
        </div>
      }
      toolbarFarRight={
        <div className="flex w-full flex-col items-stretch gap-2 sm:items-end">
          {addHref && canEdit ? (
            <Link href={addHref} className="w-full sm:w-auto">
              <Button className="h-10 w-full border border-[#2a2d34] bg-[#17191f] px-4 text-zinc-100 hover:bg-[#1d2026] sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                {addButtonLabel}
              </Button>
            </Link>
          ) : null}
        </div>
      }
      rowClassName={(row) => {
        const method = paymentMethods[row.original.id] ?? "none";
        return paymentRowStyles[method];
      }}
    />
  );
}
