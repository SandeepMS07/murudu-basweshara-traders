"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Pencil, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  assignUnassignedCounterpartiesAction,
  updateCounterpartyGstAction,
} from "@/app/soya/counterparties/actions";
import type {
  CounterpartyKind,
  SoyaCounterparty,
} from "@/features/soya/service/counterparty-gst.service";
import {
  checkGstin,
  GST_REGISTRATION_TYPES,
  GST_STATE_OPTIONS,
  stateNameForCode,
} from "@/features/soya/lib/gst";
import { cn } from "@/lib/utils";

const fieldClass =
  "border-[#2a2d34] bg-[#111214] text-zinc-100 placeholder:text-zinc-600";
const selectClass = cn("h-9 w-full cursor-pointer rounded-md border px-2 text-sm", fieldClass);

type FormState = {
  company_id: string;
  gstin: string;
  state_code: string;
  registration_type: string;
  address: string;
  place: string;
  pincode: string;
  phone: string;
};

interface CounterpartyGstCardProps {
  kind: CounterpartyKind;
  rows: SoyaCounterparty[];
  companies: { id: string; name: string }[];
  activeCompanyId: string;
  label: string;
}

/**
 * GST identity for the factory / party master, shown above the trading ledger.
 *
 * Sits alongside the ledger rather than inside it: the ledger owns names,
 * entries and payments and is live code, while these columns are new. Keeping
 * the two apart means invoicing cannot regress day-to-day trading.
 */
