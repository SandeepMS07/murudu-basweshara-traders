"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { soyaTradeSchema, type SoyaTrade } from "@/features/soya-trade/schemas";
import { formatCurrencyINR } from "@/lib/number-format";
import type { SoyaCompany } from "@/features/soya-companies/schemas";
import { SOYA_GOODS_NAME } from "@/features/soya/lib/constants";

type SaveResult =
  | { success: true; sale: SoyaTrade }
  | { success: false; message: string };

type CreatePartyResult =
  | { success: true; company: SoyaCompany }
  | { success: false; message: string };

/**
 * Soya Purchases and Soya Sales are the same sales-shaped form against
 * different tables, so the actions, labels and routes are injected rather than
 * hardcoded — one component, two consumers.
 */
interface SoyaTradeFormProps {
  initialData?: SoyaTrade;
  buyerCompanies: SoyaCompany[];
  issuerCompanies: SoyaCompany[];
  canCreateBuyer?: boolean;
  initialSlNo?: number;
  initialBillNumber?: string;
  /** e.g. "Purchase" — used in headings, buttons and toasts. */
  entityLabel: string;
  /** e.g. "Party" — label for the counterparty field. */
  partyLabel: string;
  /** Where to go after a successful save, e.g. "/soya/parties". */
  listHref: string;
  createAction: (data: SoyaTradeFormPayload) => Promise<SaveResult>;
  updateAction: (id: string, data: SoyaTradeFormPayload) => Promise<SaveResult>;
  nextBillNumberAction: (
    saleDate: string,
    issuerCompanyId: string | null,
  ) => Promise<string>;
  createPartyAction: (data: {
    type: "buyer";
    name: string;
    display_name: string;
  }) => Promise<CreatePartyResult>;
  /** Which directory the counterparty is created in. */
  partyType: "buyer";
}

type SaleFormValues = z.input<typeof soyaTradeSchema>;
type SoyaTradeFormPayload = z.output<typeof soyaTradeSchema>;

