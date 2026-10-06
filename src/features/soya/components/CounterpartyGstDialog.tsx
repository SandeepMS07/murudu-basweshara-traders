"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { updateCounterpartyGstAction } from "@/app/soya/counterparties/actions";
import type {
  CounterpartyKind,
  SoyaCounterparty,
} from "@/features/soya/service/counterparty-gst.service";
import {
  checkGstin,
  GST_REGISTRATION_TYPES,
  GST_STATE_OPTIONS,
} from "@/features/soya/lib/gst";
import { cn } from "@/lib/utils";

const fieldClass =
  "border-[#2a2d34] bg-[#111214] text-zinc-100 placeholder:text-zinc-600";
const selectClass = cn("h-9 w-full cursor-pointer rounded-md border px-2 text-sm", fieldClass);

type FormState = {
  gstin: string;
  state_code: string;
  registration_type: string;
  address: string;
  place: string;
  pincode: string;
  phone: string;
};

function formFor(row: SoyaCounterparty): FormState {
  return {
    gstin: row.gstin,
    state_code: row.state_code,
    registration_type: row.registration_type,
    address: row.address,
    place: row.place,
    pincode: row.pincode,
    phone: row.phone,
  };
}

/**
 * Edits the GST identity of one factory / party. Writes only the GST columns
 * (through counterparty-gst.service), never the name, entries or payments the
 * trading ledger owns.
 */
export function CounterpartyGstDialog({
  kind,
  row,
  onClose,
}: {
  kind: CounterpartyKind;
  /** The record being edited; null keeps the dialog closed. */
  row: SoyaCounterparty | null;
  onClose: () => void;
}) {
  // Keyed on the record so the form resets each time a different one opens.
  return row ? <GstForm key={row.id} kind={kind} row={row} onClose={onClose} /> : null;
}

function GstForm({
  kind,
  row,
  onClose,
}: {
  kind: CounterpartyKind;
  row: SoyaCounterparty;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState | null>(() => formFor(row));

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  // Read into a local first: memoising on `form?.gstin` while the body reads
  // `form` makes the compiler infer a broader dependency than declared.
  const gstin = form?.gstin ?? "";
  const gstinCheck = useMemo(
    () => (gstin.trim() ? checkGstin(gstin) : null),
    [gstin],
  );

  const save = () => {
    if (!form) return;
    if (gstinCheck && !gstinCheck.valid) {
      toast.error(gstinCheck.reason);
      return;
    }
    startTransition(async () => {
      try {
        await updateCounterpartyGstAction(kind, row.id, form);
        toast.success(`${row.name} updated`);
        onClose();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save");
      }
    });
  };

  return (
      <Dialog open={Boolean(row)} onOpenChange={(next) => (next ? null : onClose())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#2a2d34] bg-[#14161b] text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{row?.name}</DialogTitle>
            <DialogDescription className="text-zinc-500">
              The GSTIN decides which tax applies. Changing it here does not
              change any invoice already issued — those keep their own copy.
            </DialogDescription>
          </DialogHeader>

          {form ? (
            <div className="grid gap-4 py-2">
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
              onClick={onClose}
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
  );
}
