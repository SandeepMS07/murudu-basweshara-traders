"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { formatCurrencyINR } from "@/lib/number-format";
import { type Bilty, type PaymentMethod } from "@/features/bilty/schemas";
import { createSoyaFactoryColumns } from "@/features/soya-factory/components/Columns";
import {
  deleteSoyaFactoryRecordAction,
  updateSoyaFactoryPaymentThroughAction,
} from "@/app/soya/factory/actions";

interface SoyaFactoryTableClientProps {
  data: Bilty[];
  addHref?: string;
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

export function SoyaFactoryTableClient({
  data,
  addHref = "/soya/factory/add",
}: SoyaFactoryTableClientProps) {
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
        data.map((record) => [
          record.id,
          paymentMethodOverrides[record.id] ?? record.payment_through ?? "none",
        ]),
      ) as Record<string, PaymentMethod>,
    [data, paymentMethodOverrides],
  );

  const paymentDates = useMemo(
    () =>
      Object.fromEntries(
        data.map((record) => [
          record.id,
          paymentDateOverrides[record.id] ?? record.payment_date ?? null,
        ]),
      ) as Record<string, string | null>,
    [data, paymentDateOverrides],
  );

  // Both handlers write optimistically and roll the local override back if the
  // server action rejects, so the select never shows an unsaved value.
  const handlePaymentMethodChange = useCallback(
    (recordId: string, method: PaymentMethod) => {
      const previous = paymentMethods[recordId] ?? "none";
      const previousDate = paymentDates[recordId] ?? null;
      const nextDate =
        method === "none"
          ? null
          : (previousDate ?? new Date().toISOString().split("T")[0]);

      setPaymentMethodOverrides((current) => ({
        ...current,
        [recordId]: method,
      }));
      setPaymentDateOverrides((current) => ({
        ...current,
        [recordId]: nextDate,
      }));

      startTransition(async () => {
        try {
          await updateSoyaFactoryPaymentThroughAction(
            recordId,
            method,
            nextDate,
          );
        } catch (error: unknown) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to save payment method",
          );
          setPaymentMethodOverrides((current) => ({
            ...current,
            [recordId]: previous,
          }));
          setPaymentDateOverrides((current) => ({
            ...current,
            [recordId]: previousDate,
          }));
        }
      });
    },
    [paymentDates, paymentMethods, startTransition],
  );

  const handlePaymentDateChange = useCallback(
    (recordId: string, paymentDate: string | null) => {
      const currentMethod = paymentMethods[recordId] ?? "none";
      if (currentMethod === "none") return;
      const previousDate = paymentDates[recordId] ?? null;

      setPaymentDateOverrides((current) => ({
        ...current,
        [recordId]: paymentDate,
      }));

      startTransition(async () => {
        try {
          await updateSoyaFactoryPaymentThroughAction(
            recordId,
            currentMethod,
            paymentDate,
          );
        } catch (error: unknown) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Failed to save payment date",
          );
          setPaymentDateOverrides((current) => ({
            ...current,
            [recordId]: previousDate,
          }));
        }
      });
    },
    [paymentDates, paymentMethods, startTransition],
  );

  const columns = useMemo(
    () =>
      createSoyaFactoryColumns({
        paymentMethodById: paymentMethods,
        paymentDateById: paymentDates,
        onPaymentMethodChange: handlePaymentMethodChange,
        onPaymentDateChange: handlePaymentDateChange,
        deleteAction: deleteSoyaFactoryRecordAction,
      }),
    [
      paymentDates,
      paymentMethods,
      handlePaymentMethodChange,
      handlePaymentDateChange,
    ],
  );

  const paymentLegend = useMemo(() => {
    const summary: Record<PaymentMethod, { count: number; amount: number }> = {
      RTGS: { count: 0, amount: 0 },
      UPI: { count: 0, amount: 0 },
      CASH: { count: 0, amount: 0 },
      none: { count: 0, amount: 0 },
    };

    data.forEach((record) => {
      const method =
        paymentMethods[record.id] ?? record.payment_through ?? "none";
      summary[method].count += 1;
      summary[method].amount += record.final_total;
    });

    return summary;
  }, [data, paymentMethods]);

  return (
    <DataTable
      columns={columns}
      data={data}
      exportFileName="soya_factory"
      disablePagination
      scrollContainerClassName="max-h-[70vh]"
      searchKey="party"
      searchPlaceholder="Filter by party..."
      searchPredicate={(record, query) => {
        const row = record as Bilty;
        const normalizedParty = (row.party || row.name || "").toLowerCase();
        return normalizedParty.includes(query);
      }}
      toolbarRight={null}
      toolbarBelow={
        <div className="flex w-full">
          <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible xl:pb-0">
            {(["RTGS", "UPI", "CASH", "none"] as const).map((method) => (
              <div
                key={method}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${paymentBadgeStyles[method]}`}
              >
                <span className="font-semibold">
                  {method === "none" ? "None" : method}
                </span>
                <span className="text-zinc-300/90">
                  • {paymentLegend[method].count}
                </span>
                <span className="hidden text-zinc-200/90 md:inline">
                  {formatCurrencyINR(paymentLegend[method].amount, {
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      }
      toolbarFarRight={
        addHref ? (
          <Link href={addHref} className="w-full sm:w-auto">
            <Button className="h-10 w-full border border-[#2a2d34] bg-[#17191f] px-4 text-zinc-100 hover:bg-[#1d2026] sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </Link>
        ) : null
      }
      rowClassName={(row) => {
        const method = paymentMethods[row.original.id] ?? "none";
        return paymentRowStyles[method];
      }}
    />
  );
}
