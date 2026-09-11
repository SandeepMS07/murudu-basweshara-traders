"use client";

import { useEffect, useState } from "react";
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
  GST_PERCENT,
  soyaFactoryEntrySchema,
  type SoyaFactoryEntry,
  type SoyaFactoryEntryDraft,
} from "@/features/soya-factory/schemas";
import {
  createSoyaFactoryEntryAction,
  updateSoyaFactoryEntryAction,
} from "@/app/soya/factory/actions";

interface SoyaFactoryFormProps {
  initialData?: SoyaFactoryEntry;
  nextSlNo?: number;
  factoryOptions?: string[];
  partyOptions?: string[];
}

const LIST_HREF = "/soya/factory";

export function SoyaFactoryForm({
  initialData,
  nextSlNo = 1,
  factoryOptions = [],
  partyOptions = [],
}: SoyaFactoryFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = !!initialData;

  const form = useForm<SoyaFactoryEntryDraft>({
    resolver: zodResolver(soyaFactoryEntrySchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          sl_no: initialData.sl_no,
          factory: initialData.factory,
          date: initialData.date,
          pb_no: initialData.pb_no,
          lorry: initialData.lorry,
          bags: initialData.bags,
          weight: initialData.weight,
          rate: initialData.rate,
          tcs: initialData.tcs,
          party: initialData.party,
        }
      : {
          sl_no: nextSlNo,
          factory: "",
          date: new Date().toISOString().split("T")[0],
          pb_no: "",
          lorry: "",
          bags: 0,
          weight: 0,
          rate: 0,
          tcs: 0,
          party: "",
        },
  });

  const { watch } = form;
  const weight = watch("weight") ?? 0;
  const rate = watch("rate") ?? 0;
  const tcs = watch("tcs") ?? 0;

  // Mirrors calculateSoyaFactoryEntry so the preview always matches what the
  // server will store.
  const amount = round2(weight * rate);
  const gstAmount = round4((amount * GST_PERCENT) / 100);
  const totalAmount = round4(amount + gstAmount + tcs);

  useEffect(() => {
    if (!isEditing) form.setValue("sl_no", nextSlNo);
  }, [form, isEditing, nextSlNo]);

  const fieldClassName =
    "h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500";

  async function onSubmit(values: SoyaFactoryEntryDraft) {
    setIsLoading(true);
    try {
      const payload = soyaFactoryEntrySchema.parse(values);
      const result =
        isEditing && initialData
          ? await updateSoyaFactoryEntryAction(initialData.id, payload)
          : await createSoyaFactoryEntryAction(payload);

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

  return (
    <Card className="mx-auto w-full max-w-6xl gap-0 border border-[#1f2229] bg-[#111214] py-0 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
      <CardHeader className="space-y-0 border-b border-[#252932] bg-[#15171c] py-2.5">
        <CardTitle className="text-lg text-zinc-100">
          {isEditing ? "Update Factory Entry" : "New Factory Entry"}
        </CardTitle>
        <p className="text-xs text-zinc-500">
          Type to search an existing factory or enter a new one.
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
                Purchase Details
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
                  name="factory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FACTORY</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          list="soya-factory-options"
                          placeholder="Search or type a new factory"
                          className={fieldClassName}
                        />
                      </FormControl>
                      <datalist id="soya-factory-options">
                        {factoryOptions.map((option) => (
                          <option key={option} value={option} />
                        ))}
                      </datalist>
                      <p className="text-xs text-zinc-500">
                        A new factory is added to the master automatically.
                      </p>
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
                  name="pb_no"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>P B NO</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. MI/75"
                          className={fieldClassName}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lorry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>LORRY</FormLabel>
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
                          list="soya-factory-party-options"
                          placeholder="Party this lorry went to"
                          className={fieldClassName}
                        />
                      </FormControl>
                      <datalist id="soya-factory-party-options">
                        {partyOptions.map((option) => (
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
                Weight and Rate
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FormField
                  control={form.control}
                  name="bags"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>BAGS</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter bags"
                          className={fieldClassName}
                          {...field}
                          value={field.value === 0 ? "" : field.value}
                          onChange={(event) =>
                            field.onChange(parseFloat(event.target.value) || 0)
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
                      <FormLabel>WEIGHT</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Enter weight"
                            className={`${fieldClassName} pr-10`}
                            {...field}
                            value={field.value === 0 ? "" : field.value}
                            onChange={(event) =>
                              field.onChange(parseFloat(event.target.value) || 0)
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
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RATE</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                            ₹
                          </span>
                          <Input
                            type="number"
                            step="0.001"
                            placeholder="Enter rate"
                            className={`${fieldClassName} pl-7`}
                            {...field}
                            value={field.value === 0 ? "" : field.value}
                            onChange={(event) =>
                              field.onChange(parseFloat(event.target.value) || 0)
                            }
                          />
                        </div>
                      </FormControl>
                      <p className="text-xs text-zinc-500">Rate per kg.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="tcs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TCS</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">
                            ₹
                          </span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0"
                            className={`${fieldClassName} pl-7`}
                            {...field}
                            value={field.value === 0 ? "" : field.value}
                            onChange={(event) =>
                              field.onChange(parseFloat(event.target.value) || 0)
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
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
                    GST {GST_PERCENT} %
                  </p>
                  <p className="mt-1 text-lg text-zinc-100">
                    {formatCurrencyINR(gstAmount, { maximumFractionDigits: 2 })}
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
