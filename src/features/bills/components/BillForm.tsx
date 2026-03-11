"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { billSchema, Bill } from "@/features/bills/schemas";
import { createBillAction, updateBillAction } from "@/app/bills/actions";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

interface BillFormProps {
  initialData?: Bill;
}

type BillFormValues = z.input<typeof billSchema>;

export function BillForm({ initialData }: BillFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!initialData;
  const isGenerateMode = isEditing && searchParams.get("mode") === "generate";
  const [isGenerated, setIsGenerated] = useState(!isGenerateMode);

  const form = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          bill_date: initialData.bill_date,
          net_weight: initialData.net_weight,
          rate: initialData.rate,
          freight: initialData.freight,
          payment_term_days: initialData.payment_term_days,
          source: initialData.source,
        }
      : {
      bill_date: new Date().toISOString().split("T")[0],
      net_weight: 0,
      rate: 0,
      freight: 0,
      payment_term_days: 0,
      source: "app",
    },
  });

  const { watch } = form;
  const billDate = watch("bill_date");
  const netWeight = watch("net_weight");
  const rate = watch("rate");
  const freight = watch("freight");
  const paymentTermDays = watch("payment_term_days");
  const safeNetWeight = netWeight ?? 0;
  const safeRate = rate ?? 0;
  const safeFreight = freight ?? 0;
  const safePaymentTermDays = paymentTermDays ?? 0;

  // Computed preview values
  const amount = safeNetWeight * safeRate;
  const finalAmount = amount - safeFreight;

  let dueDateString = "Invalid Date";
  let printDate = billDate;
  if (billDate) {
    try {
      const parsedDate = parseISO(billDate);
      dueDateString = format(addDays(parsedDate, safePaymentTermDays), "yyyy-MM-dd");
      printDate = format(parsedDate, "dd/MM/yyyy");
    } catch {
      dueDateString = "Invalid Date";
      printDate = billDate;
    }
  }

  async function onSubmit(values: BillFormValues) {
    setIsLoading(true);
    try {
      const payload = billSchema.parse(values);
      if (isEditing && initialData?.id) {
        await updateBillAction(initialData.id, payload);
        if (isGenerateMode && !isGenerated) {
          toast.success("Bill Generated");
          setIsGenerated(true);
          router.replace(`/bills/${initialData.id}/edit`);
        } else {
          toast.success("Bill Updated");
          router.push("/bills");
          router.refresh();
        }
      } else {
        await createBillAction(payload);
        toast.success("Bill Created");
        router.push("/bills");
        router.refresh();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save bill";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  function handlePrintPdf() {
    window.print();
  }

  return (
    <>
      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>{isEditing ? "Edit Bill" : "New Bill"}</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField control={form.control} name="bill_date" render={({ field }) => (
                  <FormItem><FormLabel>Bill Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="net_weight" render={({ field }) => (
                  <FormItem><FormLabel>Net Weight</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="rate" render={({ field }) => (
                  <FormItem><FormLabel>Rate</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="freight" render={({ field }) => (
                  <FormItem><FormLabel>Freight Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="payment_term_days" render={({ field }) => (
                  <FormItem><FormLabel>Payment Terms (Days)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value, 10) || 0)} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>

              <div className="bg-muted p-4 rounded-md mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-muted-foreground block">Amount:</span> {formatCurrencyINR(amount)}</div>
                <div><span className="text-muted-foreground block">Due Date:</span> {dueDateString}</div>
                <div className="font-bold text-lg text-primary md:col-span-2">
                  <span className="text-muted-foreground block text-sm font-normal">Final Amount:</span> {formatCurrencyINR(finalAmount)}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                {isGenerateMode && isGenerated && (
                  <Button type="button" variant="secondary" onClick={handlePrintPdf}>
                    Print PDF
                  </Button>
                )}
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isGenerateMode && !isGenerated ? "Generate Bill" : "Save"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div className="bill-print-root" aria-hidden>
        {[1, 2].map((copy) => (
          <section className="bill-print-copy" key={copy}>
            <header className="bill-print-header">
              <div className="bill-print-title">MB GROUPS</div>
              <div className="bill-print-invoice">
                <div className="bill-print-invoice-label">ESTIMATION INVOICE</div>
                <div className="bill-print-invoice-number">
                  {initialData?.id?.slice(-4).toUpperCase() || "----"}
                </div>
              </div>
            </header>

            <div className="bill-print-meta">
              <div>
                <div className="bill-print-yard">APMC Yard</div>
                <div>Honnali</div>
              </div>
              <div className="bill-print-date">
                <strong>DATE:</strong> {printDate}
              </div>
            </div>

            <table className="bill-print-table">
              <tbody>
                <tr><th>DESCRIPTION</th><th>AMOUNT</th></tr>
                <tr><td>WEIGHT</td><td>{formatNumberIN(safeNetWeight)}</td></tr>
                <tr><td>LESS</td><td>{formatNumberIN(safeFreight)}</td></tr>
                <tr><td>NET WEIGHT</td><td>{formatNumberIN(safeNetWeight)}</td></tr>
                <tr><td>RATE</td><td>{formatCurrencyINR(safeRate)}</td></tr>
                <tr><td>AMOUNT</td><td>{formatCurrencyINR(amount)}</td></tr>
                <tr><td>TOTAL</td><td>{formatCurrencyINR(finalAmount)}</td></tr>
              </tbody>
            </table>

            <footer className="bill-print-footer">
              <span>THANK YOU FOR YOUR BUSINESS!</span>
            </footer>
          </section>
        ))}
      </div>
    </>
  );
}
