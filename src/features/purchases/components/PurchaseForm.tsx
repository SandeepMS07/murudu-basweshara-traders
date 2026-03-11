"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  purchaseSchema,
  Purchase,
} from "@/features/purchases/schemas";
import {
  createPurchaseAction,
  updatePurchaseAction,
} from "@/app/purchases/actions";

interface PurchaseFormProps {
  initialData?: Purchase;
}
type PurchaseFormValues = z.input<typeof purchaseSchema>;

const countryOptions = [
  { label: "India (+91)", code: "+91" },
  { label: "United States (+1)", code: "+1" },
  { label: "United Kingdom (+44)", code: "+44" },
  { label: "UAE (+971)", code: "+971" },
  { label: "Saudi Arabia (+966)", code: "+966" },
  { label: "Singapore (+65)", code: "+65" },
];

function splitMobileNumber(input: string | undefined): {
  countryCode: string;
  mobile: string;
} {
  if (!input) return { countryCode: "+91", mobile: "" };
  const raw = input.trim();
  if (!raw) return { countryCode: "+91", mobile: "" };

  const onlyDigits = raw.replace(/\D/g, "");
  if (!raw.startsWith("+")) {
    return { countryCode: "+91", mobile: onlyDigits };
  }

  const matchedCountry = [...countryOptions]
    .sort((a, b) => b.code.length - a.code.length)
    .find((option) => raw.startsWith(option.code));

  if (!matchedCountry) {
    return { countryCode: "+91", mobile: onlyDigits };
  }

  const mobilePart = raw.slice(matchedCountry.code.length).replace(/\D/g, "");
  return { countryCode: matchedCountry.code, mobile: mobilePart };
}

