"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { createPurchaseColumns } from "@/features/purchases/components/Columns";
import { Purchase, PaymentMethod } from "@/features/purchases/schemas";
import { updatePurchasePaymentThroughAction } from "@/app/purchases/actions";
import { toast } from "sonner";
import { formatCurrencyINR } from "@/lib/number-format";

interface PurchasesTableClientProps {
  data: Purchase[];
}

const paymentRowStyles: Record<PaymentMethod, string> = {
  RTGS: "bg-[#251810]/45 hover:bg-[#2f1d13]/55",
  UPI: "bg-[#121d33]/45 hover:bg-[#162444]/55",
  none: "bg-[#111214] hover:bg-[#17191f]",
};

const paymentBadgeStyles: Record<PaymentMethod, string> = {
  RTGS: "border-[#ff8f6b]/40 bg-[#ff8f6b]/12 text-[#ffb295]",
  UPI: "border-[#3b82f6]/45 bg-[#1d4ed8]/18 text-[#93c5fd]",
  none: "border-[#4b5563]/45 bg-[#2a2f3a]/40 text-[#d1d5db]",
};

export function PurchasesTableClient({ data }: PurchasesTableClientProps) {
  const [, startTransition] = useTransition();
  const [paymentMethods, setPaymentMethods] = useState<
    Record<string, PaymentMethod>
  >({});

  useEffect(() => {
    setPaymentMethods(
      Object.fromEntries(
        data.map((purchase) => [
          purchase.id,
          purchase.payment_through ?? "none",
        ])
      ) as Record<string, PaymentMethod>
    );
  }, [data]);

  const handlePaymentMethodChange = useCallback(
    (purchaseId: string, method: PaymentMethod) => {
      const previous = paymentMethods[purchaseId] ?? "none";

      setPaymentMethods((current) => ({
        ...current,
        [purchaseId]: method,
      }));

      startTransition(async () => {
        try {
          await updatePurchasePaymentThroughAction(purchaseId, method);
        } catch (error: unknown) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to save payment method";
          toast.error(message);
          setPaymentMethods((current) => ({
            ...current,
            [purchaseId]: previous,
          }));
        }
      });
    },
    [paymentMethods, startTransition]
  );

  const columns = useMemo(
    () =>
      createPurchaseColumns({
        paymentMethodById: paymentMethods,
        onPaymentMethodChange: handlePaymentMethodChange,
      }),
    [paymentMethods, handlePaymentMethodChange]
  );

  const paymentLegend = useMemo(() => {
    const summary: Record<PaymentMethod, { count: number; amount: number }> = {
      RTGS: { count: 0, amount: 0 },
      UPI: { count: 0, amount: 0 },
      none: { count: 0, amount: 0 },
    };

    data.forEach((purchase) => {
      const method = paymentMethods[purchase.id] ?? "none";
      summary[method].count += 1;
      summary[method].amount += purchase.final_total;
    });

    return summary;
  }, [data, paymentMethods]);

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Filter by name..."
      toolbarRight={
        <div className="w-full p-0 xl:ml-auto xl:flex xl:justify-end">
          <div className="flex gap-2 overflow-x-auto pb-1 xl:flex-wrap xl:overflow-visible xl:pb-0">
            {(["RTGS", "UPI", "none"] as const).map((method) => (
              <div
                key={method}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${paymentBadgeStyles[method]}`}
              >
                <span className="font-semibold">{method === "none" ? "None" : method}</span>
                <span className="text-zinc-300/90">• {paymentLegend[method].count}</span>
                <span className="hidden text-zinc-200/90 md:inline">
                  {formatCurrencyINR(paymentLegend[method].amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      }
      rowClassName={(row) => {
        const method = paymentMethods[row.original.id] ?? "none";
        return paymentRowStyles[method];
      }}
    />
  );
}
