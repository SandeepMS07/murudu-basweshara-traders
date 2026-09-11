"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { formatCurrencyINR } from "@/lib/number-format";
import { round2, round4 } from "@/features/soya/lib/money";
import {
  CGST_PERCENT,
  SGST_PERCENT,
  soyaPartyEntrySchema,
  type SoyaPartyEntry,
  type SoyaPartyEntryDraft,
} from "@/features/soya-parties/schemas";
import {
  checkSoyaPartyBillNoAction,
  createSoyaPartyEntryAction,
  updateSoyaPartyEntryAction,
} from "@/app/soya/parties/actions";

interface SoyaPartyFormProps {
  initialData?: SoyaPartyEntry;
  nextSlNo?: number;
  nextBillNo?: string;
  partyOptions?: string[];
  factoryOptions?: string[];
}

const LIST_HREF = "/soya/parties";

export function SoyaPartyForm({
  initialData,
  nextSlNo = 1,
  nextBillNo = "1",
  partyOptions = [],
  factoryOptions = [],
}: SoyaPartyFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [billNoChecking, setBillNoChecking] = useState(false);
  const billNoCheckSeqRef = useRef(0);
  const isEditing = !!initialData;

  const form = useForm<SoyaPartyEntryDraft>({
    resolver: zodResolver(soyaPartyEntrySchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          sl_no: initialData.sl_no,
          date: initialData.date,
          bill_no: initialData.bill_no,
          lorry_no: initialData.lorry_no,
          bags: initialData.bags,
          net_wt: initialData.net_wt,
          rate: initialData.rate,
          tcs: initialData.tcs,
          freight: initialData.freight,
          fright: initialData.fright,
          party: initialData.party,
          factory: initialData.factory,
        }
      : {
          sl_no: nextSlNo,
          date: new Date().toISOString().split("T")[0],
          bill_no: nextBillNo,
          lorry_no: "",
          bags: 0,
          net_wt: 0,
          rate: 0,
          tcs: 0,
          freight: 0,
          fright: 0,
          party: "",
          factory: "",
        },
  });

  const { watch } = form;
  const netWt = watch("net_wt") ?? 0;
  const rate = watch("rate") ?? 0;
  const tcs = watch("tcs") ?? 0;
  const billNo = watch("bill_no");
  const date = watch("date");

  // Mirrors calculateSoyaPartyEntry so the preview always matches what the
  // server will store.
  const amount = round2(netWt * rate);
  const cgst = round4((amount * CGST_PERCENT) / 100);
  const sgst = round4((amount * SGST_PERCENT) / 100);
  const totalAmount = round4(amount + cgst + sgst + tcs);

  useEffect(() => {
    if (!isEditing) {
      form.setValue("sl_no", nextSlNo);
      form.setValue("bill_no", nextBillNo);
    }
  }, [form, isEditing, nextSlNo, nextBillNo]);

  // BILL NO is unique per financial year; warn before submit rather than
  // failing on the database constraint.
  useEffect(() => {
    const candidate = (billNo ?? "").trim();
    if (!candidate || !date) return;

    const seq = ++billNoCheckSeqRef.current;
    const timer = window.setTimeout(async () => {
      try {
        setBillNoChecking(true);
        const available = await checkSoyaPartyBillNoAction(
          candidate,
          date,
          isEditing ? initialData?.id : undefined,
        );
        if (billNoCheckSeqRef.current !== seq) return;
        if (!available) {
          form.setError("bill_no", {
            type: "manual",
            message: "Bill no already exists for this financial year",
          });
        } else if (form.formState.errors.bill_no?.type === "manual") {
          form.clearErrors("bill_no");
        }
      } catch {
        // Ignore transient check failures; the unique index is the backstop.
      } finally {
        if (billNoCheckSeqRef.current === seq) setBillNoChecking(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [billNo, date, form, initialData?.id, isEditing]);

  const fieldClassName =
    "h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500";

  async function onSubmit(values: SoyaPartyEntryDraft) {
    setIsLoading(true);
    try {
      const payload = soyaPartyEntrySchema.parse(values);
      const result =
        isEditing && initialData
          ? await updateSoyaPartyEntryAction(initialData.id, payload)
          : await createSoyaPartyEntryAction(payload);

      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(isEditing ? "Entry updated" : "Entry created");
      router.replace(LIST_HREF);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save entry",
      );
    } finally {
      setIsLoading(false);
    }
  }

  const numberField = (
    name: "bags" | "net_wt" | "rate" | "tcs" | "freight" | "fright",
    label: string,
    options: { prefix?: boolean; suffix?: string; step?: string; hint?: string } = {},
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="relative">
              {options.prefix ? (
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  ₹
                </span>
              ) : null}
              <Input
                type="number"
                step={options.step ?? "0.01"}
                placeholder="0"
                className={`${fieldClassName} ${options.prefix ? "pl-7" : ""} ${
                  options.suffix ? "pr-10" : ""
                }`}
                {...field}
                value={field.value === 0 ? "" : field.value}
                onChange={(event) =>
                  field.onChange(parseFloat(event.target.value) || 0)
                }
              />
              {options.suffix ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                  {options.suffix}
                </span>
              ) : null}
            </div>
          </FormControl>
          {options.hint ? (
            <p className="text-xs text-zinc-500">{options.hint}</p>
          ) : null}
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Card className="mx-auto w-full max-w-6xl gap-0 border border-[#1f2229] bg-[#111214] py-0 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
      <CardHeader className="space-y-0 border-b border-[#252932] bg-[#15171c] py-2.5">
        <CardTitle className="text-lg text-zinc-100">
          {isEditing ? "Update Party Entry" : "New Party Entry"}
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
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Sale Details
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FormField
                  control={form.control}
                  name="sl_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SL NO</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          className={fieldClassName}
                          value={field.value ?? ""}
                          onChange={(event) => {
                            const raw = event.target.value.replace(/\D/g, "");
                            field.onChange(raw ? Number.parseInt(raw, 10) : null);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>DATE</FormLabel>
                      <FormControl>
                        <Input type="date" className={fieldClassName} {...field} />
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
                      <FormLabel>BILL NO</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. 3"
                          className={fieldClassName}
                        />
                      </FormControl>
                      {billNoChecking ? (
                        <p className="text-xs text-zinc-500">
                          Checking bill no...
                        </p>
                      ) : (
                        <p className="text-xs text-zinc-500">
                          Unique per financial year. Text is allowed.
                        </p>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lorry_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LORRY NO</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. KA-28-AA-1747"
                          className={fieldClassName}
                        />
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
                      <FormLabel>PARTY</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          list="soya-party-options"
                          placeholder="Search or type a new party"
                          className={fieldClassName}
                        />
                      </FormControl>
                      <datalist id="soya-party-options">
                        {partyOptions.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                      <p className="text-xs text-zinc-500">
                        A new party is added to the master automatically.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="factory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FACTORY</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          list="soya-party-factory-options"
                          placeholder="Factory the goods came from"
                          className={fieldClassName}
                        />
                      </FormControl>
                      <datalist id="soya-party-factory-options">
                        {factoryOptions.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-2 rounded-lg border border-[#252932] bg-[#15171c] p-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Weight, Rate and Freight
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {numberField("bags", "BAGS", { step: "1" })}
                {numberField("net_wt", "NET WT", { suffix: "kg" })}
                {numberField("rate", "RATE", {
                  prefix: true,
                  step: "0.001",
                  hint: "Rate per kg.",
                })}
                {numberField("tcs", "TCS", { prefix: true })}
                {numberField("freight", "FREIGHT", {
                  hint: "Per-trip freight rate, as in the sheet.",
                })}
                {numberField("fright", "FRIGHT", {
                  prefix: true,
                  hint: "Freight amount — a separate column in the sheet.",
                })}
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-[#ff6a3d] bg-[#16171a] p-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    AMOUNT
                  </p>
                  <p className="mt-1 text-lg text-zinc-100">
                    {formatCurrencyINR(amount, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {CGST_PERCENT}%CGST
                  </p>
                  <p className="mt-1 text-lg text-zinc-100">
                    {formatCurrencyINR(cgst, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {SGST_PERCENT}%SGST
                  </p>
                  <p className="mt-1 text-lg text-zinc-100">
                    {formatCurrencyINR(sgst, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    TCS
                  </p>
                  <p className="mt-1 text-lg text-zinc-100">
                    {formatCurrencyINR(tcs, { maximumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <div className="border-t border-[#2a2d34] pt-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  AMOUNT (Total)
                </p>
                <p className="mt-1 text-3xl font-semibold text-[#ff8f6b]">
                  {formatCurrencyINR(totalAmount, { maximumFractionDigits: 2 })}
                </p>
              </div>
            </section>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.replace(LIST_HREF)}
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
