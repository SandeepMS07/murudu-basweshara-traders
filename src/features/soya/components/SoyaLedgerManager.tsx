"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { Download, Printer, Receipt } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyINR } from "@/lib/number-format";
import { exportRowsToCsv } from "@/lib/excel/client-export";
import { printIframeAs } from "@/lib/print-iframe";

/**
 * Master + payment ledger shared by both Soya modules.
 *
 * Factory and Parties differ only in their entry columns, whether payments
 * carry a REMRKS field, and the payable/receivable wording — so this is one
 * component driven by a column spec rather than two near-identical copies. The
 * maize CompaniesManager / BiltyPartiesManager are not reused because the Soya
 * record shapes come from the customer's workbook and no longer match maize's.
 */
export type SoyaLedgerColumn<T> = {
  label: string;
  value: (row: T) => string;
  align?: "left" | "right";
};

export type SoyaLedgerCounterparty = { id: string; name: string };

export type SoyaLedgerPayment = {
  id: string;
  ownerId: string;
  paid_on: string;
  bank: string;
  amount: number;
  remarks?: string;
};

export type SoyaLedgerPaymentDraft = {
  ownerId: string;
  paid_on: string;
  bank: string;
  amount: number;
  remarks: string;
};

interface SoyaLedgerManagerProps<T extends { id: string }> {
  /** "Factory" / "Party" — used across headings, buttons and dialogs. */
  counterpartyLabel: string;
  counterparties: SoyaLedgerCounterparty[];
  entries: T[];
  /** Entries store the counterparty name, so matching is by name. */
  entryOwnerName: (entry: T) => string;
  /** The invoice total for an entry (workbook column 12 / 23). */
  entryTotal: (entry: T) => number;
  entryColumns: SoyaLedgerColumn<T>[];
  payments: SoyaLedgerPayment[];
  showRemarks?: boolean;
  /** "Total Purchases" / "Total Sales". */
  billedLabel: string;
  /** "Balance Payable" / "Balance Receivable". */
  balanceLabel: string;
  /** Statement route base; `${base}/${id}/statement` must exist. */
  statementHrefBase: string;
  exportFilePrefix: string;
  createAction: (name: string) => Promise<void>;
  updateAction: (id: string, name: string) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
  createPaymentAction: (draft: SoyaLedgerPaymentDraft) => Promise<void>;
  deletePaymentAction: (id: string) => Promise<void>;
}

