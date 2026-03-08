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
      less_percent: 0,
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
    <Card className="max-w-4xl">
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Purchase" : "New Purchase"}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" placeholder="Select date" {...field} />
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
                      <Input placeholder="Enter name" {...field} />
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
                      <Input placeholder="Enter place" {...field} />
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
                      <div className="flex gap-2">
                        <Select
                          value={countryCode}
                          onValueChange={(value) => setCountryCode(value ?? "+91")}
                        >
                          <SelectTrigger className="w-[80px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {countryOptions.map((option) => (
                              <SelectItem key={option.code} value={option.code}>
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
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, "");
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
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter less percent"
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
                name="rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rate</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter rate"
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

            <div className="bg-muted p-4 rounded-md mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground block">Less Wt:</span>{" "}
                {lessWeight.toFixed(2)}
              </div>
              <div>
                <span className="text-muted-foreground block">Net Wt:</span>{" "}
                {netWeight.toFixed(2)}
              </div>
              <div>
                <span className="text-muted-foreground block">Amount:</span> ₹
                {amount.toFixed(2)}
              </div>
              <div>
                <span className="text-muted-foreground block">Bag Avg:</span>{" "}
                {bagAvg.toFixed(2)}
              </div>
              <div className="font-bold text-lg text-primary">
                <span className="text-muted-foreground block text-sm font-normal">
                  Final Total:
                </span>{" "}
                ₹{finalTotal.toFixed(2)}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
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
