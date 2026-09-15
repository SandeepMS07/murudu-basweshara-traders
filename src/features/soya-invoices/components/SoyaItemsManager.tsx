"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
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
  createSoyaItemAction,
  deleteSoyaItemAction,
  updateSoyaItemAction,
} from "@/app/soya/items/actions";
import type { SoyaItem } from "@/features/soya-invoices/schemas";
import {
  HSN_SUGGESTIONS,
  isValidHsn,
  UQC_OPTIONS,
} from "@/features/soya/lib/einvoice-codes";
import { formatNumberIN } from "@/lib/number-format";
import { cn } from "@/lib/utils";

type FormState = {
  name: string;
  hsn: string;
  unit: string;
  gst_rate: string;
  default_rate: string;
  description: string;
  is_active: boolean;
};

const EMPTY: FormState = {
  name: "",
  hsn: "",
  unit: "MTS",
  gst_rate: "5",
  default_rate: "",
  description: "",
  is_active: true,
};

const fieldClass =
  "border-[#2a2d34] bg-[#111214] text-zinc-100 placeholder:text-zinc-600";

interface SoyaItemsManagerProps {
  items: SoyaItem[];
  companyId: string;
  companyName: string;
}

export function SoyaItemsManager({
  items,
  companyId,
  companyName,
}: SoyaItemsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<SoyaItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [deleteTarget, setDeleteTarget] = useState<SoyaItem | null>(null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  // Flagged as you type: a wrong HSN is only discovered at the portal
  // otherwise, by which point the invoice has already been rejected.
  const hsnProblem = useMemo(() => {
    if (!form.hsn.trim()) return "";
    return isValidHsn(form.hsn.trim()) ? "" : "HSN must be 4, 6 or 8 digits";
  }, [form.hsn]);

  const openCreate = () => {
    setForm(EMPTY);
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (item: SoyaItem) => {
    setForm({
      name: item.name,
      hsn: item.hsn,
      unit: item.unit,
      gst_rate: String(item.gst_rate),
      default_rate: item.default_rate ? String(item.default_rate) : "",
      description: item.description,
      is_active: item.is_active,
    });
    setCreating(false);
    setEditing(item);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    if (hsnProblem) {
      toast.error(hsnProblem);
      return;
    }

    const payload = {
      company_id: companyId,
      name: form.name,
      hsn: form.hsn.trim(),
      unit: form.unit,
      gst_rate: Number(form.gst_rate || 0),
      default_rate: Number(form.default_rate || 0),
      description: form.description,
      is_active: form.is_active,
    };

    startTransition(async () => {
      try {
        if (editing) {
          await updateSoyaItemAction(editing.id, payload);
          toast.success(`${form.name} updated`);
        } else {
          await createSoyaItemAction(payload);
          toast.success(`${form.name} added`);
        }
        close();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save the item");
      }
    });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        await deleteSoyaItemAction(deleteTarget.id);
        toast.success(`${deleteTarget.name} deleted`);
        setDeleteTarget(null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not delete the item");
      }
    });
  };

  const open = creating || Boolean(editing);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {items.length === 0
            ? "No items yet."
            : `${items.length} item${items.length === 1 ? "" : "s"} for ${companyName}.`}
        </p>
        <Button
          onClick={openCreate}
          className="cursor-pointer bg-[#ff6a3d] text-white hover:bg-[#ff7f57]"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2a2d34] bg-[#14161b] p-10 text-center">
          <Package className="mx-auto h-10 w-10 text-zinc-600" />
          <h2 className="mt-3 text-lg font-semibold text-zinc-200">
            Add what you sell
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Every invoice line needs an HSN code and a unit. The e-Invoice portal
            rejects a line without them, so they live here rather than being
            retyped on each invoice.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                "rounded-xl border border-[#2a2d34] bg-[#14161b] p-4 transition-colors",
                !item.is_active && "opacity-50",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-zinc-100">{item.name}</h3>
                  <p className="mt-0.5 font-mono text-xs text-zinc-500">
                    HSN {item.hsn || "—"} · {item.unit} · {item.gst_rate}% GST
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    aria-label={`Edit ${item.name}`}
                    className="cursor-pointer rounded-md p-1.5 text-zinc-500 hover:bg-[#1d2026] hover:text-zinc-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(item)}
                    aria-label={`Delete ${item.name}`}
                    className="cursor-pointer rounded-md p-1.5 text-zinc-500 hover:bg-[#2a1616] hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {item.default_rate > 0 ? (
                <p className="mt-2 text-sm text-zinc-400">
                  Default rate ₹{formatNumberIN(item.default_rate)} / {item.unit}
                </p>
              ) : null}
              {!item.hsn ? (
                <p className="mt-2 rounded-md border border-[#3d3418] bg-[#2a2412]/40 px-2 py-1 text-xs text-[#f7e3b0]">
                  No HSN — the portal will reject an invoice using this item.
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(next) => (next ? null : close())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#2a2d34] bg-[#14161b] text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.name}` : "Add item"}</DialogTitle>
            <DialogDescription className="text-zinc-500">
              HSN and unit are what the e-Invoice portal validates. Get them right
              once here and every invoice inherits them.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="item-name">Item name</Label>
              <Input
                id="item-name"
                value={form.name}
                onChange={(event) => set("name", event.target.value)}
                placeholder="SOYA MEAL"
                className={fieldClass}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="item-hsn">HSN code</Label>
              <Input
                id="item-hsn"
                value={form.hsn}
                onChange={(event) => set("hsn", event.target.value.replace(/\D/g, ""))}
                placeholder="2304"
                inputMode="numeric"
                className={cn(fieldClass, hsnProblem && "border-red-500/60")}
              />
              {hsnProblem ? (
                <p className="text-xs text-red-400">{hsnProblem}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {HSN_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion.hsn}
                      type="button"
                      title={suggestion.label}
                      onClick={() => set("hsn", suggestion.hsn)}
                      className="cursor-pointer rounded-full border border-[#2a2d34] px-2 py-0.5 font-mono text-[11px] text-zinc-400 hover:border-[#ff6a3d]/50 hover:text-[#ff8f6b]"
                    >
                      {suggestion.hsn}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="item-unit">Unit</Label>
                <select
                  id="item-unit"
                  value={form.unit}
                  onChange={(event) => set("unit", event.target.value)}
                  className={cn(
                    "h-9 cursor-pointer rounded-md border px-2 text-sm",
                    fieldClass,
                  )}
                >
                  {UQC_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.value}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="item-gst">GST rate %</Label>
                <Input
                  id="item-gst"
                  value={form.gst_rate}
                  onChange={(event) => set("gst_rate", event.target.value)}
                  inputMode="decimal"
                  className={fieldClass}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="item-rate">Default rate</Label>
                <Input
                  id="item-rate"
                  value={form.default_rate}
                  onChange={(event) => set("default_rate", event.target.value)}
                  placeholder="54190"
                  inputMode="decimal"
                  className={fieldClass}
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="item-desc">Description on the invoice</Label>
              <Input
                id="item-desc"
                value={form.description}
                onChange={(event) => set("description", event.target.value)}
                placeholder="Leave blank to print the item name"
                className={fieldClass}
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => set("is_active", event.target.checked)}
                className="cursor-pointer accent-[#ff6a3d]"
              />
              Active — offered when adding an invoice line
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={close}
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
              {isPending ? "Saving…" : editing ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => (next ? null : setDeleteTarget(null))}
      >
        <DialogContent className="border-[#2a2d34] bg-[#14161b] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Invoices that already used this item keep their own copy of the
              name, HSN and rate, so nothing already issued changes. If you only
              want to stop offering it, mark it inactive instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isPending}
              className="cursor-pointer text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={isPending}
              className="cursor-pointer bg-red-600 text-white hover:bg-red-500"
            >
              {isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