const money = (value: number) =>
  formatCurrencyINR(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

function formatDate(value: string) {
  try {
    return format(parseISO(value), "dd-MM-yyyy");
  } catch {
    return value;
  }
}

export function SoyaLedgerManager<T extends { id: string }>({
  counterpartyLabel,
  counterparties,
  entries,
  entryOwnerName,
  entryTotal,
  entryColumns,
  payments,
  showRemarks = false,
  billedLabel,
  balanceLabel,
  statementHrefBase,
  exportFilePrefix,
  createAction,
  updateAction,
  deleteAction,
  createPaymentAction,
  deletePaymentAction,
}: SoyaLedgerManagerProps<T>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(
    counterparties[0]?.id ?? null,
  );
  const [tab, setTab] = useState<"entries" | "ledger">("entries");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<SoyaLedgerCounterparty | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [deletePaymentTarget, setDeletePaymentTarget] =
    useState<SoyaLedgerPayment | null>(null);

  const [statementOpen, setStatementOpen] = useState(false);
  const statementFrameRef = useRef<HTMLIFrameElement | null>(null);

  const active = useMemo(
    () => counterparties.find((item) => item.id === activeId) ?? null,
    [counterparties, activeId],
  );

  const activeEntries = useMemo(() => {
    if (!active) return [];
    const normalized = active.name.trim().toLowerCase();
    return entries.filter(
      (entry) => entryOwnerName(entry).trim().toLowerCase() === normalized,
    );
  }, [active, entries, entryOwnerName]);

  const activePayments = useMemo(() => {
    if (!active) return [];
    return payments.filter((payment) => payment.ownerId === active.id);
  }, [active, payments]);

  const totals = useMemo(() => {
    const billed = activeEntries.reduce(
      (sum, entry) => sum + entryTotal(entry),
      0,
    );
    const paid = activePayments.reduce((sum, item) => sum + item.amount, 0);
    return { billed, paid, balance: billed - paid };
  }, [activeEntries, activePayments, entryTotal]);

  /** Billed totals per counterparty, so the master list can show balances. */
  const billedByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      const key = entryOwnerName(entry).trim().toLowerCase();
      map.set(key, (map.get(key) ?? 0) + entryTotal(entry));
    }
    return map;
  }, [entries, entryOwnerName, entryTotal]);

  const paidById = useMemo(() => {
    const map = new Map<string, number>();
    for (const payment of payments) {
      map.set(payment.ownerId, (map.get(payment.ownerId) ?? 0) + payment.amount);
    }
    return map;
  }, [payments]);

  const submitName = () => {
    const name = nameDraft.trim();
    if (!name) {
      toast.error(`Enter a ${counterpartyLabel.toLowerCase()} name`);
      return;
    }
    startTransition(async () => {
      try {
        if (editingId) {
          await updateAction(editingId, name);
          toast.success(`${counterpartyLabel} updated`);
        } else {
          await createAction(name);
          toast.success(`${counterpartyLabel} added`);
        }
        setFormOpen(false);
        setEditingId(null);
        setNameDraft("");
        router.refresh();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to save ${counterpartyLabel.toLowerCase()}`,
        );
      }
    });
  };

  const confirmDelete = () => {
    const target = deleteTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deleteAction(target.id);
        toast.success(`${counterpartyLabel} deleted`);
        if (activeId === target.id) setActiveId(null);
        setDeleteTarget(null);
        router.refresh();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : `Failed to delete ${counterpartyLabel.toLowerCase()}`,
        );
      }
    });
  };

  const submitPayment = () => {
    if (!active) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Enter an amount greater than zero");
      return;
    }
    if (!paidOn) {
      toast.error("Enter a payment date");
      return;
    }
    startTransition(async () => {
      try {
        await createPaymentAction({
          ownerId: active.id,
          paid_on: paidOn,
          bank: bank.trim(),
          amount: parsedAmount,
          remarks: remarks.trim(),
        });
        toast.success("Payment recorded");
        setPaymentOpen(false);
        setAmount("");
        setBank("");
        setRemarks("");
        router.refresh();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to record payment",
        );
      }
    });
  };

  const confirmDeletePayment = () => {
    const target = deletePaymentTarget;
    if (!target) return;
    startTransition(async () => {
      try {
        await deletePaymentAction(target.id);
        toast.success("Payment deleted");
        setDeletePaymentTarget(null);
        router.refresh();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete payment",
        );
      }
    });
  };

  const exportEntries = () => {
    if (!active) return;
    exportRowsToCsv(
      activeEntries.map((entry) =>
        Object.fromEntries(
          entryColumns.map((column) => [column.label, column.value(entry)]),
        ),
      ),
      {
        fileName: `${exportFilePrefix}-${active.name
          .replace(/\s+/g, "-")
          .toLowerCase()}`,
      },
    );
  };

  const printStatement = () => {
    if (!active) return;
    printIframeAs(
      statementFrameRef.current?.contentWindow,
      `${active.name} Statement ${format(new Date(), "dd-MM-yyyy")}`,
    );
  };

  const panelClassName =
    "border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]";

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_1fr]">
      {/* ------------------------------------------------- master list */}
      <Card className={panelClassName}>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            {counterpartyLabel} Master
          </h2>
          <Button
            type="button"
            onClick={() => {
              setEditingId(null);
              setNameDraft("");
              setFormOpen(true);
            }}
            className="h-8 border border-[#ff6a3d] bg-[#ff6a3d] px-3 text-xs text-white hover:bg-[#ff5a28]"
          >
            Add
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {counterparties.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">
              No {counterpartyLabel.toLowerCase()} records yet.
            </p>
          ) : (
            <ul className="max-h-[70vh] space-y-1 overflow-y-auto pr-1">
              {counterparties.map((item) => {
                const billed =
                  billedByName.get(item.name.trim().toLowerCase()) ?? 0;
                const balance = billed - (paidById.get(item.id) ?? 0);
                const isActive = item.id === activeId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${
                        isActive
                          ? "border-[#ff6a3d]/40 bg-[#ff6a3d]/14 text-[#ff8f6b]"
                          : "border-transparent text-zinc-300 hover:bg-[#181a1f]"
                      }`}
                    >
                      <div className="truncate text-sm font-medium">
                        {item.name}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">
                        {balanceLabel}: {money(balance)}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* --------------------------------------------- detail / ledger */}
      <Card className={panelClassName}>
        {!active ? (
          <CardContent className="py-16 text-center text-sm text-zinc-500">
            Select a {counterpartyLabel.toLowerCase()} to see its entries and
            payments.
          </CardContent>
        ) : (
          <>
            <CardHeader className="gap-3 pb-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-zinc-100">
                    {active.name}
                  </h2>
                  <p className="text-xs text-zinc-500">
                    {activeEntries.length} entr
                    {activeEntries.length === 1 ? "y" : "ies"} ·{" "}
                    {activePayments.length} payment
                    {activePayments.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(active.id);
                      setNameDraft(active.name);
                      setFormOpen(true);
                    }}
                    className="h-9 border-[#2a2d34] bg-[#1b1e24] text-xs text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
                  >
                    Rename
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDeleteTarget(active)}
                    className="h-9 border-[#3b2323] bg-[#1a1111] text-xs text-red-200 hover:bg-[#231616]"
                  >
                    Delete
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={exportEntries}
                    className="h-9 border-[#2a2d34] bg-[#1b1e24] text-xs text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStatementOpen(true)}
                    className="h-9 border border-[#2a2d34] bg-[#17191f] px-3 text-xs text-zinc-100 hover:bg-[#1d2026]"
                  >
                    <Receipt className="mr-1.5 h-3.5 w-3.5" />
                    Statement
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-[#252932] bg-[#15171c] p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {billedLabel}
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-zinc-100">
                    {money(totals.billed)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#252932] bg-[#15171c] p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    Total Paid
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-zinc-100">
                    {money(totals.paid)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#ff6a3d]/40 bg-[#ff6a3d]/10 p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-[#ffb295]">
                    {balanceLabel}
                  </div>
                  <div className="mt-0.5 text-lg font-semibold text-[#ff8f6b]">
                    {money(totals.balance)}
                  </div>
                </div>
              </div>

              <div className="flex gap-1 border-b border-[#252932]">
                {(["entries", "ledger"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
                      tab === key
                        ? "border-[#ff6a3d] text-[#ff8f6b]"
                        : "border-transparent text-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    {key === "entries" ? "Entries" : "Payment Ledger"}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="pt-2">
              {tab === "entries" ? (
                <div className="overflow-x-auto rounded-lg border border-[#252932]">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#15171c] text-zinc-400">
                        {entryColumns.map((column) => (
                          <th
                            key={column.label}
                            className={`whitespace-nowrap border-b border-[#252932] px-3 py-2 font-semibold uppercase tracking-wide ${
                              column.align === "right"
                                ? "text-right"
                                : "text-left"
                            }`}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {activeEntries.length === 0 ? (
                        <tr>
                          <td
                            colSpan={entryColumns.length}
                            className="px-3 py-8 text-center text-zinc-500"
                          >
                            No entries for this{" "}
                            {counterpartyLabel.toLowerCase()}.
                          </td>
                        </tr>
                      ) : (
                        activeEntries.map((entry) => (
                          <tr key={entry.id} className="text-zinc-200">
                            {entryColumns.map((column) => (
                              <td
                                key={column.label}
                                className={`whitespace-nowrap border-b border-[#1c1f26] px-3 py-2 ${
                                  column.align === "right" ? "text-right" : ""
                                }`}
                              >
                                {column.value(entry)}
                              </td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => setPaymentOpen(true)}
                      className="h-9 border border-[#ff6a3d] bg-[#ff6a3d] px-3 text-xs text-white hover:bg-[#ff5a28]"
                    >
                      Add Payment
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-[#252932]">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#15171c] text-zinc-400">
                          <th className="border-b border-[#252932] px-3 py-2 text-left font-semibold uppercase tracking-wide">
                            SL NO
                          </th>
                          <th className="border-b border-[#252932] px-3 py-2 text-left font-semibold uppercase tracking-wide">
                            DATE
                          </th>
                          <th className="border-b border-[#252932] px-3 py-2 text-left font-semibold uppercase tracking-wide">
                            BANK
                          </th>
                          <th className="border-b border-[#252932] px-3 py-2 text-right font-semibold uppercase tracking-wide">
                            AMOUNT
                          </th>
                          {showRemarks ? (
                            <th className="border-b border-[#252932] px-3 py-2 text-left font-semibold uppercase tracking-wide">
                              REMRKS
                            </th>
                          ) : null}
                          <th className="border-b border-[#252932] px-3 py-2 text-right font-semibold uppercase tracking-wide">
                            ACTIONS
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activePayments.length === 0 ? (
                          <tr>
                            <td
                              colSpan={showRemarks ? 6 : 5}
                              className="px-3 py-8 text-center text-zinc-500"
                            >
                              No payments recorded.
                            </td>
                          </tr>
                        ) : (
                          activePayments.map((payment, index) => (
                            <tr key={payment.id} className="text-zinc-200">
                              <td className="border-b border-[#1c1f26] px-3 py-2">
                                {index + 1}
                              </td>
                              <td className="whitespace-nowrap border-b border-[#1c1f26] px-3 py-2">
                                {formatDate(payment.paid_on)}
                              </td>
                              <td className="border-b border-[#1c1f26] px-3 py-2">
                                {payment.bank || "-"}
                              </td>
                              <td className="whitespace-nowrap border-b border-[#1c1f26] px-3 py-2 text-right">
                                {money(payment.amount)}
                              </td>
                              {showRemarks ? (
                                <td className="border-b border-[#1c1f26] px-3 py-2">
                                  {payment.remarks || "-"}
                                </td>
                              ) : null}
                              <td className="border-b border-[#1c1f26] px-3 py-2 text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  onClick={() => setDeletePaymentTarget(payment)}
                                  className="h-7 px-2 text-xs text-red-300 hover:bg-[#231616] hover:text-red-200"
                                >
                                  Delete
                                </Button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>

      {/* ------------------------------------------------------ dialogs */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100">
          <DialogHeader>
            <DialogTitle>
              {editingId ? `Rename ${counterpartyLabel}` : `Add ${counterpartyLabel}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-zinc-400">
              Name
            </label>
            <Input
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
              placeholder={`${counterpartyLabel} name`}
              className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
            />
            {editingId ? (
              <p className="text-xs text-zinc-500">
                Renaming also updates the name stored on every existing entry.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setFormOpen(false)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={submitName}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Delete {counterpartyLabel}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Delete <span className="font-semibold">{deleteTarget?.name}</span>?
            This is blocked while it still has entries.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDeleteTarget(null)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={confirmDelete}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Add Payment — {active?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wide text-zinc-400">
                Date
              </label>
              <Input
                type="date"
                value={paidOn}
                onChange={(event) => setPaidOn(event.target.value)}
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wide text-zinc-400">
                Bank
              </label>
              <Input
                value={bank}
                onChange={(event) => setBank(event.target.value)}
                placeholder="e.g. HDFC"
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wide text-zinc-400">
                Amount
              </label>
              <Input
                type="number"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0"
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
              />
            </div>
            {showRemarks ? (
              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wide text-zinc-400">
                  Remrks
                </label>
                <Input
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Optional"
                  className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setPaymentOpen(false)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={submitPayment}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? "Saving..." : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletePaymentTarget}
        onOpenChange={(open) => !open && setDeletePaymentTarget(null)}
      >
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Delete Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Delete the payment of{" "}
            <span className="font-semibold">
              {deletePaymentTarget ? money(deletePaymentTarget.amount) : ""}
            </span>
            ? This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDeletePaymentTarget(null)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={confirmDeletePayment}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent className="max-w-5xl border border-[#2a2d34] bg-[#15171c] p-0 text-zinc-100">
          <DialogHeader className="flex flex-row items-center justify-between gap-2 border-b border-[#252932] px-4 py-3">
            <DialogTitle className="text-base">
              Statement — {active?.name}
            </DialogTitle>
            <Button
              type="button"
              onClick={printStatement}
              className="h-9 border border-[#ff6a3d] bg-[#ff6a3d] px-3 text-xs text-white hover:bg-[#ff5a28]"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
          </DialogHeader>
          {active ? (
            <iframe
              ref={statementFrameRef}
              title={`${active.name} statement`}
              src={`${statementHrefBase}/${active.id}/statement?embed=1`}
              className="h-[70vh] w-full bg-white"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