function parseNumberOrUndefined(value: string): number | undefined {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function SoyaTradeForm({
  initialData,
  buyerCompanies,
  issuerCompanies,
  canCreateBuyer = false,
  initialSlNo = 1,
  initialBillNumber = "1",
  entityLabel,
  partyLabel,
  listHref,
  createAction,
  updateAction,
  nextBillNumberAction,
  createPartyAction,
  partyType,
}: SoyaTradeFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [buyers, setBuyers] = useState<SoyaCompany[]>(buyerCompanies);
  const [buyerSearch, setBuyerSearch] = useState(initialData?.party ?? "");
  // Once the user types a bill number themselves, stop auto-suggesting.
  const [billNumberEdited, setBillNumberEdited] = useState(false);
  // Shows a loader on the bill-number field while re-fetching for a new issuer.
  const [billNumberLoading, setBillNumberLoading] = useState(false);
  const isEditing = Boolean(initialData);
  const issuerOptions = useMemo(
    () =>
      [...issuerCompanies].sort((a, b) =>
        (a.display_name || a.name).localeCompare(b.display_name || b.name)
      ),
    [issuerCompanies]
  );

  const form = useForm<SaleFormValues>({
    resolver: zodResolver(soyaTradeSchema),
    defaultValues: initialData
      ? {
          id: initialData.id,
          sl_no: initialData.sl_no,
          bill_number: initialData.bill_number,
          sale_date: initialData.sale_date,
          issuer_company_id: initialData.issuer_company_id ?? null,
          dispatch_through: initialData.dispatch_through,
          lorry_number: initialData.lorry_number,
          goods_name: initialData.goods_name,
          destination: initialData.destination,
          party: initialData.party,
          sale_company_id: initialData.sale_company_id ?? null,
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
          sl_no: initialSlNo,
          bill_number: initialBillNumber,
          sale_date: new Date().toISOString().split("T")[0],
          issuer_company_id: issuerOptions.find((company) => company.is_active)?.id
            ?? issuerOptions[0]?.id
            ?? null,
          dispatch_through: "TRUCK",
          lorry_number: "",
          goods_name: SOYA_GOODS_NAME,
          destination: "",
          party: "",
          sale_company_id: null,
          payment_terms: "",
          bags: undefined,
          net_weight: undefined,
          factory_weight: undefined,
          rate: undefined,
          flight: undefined,
          bag_avg: undefined,
          factory_rate: 0,
          source: "manual",
        },
  });

  const watched = form.watch();
  const computed = useMemo(() => {
    const netWeight = watched.net_weight || 0;
    const factoryWeight = watched.factory_weight || 0;
    const effectiveWeight = factoryWeight > 0 ? factoryWeight : netWeight;
    const rate = watched.rate || 0;
    const factoryRate = 0;
    const amount = effectiveWeight * rate;
    const factoryAmount = effectiveWeight * factoryRate;
    const pendingAmount = amount - factoryAmount;
    return {
      amount,
      factoryAmount,
      pendingAmount,
    };
  }, [watched]);

  const fieldClassName =
    "h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500";

  const selectedBuyerId = form.watch("sale_company_id");
  const selectedBuyer = useMemo(
    () => buyers.find((company) => company.id === selectedBuyerId) ?? null,
    [buyers, selectedBuyerId]
  );

  // Suggest the next bill number for the selected issuer company (create mode
  // only, and only until the user edits the field). Bill numbers are scoped
  // per issuer company, so switching the issuer changes the suggestion.
  const selectedIssuerId = form.watch("issuer_company_id");
  useEffect(() => {
    if (isEditing || billNumberEdited) return;
    let active = true;
    setBillNumberLoading(true);
    nextBillNumberAction(form.getValues("sale_date"), selectedIssuerId ?? null)
      .then((next) => {
        if (active && !billNumberEdited) {
          form.setValue("bill_number", next);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setBillNumberLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedIssuerId, isEditing, billNumberEdited, form, nextBillNumberAction]);

  async function onSubmit(values: SaleFormValues) {
    setIsLoading(true);
    try {
      const payload = soyaTradeSchema.parse(values);
      payload.factory_rate = 0;
      payload.bag_avg = undefined;
      if (payload.sale_company_id && selectedBuyer) {
        payload.party = selectedBuyer.name;
      }
      const result =
        isEditing && initialData?.id
          ? await updateAction(initialData.id, payload)
          : await createAction(payload);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      toast.success(`${entityLabel} ${isEditing ? "updated" : "created"}`);
      router.replace(listHref);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to save ${entityLabel.toLowerCase()}`,
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddBuyer() {
    const name = buyerSearch.trim();
    if (!name) {
      toast.error(`Enter ${partyLabel.toLowerCase()} name`);
      return;
    }

    try {
      const result = await createPartyAction({
        type: partyType,
        name,
        display_name: name,
      });
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      const created = result.company;
      setBuyers((current) =>
        [...current, created].sort((a, b) => a.name.localeCompare(b.name)),
      );
      form.setValue("sale_company_id", created.id);
      form.setValue("party", created.name);
      setBuyerSearch(created.name);
      toast.success(`${partyLabel} added`);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to add ${partyLabel.toLowerCase()}`,
      );
    }
  }

  function handleBuyerSearchChange(value: string) {
    setBuyerSearch(value);
    const normalized = value.trim().toLowerCase();
    const matched =
      buyers.find((entry) => entry.name.trim().toLowerCase() === normalized) ?? null;
    if (matched) {
      form.setValue("sale_company_id", matched.id);
      form.setValue("party", matched.name);
      return;
    }
    form.setValue("sale_company_id", null);
    form.setValue("party", value.trim());
  }

  return (
    <Card className="mx-auto w-full max-w-6xl gap-0 border border-[#1f2229] bg-[#111214] py-0 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
      <CardHeader className="space-y-0 border-b border-[#252932] bg-[#15171c] py-2.5">
        <CardTitle className="text-lg text-zinc-100">
          {isEditing ? `Update ${entityLabel} Details` : `New ${entityLabel} Details`}
        </CardTitle>
        <p className="text-xs text-zinc-500">
          Fill the required {entityLabel.toLowerCase()} fields.
        </p>
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
                        placeholder="SL No"
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
                      <div className="relative">
                        <Input
                          {...field}
                          onChange={(event) => {
                            setBillNumberEdited(true);
                            field.onChange(event);
                          }}
                          disabled={billNumberLoading}
                          className={fieldClassName}
                          placeholder="Enter bill number"
                        />
                        {billNumberLoading ? (
                          <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-400" />
                        ) : null}
                      </div>
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
                name="issuer_company_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuer Company</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(value) => field.onChange(value || null)}
                    >
                      <FormControl>
                        <SelectTrigger className={`${fieldClassName} !h-10 w-full`}>
                          <SelectValue placeholder="Select issuer company">
                            {(value) => {
                              const selected = issuerOptions.find(
                                (company) => company.id === value,
                              );
                              return selected
                                ? selected.display_name || selected.name
                                : "Select issuer company";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="border border-[#343946] bg-[#1f2430] text-zinc-100 ring-0">
                        {issuerOptions.map((company) => (
                          <SelectItem
                            key={company.id}
                            value={company.id}
                            className="text-zinc-100 hover:bg-[#31384a] hover:text-white focus:bg-[#31384a] focus:text-white data-[highlighted]:bg-[#31384a] data-[highlighted]:text-white"
                          >
                            {company.display_name || company.name}
                            {!company.is_active ? " (Inactive)" : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sale_company_id"
                render={() => (
                  <FormItem>
                    <FormLabel>{partyLabel} / Party</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          list="soya-party-options"
                          value={buyerSearch}
                          onChange={(event) => handleBuyerSearchChange(event.target.value)}
                          className={fieldClassName}
                          placeholder={`Search existing ${partyLabel.toLowerCase()} or type new party`}
                        />
                      </FormControl>
                      {canCreateBuyer ? (
                        <Button
                          type="button"
                          onClick={handleAddBuyer}
                          className="h-10 shrink-0 cursor-pointer border border-[#2a2d34] bg-[#1b1e24] px-4 text-zinc-100 hover:bg-[#23262e]"
                        >
                          Add
                        </Button>
                      ) : null}
                    </div>
                    <datalist id="soya-party-options">
                      {buyers.map((company) => (
                        <option key={company.id} value={company.name} />
                      ))}
                    </datalist>
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
                name="dispatch_through"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dispatched Through</FormLabel>
                    <Select
                      value={field.value ?? "TRUCK"}
                      onValueChange={(value) =>
                        field.onChange(value === "TRACTORY" ? "TRACTORY" : "TRUCK")
                      }
                    >
                      <FormControl>
                        <SelectTrigger className={`${fieldClassName} !h-10 w-full`}>
                          <SelectValue placeholder="Select dispatch mode" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="border border-[#343946] bg-[#1f2430] text-zinc-100 ring-0">
                        <SelectItem
                          value="TRUCK"
                          className="text-zinc-100 hover:bg-[#31384a] hover:text-white focus:bg-[#31384a] focus:text-white data-[highlighted]:bg-[#31384a] data-[highlighted]:text-white"
                        >
                          TRUCK
                        </SelectItem>
                        <SelectItem
                          value="TRACTORY"
                          className="text-zinc-100 hover:bg-[#31384a] hover:text-white focus:bg-[#31384a] focus:text-white data-[highlighted]:bg-[#31384a] data-[highlighted]:text-white"
                        >
                          TRACTORY
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="goods_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Goods Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={fieldClassName}
                        placeholder="Enter goods name"
                        value={field.value ?? SOYA_GOODS_NAME}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className={fieldClassName}
                        placeholder="Enter destination"
                        value={field.value ?? ""}
                      />
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
                      <Input
                        type="number"
                        step="0.01"
                        className={fieldClassName}
                        placeholder="Enter bags"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(parseNumberOrUndefined(e.target.value))}
                      />
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
                      <Input
                        type="number"
                        step="0.01"
                        className={fieldClassName}
                        placeholder="Enter net weight"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(parseNumberOrUndefined(e.target.value))}
                      />
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
                      <Input
                        type="number"
                        step="0.01"
                        className={fieldClassName}
                        placeholder="Enter factory weight"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(parseNumberOrUndefined(e.target.value))}
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
                        className={fieldClassName}
                        placeholder="Enter rate"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(parseNumberOrUndefined(e.target.value))}
                      />
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
                      <Input
                        type="number"
                        step="0.01"
                        className={fieldClassName}
                        placeholder="Enter flight"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(parseNumberOrUndefined(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-md border border-[#252932] bg-[#15171c] p-4 text-sm md:grid-cols-3">
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
            </div>

            <div className="flex justify-end gap-2 pb-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="cursor-pointer border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || billNumberLoading}
                className="cursor-pointer border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              >
                {isLoading || billNumberLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
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