export function CounterpartyGstCard({
  kind,
  rows,
  companies,
  activeCompanyId,
  label,
}: CounterpartyGstCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<SoyaCounterparty | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  // Read into a local first: memoising on `form?.gstin` while the body reads
  // `form` makes the compiler infer a broader dependency than declared.
  const gstin = form?.gstin ?? "";
  const gstinCheck = useMemo(
    () => (gstin.trim() ? checkGstin(gstin) : null),
    [gstin],
  );

  const unassigned = rows.filter((row) => !row.company_id);
  const incomplete = rows.filter((row) => !row.gstin);

  const openEdit = (row: SoyaCounterparty) => {
    setForm({
      company_id: row.company_id || activeCompanyId,
      gstin: row.gstin,
      state_code: row.state_code,
      registration_type: row.registration_type,
      address: row.address,
      place: row.place,
      pincode: row.pincode,
      phone: row.phone,
    });
    setEditing(row);
  };

  const save = () => {
    if (!editing || !form) return;
    if (gstinCheck && !gstinCheck.valid) {
      toast.error(gstinCheck.reason);
      return;
    }
    startTransition(async () => {
      try {
        await updateCounterpartyGstAction(kind, editing.id, form);
        toast.success(`${editing.name} updated`);
        setEditing(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save");
      }
    });
  };

  const assignAll = () => {
    if (!activeCompanyId) {
      toast.error("No company is open");
      return;
    }
    startTransition(async () => {
      try {
        const moved = await assignUnassignedCounterpartiesAction(kind, activeCompanyId);
        toast.success(`${moved} moved to the open company`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not assign");
      }
    });
  };

  return (
    <section className="mb-5 rounded-2xl border border-[#2a2d34] bg-[#14161b] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            GST details
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Needed before an invoice to this {label.toLowerCase()} can be filed.
          </p>
        </div>
        {unassigned.length > 0 && activeCompanyId ? (
          <Button
            variant="outline"
            onClick={assignAll}
            disabled={isPending}
            className="cursor-pointer border-[#2a2d34] bg-transparent text-zinc-300 hover:bg-[#1b1e24]"
          >
            Assign {unassigned.length} unassigned to the open company
          </Button>
        ) : null}
      </div>

      {incomplete.length > 0 ? (
        <p className="mb-3 flex items-start gap-2 rounded-md border border-[#3d3418] bg-[#2a2412]/40 px-3 py-2 text-xs text-[#f7e3b0]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {incomplete.length} of {rows.length} have no GSTIN yet. An invoice to a
            registered dealer cannot be filed without one.
          </span>
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[#2a2d34] text-left text-xs uppercase tracking-wider text-zinc-500">
              <th className="py-2 pr-3 font-medium">{label}</th>
              <th className="py-2 pr-3 font-medium">GSTIN</th>
              <th className="py-2 pr-3 font-medium">State</th>
              <th className="py-2 pr-3 font-medium">Company</th>
              <th className="py-2 pr-3 font-medium">Place</th>
              <th className="w-10 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-600">
                  Nothing on the master yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const company = companies.find((candidate) => candidate.id === row.company_id);
                return (
                  <tr key={row.id} className="border-b border-[#1d2026] last:border-0">
                    <td className="py-2 pr-3 font-medium text-zinc-200">{row.name}</td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {row.gstin ? (
                        <span className="inline-flex items-center gap-1 text-zinc-300">
                          <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                          {row.gstin}
                        </span>
                      ) : (
                        <span className="text-amber-400/70">not set</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-zinc-400">
                      {stateNameForCode(row.state_code) || "—"}
                    </td>
                    <td className="py-2 pr-3 text-zinc-400">
                      {company?.name ?? (
                        <span className="text-amber-400/70">unassigned</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-zinc-400">{row.place || "—"}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        aria-label={`Edit GST details for ${row.name}`}
                        className="cursor-pointer rounded-md p-1.5 text-zinc-500 hover:bg-[#1d2026] hover:text-zinc-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(next) => (next ? null : setEditing(null))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#2a2d34] bg-[#14161b] text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.name}</DialogTitle>
            <DialogDescription className="text-zinc-500">
              The GSTIN decides which tax applies. Changing it here does not
              change any invoice already issued — those keep their own copy.
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="grid gap-4 py-2">
              <div className="grid gap-1.5">
                <Label htmlFor="cp-company" className="text-xs text-zinc-400">
                  Company
                </Label>
                <select
                  id="cp-company"
                  value={form.company_id}
                  onChange={(event) => set("company_id", event.target.value)}
                  className={selectClass}
                >
                  <option value="">— unassigned —</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="cp-gstin" className="text-xs text-zinc-400">
                  GSTIN
                </Label>
                <Input
                  id="cp-gstin"
                  value={form.gstin}
                  onChange={(event) => set("gstin", event.target.value.toUpperCase())}
                  placeholder="29AAWCA5892P1ZB"
                  className={cn(
                    fieldClass,
                    "font-mono",
                    gstinCheck && !gstinCheck.valid && "border-red-500/60",
                  )}
                />
                {gstinCheck ? (
                  gstinCheck.valid ? (
                    <p className="text-xs text-emerald-400">{gstinCheck.stateName}</p>
                  ) : (
                    <p className="text-xs text-red-400">{gstinCheck.reason}</p>
                  )
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cp-reg" className="text-xs text-zinc-400">
                    Registration
                  </Label>
                  <select
                    id="cp-reg"
                    value={form.registration_type}
                    onChange={(event) => set("registration_type", event.target.value)}
                    className={selectClass}
                  >
                    {GST_REGISTRATION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cp-state" className="text-xs text-zinc-400">
                    State
                  </Label>
                  <select
                    id="cp-state"
                    value={gstinCheck?.valid ? gstinCheck.stateCode : form.state_code}
                    onChange={(event) => set("state_code", event.target.value)}
                    disabled={Boolean(gstinCheck?.valid)}
                    className={cn(selectClass, gstinCheck?.valid && "opacity-60")}
                  >
                    <option value="">— choose —</option>
                    {GST_STATE_OPTIONS.map((state) => (
                      <option key={state.code} value={state.code}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                  {gstinCheck?.valid ? (
                    <p className="text-xs text-zinc-600">Taken from the GSTIN</p>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="cp-addr" className="text-xs text-zinc-400">
                  Address
                </Label>
                <Input
                  id="cp-addr"
                  value={form.address}
                  onChange={(event) => set("address", event.target.value)}
                  className={fieldClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="cp-place" className="text-xs text-zinc-400">
                    Place
                  </Label>
                  <Input
                    id="cp-place"
                    value={form.place}
                    onChange={(event) => set("place", event.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cp-pin" className="text-xs text-zinc-400">
                    Pincode
                  </Label>
                  <Input
                    id="cp-pin"
                    value={form.pincode}
                    onChange={(event) =>
                      set("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    className={fieldClass}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="cp-phone" className="text-xs text-zinc-400">
                    Phone
                  </Label>
                  <Input
                    id="cp-phone"
                    value={form.phone}
                    onChange={(event) => set("phone", event.target.value)}
                    className={fieldClass}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditing(null)}
              disabled={isPending}
              className="cursor-pointer text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={isPending}
              className="cursor-pointer bg-[#ff6a3d] text-white hover:bg-[#ff7f57]"
            >
              {isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
