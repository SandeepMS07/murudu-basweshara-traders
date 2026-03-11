"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import { DataTable } from "@/components/shared/DataTable";
import { createPurchaseColumns } from "@/features/purchases/components/Columns";
import { Purchase, PaymentMethod } from "@/features/purchases/schemas";
import { updatePurchasePaymentThroughAction } from "@/app/purchases/actions";
import { toast } from "sonner";

interface PurchasesTableClientProps {
  data: Purchase[];
}

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

  return (
    <DataTable
      columns={columns}
      data={data}
      searchKey="name"
      searchPlaceholder="Filter by name..."
      rowClassName={(row) => {
        const method = paymentMethods[row.original.id] ?? "none";
        if (method === "RTGS") {
          return "bg-emerald-950/20 hover:bg-emerald-950/30";
        }
        if (method === "UPI") {
          return "bg-sky-950/20 hover:bg-sky-950/30";
        }
        return "bg-[#111214] hover:bg-[#17191f]";
      }}
    />
  );
}
