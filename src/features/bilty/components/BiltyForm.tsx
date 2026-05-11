"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  biltySchema,
  type Bilty,
} from "@/features/bilty/schemas";
import {
  checkBiltyBillNoAvailabilityAction,
  createBiltyAction,
  createBiltyPartyAction,
  updateBiltyAction,
} from "@/app/bilty/actions";
import { formatCurrencyINR } from "@/lib/number-format";

interface BiltyFormProps {
  initialData?: Bilty;
  nextBillNo?: number;
  linkedBillNo?: number;
  partyOptions?: string[];
}

type BiltyFormValues = z.input<typeof biltySchema>;

export function BiltyForm({
  initialData,
  nextBillNo,
  linkedBillNo,
  partyOptions = [],
}: BiltyFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingParty, setIsAddingParty] = useState(false);
  const [localPartyOptions, setLocalPartyOptions] = useState<string[]>(partyOptions);
  const [partyPlace, setPartyPlace] = useState("");
  const [partyMob, setPartyMob] = useState("");
  const isEditing = !!initialData;
  const form = useForm<BiltyFormValues>({
    resolver: zodResolver(biltySchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          bill_no:
            initialData.bill_no && initialData.bill_no > 0
              ? initialData.bill_no
              : linkedBillNo && linkedBillNo > 0
                ? linkedBillNo
                : nextBillNo ?? 1,
          date: initialData.date,
          party: initialData.party || initialData.name || "",
          bags: initialData.bags,
          weight: initialData.weight,
          less_percent: initialData.less_percent,
          rate: initialData.rate,
          add_amount: initialData.add_amount,
          cash_paid: initialData.cash_paid,
          upi_paid: initialData.upi_paid,
          payment_date: initialData.payment_date ?? null,
          source: initialData.source,
          payment_through: initialData.payment_through ?? "none",
        }
      : {
          bill_no: nextBillNo ?? 1,
          date: new Date().toISOString().split("T")[0],
          party: "",
          bags: 0,
          weight: 0,
          less_percent: 0.5,
          rate: 0,
          add_amount: 0,
          cash_paid: 0,
          upi_paid: 0,
          payment_date: null,
          source: "app",
          payment_through: "none",
        },
  });

  const { watch } = form;
  const billNo = watch("bill_no");
  const billDate = watch("date");
  const weight = watch("weight");
  const bags = watch("bags");
  const lessPercent = watch("less_percent");
  const rate = watch("rate");
  const addAmount = watch("add_amount");

  const lessWeight = ((weight || 0) * (lessPercent || 0)) / 100;
  const netWeight = (weight || 0) - lessWeight;
  const amount = Number(((netWeight * (rate || 0)) / 100).toFixed(2));
  const finalTotal = Number(
    (
      amount +
      (addAmount || 0)
    ).toFixed(2)
  );
  const bagAvg = (bags || 0) > 0 ? netWeight / (bags || 1) : 0;
  const fieldClassName =
    "h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500";
  const [billNoChecking, setBillNoChecking] = useState(false);
  const billNoCheckSeqRef = useRef(0);
  const [billNoText, setBillNoText] = useState(() => {
    const initial = form.getValues("bill_no");
    return initial ? String(initial) : "";
  });

  useEffect(() => {
    const nextValue = billNo ? String(billNo) : "";
    setBillNoText((prev) => (prev === nextValue ? prev : nextValue));
  }, [billNo]);

  useEffect(() => {
    setLocalPartyOptions(partyOptions);
  }, [partyOptions]);

  async function handleAddParty() {
    const rawParty = form.getValues("party");
    const candidate = rawParty?.trim() ?? "";
    const place = partyPlace.trim();
    const mob = partyMob.trim();
    if (!candidate) {
      toast.error("Enter a party name first");
      return;
    }
    if (!place) {
      toast.error("Enter place for party");
      return;
    }
    if (!mob) {
      toast.error("Enter mobile number for party");
      return;
    }

    setIsAddingParty(true);
    try {
      const created = await createBiltyPartyAction(candidate, place, mob);
      form.setValue("party", created.name, { shouldValidate: true });
      setLocalPartyOptions((current) =>
        current.includes(created.name) ? current : [...current, created.name]
      );
      setPartyPlace("");
      setPartyMob("");
      toast.success("Party added");
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to add party";
      toast.error(message);
    } finally {
      setIsAddingParty(false);
    }
  }

  async function onSubmit(values: BiltyFormValues) {
    setIsLoading(true);
    try {
      const payload = biltySchema.parse({
        ...values,
        party: values.party.trim(),
        cash_paid: 0,
        upi_paid: 0,
        payment_date: values.payment_date ?? initialData?.payment_date ?? null,
        payment_through: values.payment_through ?? initialData?.payment_through ?? "none",
      });

      if (isEditing && initialData?.id) {
        await updateBiltyAction(initialData.id, payload);
        toast.success("Bilty Updated");
        router.replace("/bilty");
      } else {
        await createBiltyAction(payload);
        toast.success("Bilty Created");
        router.replace("/bilty");
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save bilty";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const candidate = Number(billNo);
    const dateForCheck = billDate || "";
    if (!Number.isInteger(candidate) || candidate <= 0) return;
    if (!dateForCheck) return;

    const seq = ++billNoCheckSeqRef.current;
    const timer = window.setTimeout(async () => {
      try {
        setBillNoChecking(true);
        const available = await checkBiltyBillNoAvailabilityAction(
          candidate,
          dateForCheck,
          isEditing ? initialData?.id : undefined
        );
        if (billNoCheckSeqRef.current !== seq) return;
        if (!available) {
          form.setError("bill_no", {
            type: "manual",
            message: "Bill number already exists",
          });
        } else if (
          form.formState.errors.bill_no?.message === "Bill number already exists"
        ) {
          form.clearErrors("bill_no");
        }
      } catch {
        // ignore transient check failures
      } finally {
        if (billNoCheckSeqRef.current === seq) {
          setBillNoChecking(false);
        }
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [billNo, billDate, form, initialData?.id, isEditing]);

  return (
    <Card className="mx-auto w-full max-w-6xl gap-0 py-0 border border-[#1f2229] bg-[#111214] text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
      <CardHeader className="space-y-0 border-b border-[#252932] bg-[#15171c] py-2.5">
        <CardTitle className="text-lg text-zinc-100">
          {isEditing ? "Update Bilty Details" : "New Bilty Details"}
        </CardTitle>
        <p className="text-xs text-zinc-500">
          Type to search an existing party or enter a new one.
        </p>
      </CardHeader>
      <CardContent className="pt-3">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4 [&_[data-slot=form-label]]:text-zinc-300"
          >
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
                  name="bill_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bill No</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          className={fieldClassName}
                          {...field}
                          value={billNoText}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, "");
                            setBillNoText(raw);
                            if (!raw) {
                              field.onChange(undefined);
                              return;
                            }
                            const parsed = Number.parseInt(raw, 10);
                            field.onChange(Number.isFinite(parsed) ? parsed : undefined);
                          }}
                        />
                      </FormControl>
                      {billNoChecking ? (
                        <p className="text-xs text-zinc-500">Checking bill number...</p>
                      ) : null}
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
                        <div className="space-y-1.5">
                          <div className="flex gap-2">
                            <Input
                              {...field}
                              list="bilty-party-options"
                              placeholder="Search existing party or type new"
                              className={fieldClassName}
                            />
                            <Button
                              type="button"
                              onClick={handleAddParty}
                              disabled={isAddingParty}
                              className="h-10 border border-[#2a2d34] bg-[#1b1e24] px-4 text-zinc-100 hover:bg-[#23262e]"
                            >
                              {isAddingParty ? "Adding..." : "Add"}
                            </Button>
                          </div>
                          <datalist id="bilty-party-options">
                            {localPartyOptions.map((option) => (
                              <option key={option} value={option} />
                            ))}
                          </datalist>
                        </div>
                      </FormControl>
                      <p className="text-xs text-zinc-500">
                        Select from suggestions or type a new name, then click Add.
                      </p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Input
                          value={partyPlace}
                          placeholder="Place for new party"
                          className={fieldClassName}
                          onChange={(event) => setPartyPlace(event.target.value)}
                        />
                        <Input
                          value={partyMob}
                          inputMode="numeric"
                          placeholder="Mobile for new party"
                          className={fieldClassName}
                          onChange={(event) =>
                            setPartyMob(event.target.value.replace(/\D/g, "").slice(0, 10))
                          }
                        />
                      </div>
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
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Enter weight"
                            className={`${fieldClassName} pr-10`}
                            {...field}
                            value={field.value === 0 ? "" : field.value}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                            kg
                          </span>
                        </div>
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
                                ? 0.5
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
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                            ₹
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Enter rate"
                            className={`${fieldClassName} pl-7`}
                            {...field}
                            value={field.value === 0 ? "" : field.value}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                      </FormControl>
                      <p className="text-xs text-zinc-500">Enter rate for 100 kg.</p>
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
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                            ₹
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Enter add amount"
                            className={`${fieldClassName} pl-7`}
                            {...field}
                            value={field.value === 0 ? "" : field.value}
                            onChange={(e) =>
                              field.onChange(parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-[#ff6a3d] bg-[#16171a] p-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Less WT</p>
                  <p className="mt-1 text-lg text-zinc-100">{lessWeight.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Net WT</p>
                  <p className="mt-1 text-lg text-zinc-100">{netWeight.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Amount</p>
                  <p className="mt-1 text-lg text-zinc-100">
                    {formatCurrencyINR(amount, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">Bag Avg</p>
                  <p className="mt-1 text-lg text-zinc-100">{bagAvg.toFixed(2)}</p>
                </div>
              </div>
              <div className="border-t border-[#2a2d34] pt-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">Final Total</p>
                <p className="mt-1 text-3xl font-semibold text-[#ff8f6b]">
                  {formatCurrencyINR(finalTotal, { maximumFractionDigits: 0 })}
                </p>
              </div>
            </section>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.replace("/bilty")}
                className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
