"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Pencil, Plus, Star, Trash2 } from "lucide-react";
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
  createSoyaCompanyAction,
  deleteSoyaCompanyAction,
  setActiveSoyaCompanyAction,
  updateSoyaCompanyAction,
} from "@/app/soya/companies/actions";
import type { SoyaCompany } from "@/features/soya-companies/schemas";
import {
  checkGstin,
  GST_STATE_OPTIONS,
  stateNameForCode,
} from "@/features/soya/lib/gst";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  legal_name: string;
  gstin: string;
  state_code: string;
  address: string;
  place: string;
  pincode: string;
  phone: string;
  email: string;
  invoice_prefix: string;
  is_active: boolean;
  is_default: boolean;
  aato_over_10cr: boolean;
};

const EMPTY: FormState = {
  name: "",
  legal_name: "",
  gstin: "",
  state_code: "",
  address: "",
  place: "",
  pincode: "",
  phone: "",
  email: "",
  invoice_prefix: "",
  is_active: true,
  is_default: false,
  aato_over_10cr: false,
};

const fieldClass =
  "border-[#2a2d34] bg-[#111214] text-zinc-100 placeholder:text-zinc-600";

interface SoyaCompaniesManagerProps {
  companies: SoyaCompany[];
  activeId: string;
}

export function SoyaCompaniesManager({
  companies,
  activeId,
}: SoyaCompaniesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<SoyaCompany | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<SoyaCompany | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Checked as you type so a bad GSTIN is caught at the keyboard, not on save.
  const gstinCheck = useMemo(
    () => (form.gstin.trim() ? checkGstin(form.gstin) : null),
    [form.gstin],
  );

  const openCreate = () => {
    setForm(EMPTY);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (company: SoyaCompany) => {
    setForm({
      name: company.name,
      legal_name: company.legal_name,
      gstin: company.gstin,
      state_code: company.state_code,
      address: company.address,
      place: company.place,
      pincode: company.pincode,
      phone: company.phone,
      email: company.email,
      invoice_prefix: company.invoice_prefix,
      is_active: company.is_active,
      is_default: company.is_default,
      aato_over_10cr: company.aato_over_10cr ?? false,
    });
    setCreating(false);
    setEditing(company);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const save = () => {
    // The state is what decides CGST+SGST against IGST, so it cannot be left
    // blank; when a valid GSTIN is present it is taken from there.
    const derived = gstinCheck?.valid ? gstinCheck.stateCode : form.state_code;
    const payload = { ...form, state_code: derived };

    startTransition(async () => {
      try {
        if (editing) {
          await updateSoyaCompanyAction(editing.id, payload);
          toast.success(`${form.name} updated`);
        } else {
          await createSoyaCompanyAction(payload);
          toast.success(`${form.name} added`);
        }
        close();
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save the company",
        );
      }
    });
  };

  const remove = (company: SoyaCompany) => {
    startTransition(async () => {
      try {
        await deleteSoyaCompanyAction(company.id);
        toast.success(`${company.name} deleted`);
        setDeleteTarget(null);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not delete",
        );
      }
    });
  };

  const open = (company: SoyaCompany) => {
    startTransition(async () => {
      try {
        await setActiveSoyaCompanyAction(company.id);
        toast.success(`Switched to ${company.name}`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not switch",
        );
      }
    });
  };

  const dialogOpen = creating || editing !== null;
  const canSave =
    form.name.trim().length > 0 &&
    (!form.gstin.trim() || Boolean(gstinCheck?.valid)) &&
    Boolean(gstinCheck?.valid || form.state_code);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {companies.length === 0
            ? "No companies yet."
            : `${companies.length} ${companies.length === 1 ? "company" : "companies"}.`}{" "}
          Each has its own GSTIN, invoice series and ledgers.
        </p>
        <Button
          onClick={openCreate}
          className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Company
        </Button>
      </div>

      {companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2a2d34] bg-[#14161b] px-6 py-14 text-center">
          <Building2 className="mx-auto h-8 w-8 text-zinc-600" />
          <h2 className="mt-3 text-lg font-semibold text-zinc-200">
            Add the firm you invoice from
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Everything in Soya — factories, parties, bills — belongs to a
            company. Add one to begin.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((company) => {
            const isOpen = company.id === activeId;
            const check = company.gstin ? checkGstin(company.gstin) : null;
            return (
              <div
                key={company.id}
                className={cn(
                  "flex flex-col rounded-xl border bg-linear-to-b from-[#17191f] to-[#14161b] p-4 shadow-[0_12px_30px_rgba(0,0,0,0.3)]",
                  isOpen ? "border-[#ff6a3d]/50" : "border-[#1f2229]",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-zinc-100">
                      {company.name}
                    </h3>
                    {company.legal_name ? (
                      <p className="truncate text-xs text-zinc-500">
                        {company.legal_name}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {company.is_default ? (
                      <span title="Default company">
                        <Star className="h-3.5 w-3.5 fill-[#f6c18a] text-[#f6c18a]" />
                      </span>
                    ) : null}
                    {isOpen ? (
                      <span className="rounded bg-[#ff6a3d]/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ff8f6b]">
                        Open
                      </span>
                    ) : null}
                  </div>
                </div>

                <dl className="mt-3 space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-500">GSTIN</dt>
                    <dd className="font-mono text-zinc-300">
                      {company.gstin || "—"}
                      {check && !check.valid ? (
                        <span className="ml-2 rounded bg-[#3b1b1b] px-1.5 py-0.5 font-sans text-[10px] text-[#f5a3a3]">
                          {check.reason}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-500">State</dt>
                    <dd className="text-zinc-300">
                      {company.state_code
                        ? `${stateNameForCode(company.state_code)} · ${company.state_code}`
                        : "—"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-zinc-500">Bills</dt>
                    <dd className="text-zinc-300">
                      {company.invoice_prefix
                        ? `${company.invoice_prefix}/…`
                        : "—"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 flex items-center gap-2 border-t border-[#23262d] pt-3">
                  {!isOpen && company.is_active ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => open(company)}
                      className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
                    >
                      <Check className="mr-1.5 h-3.5 w-3.5" />
                      Open
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => openEdit(company)}
                    className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => setDeleteTarget(company)}
                    className="ml-auto border-[#3b1b1b] bg-[#1a1111] text-[#f5a3a3] hover:bg-[#241414]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(value) => !value && close()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#2a2d34] bg-[#15171c] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              {editing ? `Edit ${editing.name}` : "Add Company"}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              The legal name, GSTIN and address print on every tax invoice this
              company raises.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="sm:col-span-1">
              <Label className="text-zinc-300">Short name *</Label>
              <Input
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="SREE GURU TRADING"
                className={fieldClass}
              />
            </div>
            <div className="sm:col-span-1">
              <Label className="text-zinc-300">Invoice prefix</Label>
              <Input
                value={form.invoice_prefix}
                onChange={(event) => set("invoice_prefix", event.target.value)}
                placeholder="SGT"
                className={fieldClass}
              />
            </div>

            <div className="sm:col-span-2">
              <Label className="text-zinc-300">Legal name</Label>
              <Input
                value={form.legal_name}
                onChange={(event) => set("legal_name", event.target.value)}
                placeholder="SREE GURU TRADING Co."
                className={fieldClass}
              />
            </div>

            <div className="sm:col-span-1">
              <Label className="text-zinc-300">GSTIN</Label>
              <Input
                value={form.gstin}
                onChange={(event) =>
                  set("gstin", event.target.value.toUpperCase())
                }
                placeholder="29CVOPS8598C1ZJ"
                maxLength={15}
                className={cn(fieldClass, "font-mono")}
              />
              {gstinCheck ? (
                <p
                  className={cn(
                    "mt-1 text-xs",
                    gstinCheck.valid ? "text-[#7ee2b8]" : "text-[#f5a3a3]",
                  )}
                >
                  {gstinCheck.valid
                    ? `Valid · ${gstinCheck.stateName}`
                    : gstinCheck.reason}
                </p>
              ) : null}
            </div>

            <div className="sm:col-span-1">
              <Label className="text-zinc-300">State *</Label>
              <select
                value={
                  gstinCheck?.valid ? gstinCheck.stateCode : form.state_code
                }
                onChange={(event) => set("state_code", event.target.value)}
                disabled={Boolean(gstinCheck?.valid)}
                className="mt-1 h-9 w-full cursor-pointer rounded-md border border-[#2a2d34] bg-[#111214] px-2 text-sm text-zinc-100 outline-none disabled:cursor-not-allowed disabled:opacity-70"
              >
                <option value="">Select a state…</option>
                {GST_STATE_OPTIONS.map((state) => (
                  <option key={state.code} value={state.code}>
                    {state.name} · {state.code}
                  </option>
                ))}
              </select>
              {gstinCheck?.valid ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Taken from the GSTIN.
                </p>
              ) : null}
            </div>

            <div className="sm:col-span-2">
              <Label className="text-zinc-300">Address</Label>
              <Input
                value={form.address}
                onChange={(event) => set("address", event.target.value)}
                placeholder="TM ROAD HONNALI"
                className={fieldClass}
              />
            </div>

            <div>
              <Label className="text-zinc-300">Place</Label>
              <Input
                value={form.place}
                onChange={(event) => set("place", event.target.value)}
                placeholder="Honnali"
                className={fieldClass}
              />
            </div>
            <div>
              <Label className="text-zinc-300">Pincode</Label>
              <Input
                value={form.pincode}
                onChange={(event) =>
                  set("pincode", event.target.value.replace(/\D/g, ""))
                }
                placeholder="577217"
                maxLength={6}
                inputMode="numeric"
                className={cn(fieldClass, "font-mono")}
              />
            </div>

            <div>
              <Label className="text-zinc-300">Phone</Label>
              <Input
                value={form.phone}
                onChange={(event) => set("phone", event.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <Label className="text-zinc-300">Email</Label>
              <Input
                value={form.email}
                onChange={(event) => set("email", event.target.value)}
                className={fieldClass}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => set("is_active", event.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[#ff6a3d]"
              />
              Active
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(event) => set("is_default", event.target.checked)}
                className="h-4 w-4 cursor-pointer accent-[#ff6a3d]"
              />
              Open this company by default
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.aato_over_10cr}
                onChange={(event) => set("aato_over_10cr", event.target.checked)}
                className="mt-0.5 h-4 w-4 cursor-pointer accent-[#ff6a3d]"
              />
              <span>
                Turnover is ₹10 crore or more
                <span className="mt-0.5 block text-xs text-zinc-500">
                  Only these filers must report an invoice to the portal within
                  30 days of its date. Below that there is no deadline.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={close}
              disabled={isPending}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={isPending || !canSave}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? "Saving…" : editing ? "Save changes" : "Add company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(value) => !value && setDeleteTarget(null)}
      >
        <DialogContent className="border-[#2a2d34] bg-[#15171c] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Delete company</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Delete {deleteTarget?.name}? This is refused if any factory, party
              or entry still belongs to it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={isPending}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isPending || !deleteTarget}
              onClick={() => deleteTarget && remove(deleteTarget)}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
