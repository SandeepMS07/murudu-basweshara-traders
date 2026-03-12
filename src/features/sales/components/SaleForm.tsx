"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createSaleAction, updateSaleAction } from "@/app/sales/actions";
import { saleSchema, Sale } from "@/features/sales/schemas";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

interface SaleFormProps {
  initialData?: Sale;
}

type SaleFormValues = z.input<typeof saleSchema>;

export function SaleForm({ initialData }: SaleFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = Boolean(initialData);

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(saleSchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          sl_no: initialData.sl_no,
          bill_number: initialData.bill_number,
          sale_date: initialData.sale_date,
          lorry_number: initialData.lorry_number,
          party: initialData.party,
          payment_terms: initialData.payment_terms,
          bags: initialData.bags,
          net_weight: initialData.net_weight,
          factory_weight: initialData.factory_weight,
          rate: initialData.rate,
          flight: initialData.flight,
          bag_avg: initialData.bag_avg,
          factory_rate: initialData.factory_rate,
          source: initialData.source,
        }
      : {
          sl_no: null,
          bill_number: "",
          sale_date: new Date().toISOString().split("T")[0],
          lorry_number: "",
          party: "",
          payment_terms: "",
          bags: 0,
          net_weight: 0,
          factory_weight: 0,
          rate: 0,
          flight: 0,
          bag_avg: undefined,
          factory_rate: 0,
          source: "manual",
        },
  });

  const watched = form.watch();
  const computed = useMemo(() => {
    const bags = watched.bags || 0;
    const netWeight = watched.net_weight || 0;
    const rate = watched.rate || 0;
    const flight = watched.flight || 0;
    const factoryRate = watched.factory_rate || 0;
    const amount = netWeight * rate - flight;
    const factoryAmount = netWeight * factoryRate;
    const pendingAmount = amount - factoryAmount;
    const bagAvg = watched.bag_avg ?? (bags > 0 ? netWeight / bags : 0);
    return {
      amount,
      factoryAmount,
      pendingAmount,
      bagAvg,
    };
  }, [watched]);

  const fieldClassName =
    "h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500";

  async function onSubmit(values: SaleFormValues) {
    setIsLoading(true);
    try {
      const payload = saleSchema.parse(values);
      if (isEditing && initialData?.id) {
        await updateSaleAction(initialData.id, payload);
        toast.success("Sale updated");
      } else {
        await createSaleAction(payload);
        toast.success("Sale created");
      }
      router.push("/sales");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save sale");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-6xl gap-0 border border-[#1f2229] bg-[#111214] py-0 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
      <CardHeader className="space-y-0 border-b border-[#252932] bg-[#15171c] py-2.5">
        <CardTitle className="text-lg text-zinc-100">
          {isEditing ? "Update Sale Details" : "New Sale Details"}
        </CardTitle>
        <p className="text-xs text-zinc-500">Fill the required sales fields.</p>
      </CardHeader>
      <CardContent className="pt-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 [&_[data-slot=form-label]]:text-zinc-300">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormField
                control={form.control}
                name="sl_no"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SL No</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value ?? ""}
                        onChange={(event) => field.onChange(event.target.value === "" ? null : Number(event.target.value))}
                        className={fieldClassName}
                        placeholder="Optional"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bill_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill Number</FormLabel>
                    <FormControl>
                      <Input {...field} className={fieldClassName} placeholder="Enter bill number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sale_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} className={fieldClassName} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="party"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Party</FormLabel>
                    <FormControl>
                      <Input {...field} className={fieldClassName} placeholder="Enter party name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lorry_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lorry Number</FormLabel>
                    <FormControl>
                      <Input {...field} className={fieldClassName} placeholder="Enter lorry number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Terms</FormLabel>
                    <FormControl>
                      <Input {...field} className={fieldClassName} placeholder="Ex: 60 Days" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bags</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className={fieldClassName} value={field.value ?? 0} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="net_weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Net Weight</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className={fieldClassName} value={field.value ?? 0} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="factory_weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Factory Weight</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className={fieldClassName} value={field.value ?? 0} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className={fieldClassName} value={field.value ?? 0} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="flight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Flight</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" className={fieldClassName} value={field.value ?? 0} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="factory_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Factory Rate</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.0001" className={fieldClassName} value={field.value ?? 0} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bag_avg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bag Avg (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0001"
                        className={fieldClassName}
                        value={field.value ?? ""}
                        onChange={(event) =>
                          field.onChange(
                            event.target.value === "" ? undefined : parseFloat(event.target.value) || 0
                          )
                        }
                        placeholder={formatNumberIN(computed.bagAvg)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-md border border-[#252932] bg-[#15171c] p-4 text-sm md:grid-cols-4">
              <div>
                <p className="text-zinc-500">Amount</p>
                <p className="font-semibold text-zinc-100">{formatCurrencyINR(computed.amount)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Factory Amount</p>
                <p className="font-semibold text-zinc-100">{formatCurrencyINR(computed.factoryAmount)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Pending</p>
                <p className="font-semibold text-zinc-100">{formatCurrencyINR(computed.pendingAmount)}</p>
              </div>
              <div>
                <p className="text-zinc-500">Bag Avg</p>
                <p className="font-semibold text-zinc-100">{formatNumberIN(computed.bagAvg)}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