export function PurchaseForm({ initialData }: PurchaseFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!initialData;
  const initialMobile = splitMobileNumber(initialData?.mob);
  const [countryCode, setCountryCode] = useState(initialMobile.countryCode);
  const [mobileNumber, setMobileNumber] = useState(initialMobile.mobile);

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          date: initialData.date,
          name: initialData.name,
          place: initialData.place,
          mob: initialData.mob,
          bags: initialData.bags,
          weight: initialData.weight,
          less_percent: initialData.less_percent,
          rate: initialData.rate,
          bag_less: initialData.bag_less,
          add_amount: initialData.add_amount,
          cash_paid: initialData.cash_paid,
          upi_paid: initialData.upi_paid,
          source: initialData.source,
        }
      : {
      date: new Date().toISOString().split("T")[0],
      name: "",
      place: "",
      mob: "",
      bags: 0,
      weight: 0,
      less_percent: 3,
      rate: 0,
      bag_less: 0,
      add_amount: 0,
      cash_paid: 0,
      upi_paid: 0,
      source: "app",
    },
  });

  const { watch } = form;
  const weight = watch("weight");
  const bags = watch("bags");
  const lessPercent = watch("less_percent");
  const rate = watch("rate");
  const bagLess = watch("bag_less");
  const addAmount = watch("add_amount");
  const cashPaid = watch("cash_paid");
  const upiPaid = watch("upi_paid");

  // Computed preview values
  const lessWeight = ((weight || 0) * (lessPercent || 0)) / 100;
  const netWeight = (weight || 0) - lessWeight;
  const amount = netWeight * (rate || 0);
  const finalTotal =
    amount -
    (bagLess || 0) +
    (addAmount || 0) -
    (cashPaid || 0) -
    (upiPaid || 0);
  const bagAvg = (bags || 0) > 0 ? netWeight / (bags || 1) : 0;
  const fieldClassName =
    "h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500";

  async function onSubmit(values: PurchaseFormValues) {
    setIsLoading(true);
    try {
      const digits = mobileNumber.replace(/\D/g, "");
      const normalizedMob = digits ? `${countryCode}${digits}` : "";
      const payload = purchaseSchema.parse({ ...values, mob: normalizedMob });

      if (isEditing && initialData?.id) {
        await updatePurchaseAction(initialData.id, payload);
        toast.success("Purchase Updated");
      } else {
        await createPurchaseAction(payload);
        toast.success("Purchase Created");
      }
      router.push("/purchases");
      router.refresh();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save purchase";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-6xl gap-0 py-0 border border-[#1f2229] bg-[#111214] text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
      <CardHeader className="space-y-0 border-b border-[#252932] bg-[#15171c] py-2.5">
        <CardTitle className="text-lg text-zinc-100">
          {isEditing ? "Update Purchase Details" : "New Purchase Details"}
        </CardTitle>
        <p className="text-xs text-zinc-500">Fill the required fields.</p>
      </CardHeader>
      <CardContent className="pt-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 [&_[data-slot=form-label]]:text-zinc-300">
            <section className="space-y-2 rounded-lg border border-[#252932] bg-[#15171c] p-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Party Information
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        placeholder="Select date"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter name"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="place"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Place</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter place"
                        className={fieldClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mob"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mob</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Select
                          value={countryCode}
                          onValueChange={(value) => setCountryCode(value ?? "+91")}
                        >
                          <SelectTrigger className="!h-10 min-h-[40px] w-[86px] border-[#2a2d34] bg-[#14161b] py-0 text-zinc-200">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="border border-[#343946] bg-[#1f2430] text-zinc-100 ring-0">
                            {countryOptions.map((option) => (
                              <SelectItem
                                key={option.code}
                                value={option.code}
                                className="text-zinc-100 hover:bg-[#31384a] hover:text-white focus:bg-[#31384a] focus:text-white data-[highlighted]:bg-[#31384a] data-[highlighted]:text-white data-[selected]:bg-[#ff6a3d]/20 data-[selected]:text-[#ffd8ca]"
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          {...field}
                          value={mobileNumber}
                          inputMode="numeric"
                          placeholder="Enter mobile number"
                          className={fieldClassName}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                            setMobileNumber(digits);
                            field.onChange(digits);
                          }}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-[#252932] bg-[#15171c] p-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                  Weight and Payment
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <FormField
                control={form.control}
                name="bags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bags</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter bags"
                        className={fieldClassName}
                        {...field}
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="weight"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weight</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter weight"
                        className={fieldClassName}
                        {...field}
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="less_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Less (%)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Enter less percent"
                          className={`${fieldClassName} pr-8`}
                          {...field}
                          value={
                            field.value === undefined
                              ? 3
                              : field.value === 0
                                ? ""
                                : field.value
                          }
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                          %
                        </span>
                      </div>
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
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter rate"
                        className={fieldClassName}
                        {...field}
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bag_less"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bag Less Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter bag less amount"
                        className={fieldClassName}
                        {...field}
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="add_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Add Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter add amount"
                        className={fieldClassName}
                        {...field}
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cash_paid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cash Paid</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter cash paid"
                        className={fieldClassName}
                        {...field}
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="upi_paid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>UPI Paid</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter UPI paid"
                        className={fieldClassName}
                        {...field}
                        value={field.value === 0 ? "" : field.value}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value) || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            </section>

            <div className="rounded-lg border border-[#ff6a3d]/35 bg-[#16181d] p-3">
              <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                <div>
                  <span className="block text-xs uppercase tracking-wide text-zinc-500">Less Wt</span>
                  <span className="text-base font-medium text-zinc-100">{lessWeight.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide text-zinc-500">Net Wt</span>
                  <span className="text-base font-medium text-zinc-100">{netWeight.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide text-zinc-500">Amount</span>
                  <span className="text-base font-medium text-zinc-100">₹{amount.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-wide text-zinc-500">Bag Avg</span>
                  <span className="text-base font-medium text-zinc-100">{bagAvg.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-3 border-t border-[#252932] pt-2">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Final Total</p>
                <p className="text-2xl font-bold text-[#ff8f6b]">₹{finalTotal.toFixed(2)}</p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pb-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-[#2a2d34] bg-[#17191f] text-zinc-300 hover:bg-[#1d2026] hover:text-zinc-100 sm:min-w-28"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="border border-[#2a2d34] bg-[#ff6a3d] text-white hover:bg-[#ff5a28] sm:min-w-28"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
