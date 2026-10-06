"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  ArrowDownUp,
  BadgeCheck,
  Download,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import {
  assignUnassignedCounterpartiesAction,
  softDeleteCounterpartyAction,
} from "@/app/soya/counterparties/actions";
import type {
  CounterpartyKind,
  SoyaCounterparty,
} from "@/features/soya/service/counterparty-gst.service";
import {
  effectiveRegistrationType,
  GST_REGISTRATION_TYPES,
  stateNameForCode,
} from "@/features/soya/lib/gst";
import { CounterpartyGstDialog } from "./CounterpartyGstDialog";

/**
 * Master + payment ledger shared by both Soya modules, laid out as a list on
 * the left and the selected record on the right, so the page never grows with
 * the number of parties.
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
  /** Page heading, e.g. "Party master". */
  title: string;
  kind: CounterpartyKind;
  /** "Factory" / "Party" — used across headings, buttons and dialogs. */
  counterpartyLabel: string;
  counterparties: SoyaLedgerCounterparty[];
  /**
   * GST identity of the same records, by id. Null until the company layer is
   * migrated: the ledger then works as before, without the GST tab.
   */
  gstRows: SoyaCounterparty[] | null;
  activeCompanyId: string;
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
  /** "Total Paid" / "Total Received". */
  paidLabel: string;
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

/** Under half a rupee is rounding, not money owed. */
const EPSILON = 0.5;

type Filter = "all" | "pending" | "urd";
type Tab = "entries" | "payments" | "gst";

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

function plural(label: string) {
  const lower = label.toLowerCase();
  return lower.endsWith("y") ? `${lower.slice(0, -1)}ies` : `${lower}s`;
}

function registrationLabel(gst: SoyaCounterparty) {
  const type = effectiveRegistrationType(gst.gstin, gst.registration_type);
  return GST_REGISTRATION_TYPES.find((item) => item.value === type)?.label ?? type;
}

/** A balance as the books say it: owed, advance (overpaid) or settled. */
function Balance({ value, className }: { value: number; className?: string }) {
  if (value > EPSILON) {
    return <span className={cn("text-[#ff8f6b]", className)}>{money(value)}</span>;
  }
  if (value < -EPSILON) {
    return (
      <span className={cn("text-emerald-400", className)}>
        Advance {money(Math.abs(value))}
      </span>
    );
  }
  return <span className={cn("text-zinc-500", className)}>Settled</span>;
}

function GstBadge({ gst }: { gst: SoyaCounterparty | undefined }) {
  if (!gst) return null;
  return gst.gstin ? (
    <span className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-px text-[10px] font-medium text-emerald-300">
      <BadgeCheck className="h-3 w-3" />
      GST
    </span>
  ) : (
    <span
      title="Unregistered dealer (no GSTIN)"
      className="rounded border border-zinc-600/40 bg-zinc-500/10 px-1.5 py-px text-[10px] font-medium text-zinc-400"
    >
      URD
    </span>
  );
}

export function SoyaLedgerManager<T extends { id: string }>({
  title,
  kind,
  counterpartyLabel,
  counterparties,
  gstRows,
  activeCompanyId,
  entries,
  entryOwnerName,
  entryTotal,
  entryColumns,
  payments,
  showRemarks = false,
  billedLabel,
  paidLabel,
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("entries");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortBy, setSortBy] = useState<"balance" | "name">("balance");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<SoyaLedgerCounterparty | null>(null);
  const [gstEditing, setGstEditing] = useState<SoyaCounterparty | null>(null);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [bank, setBank] = useState("");
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [deletePaymentTarget, setDeletePaymentTarget] =
    useState<SoyaLedgerPayment | null>(null);

  const [statementOpen, setStatementOpen] = useState(false);
  const statementFrameRef = useRef<HTMLIFrameElement | null>(null);

  const noun = plural(counterpartyLabel);
  const balanceNoun = balanceLabel.replace(/^Balance\s+/i, "").toLowerCase();

  const gstById = useMemo(() => {
    const map = new Map<string, SoyaCounterparty>();
    for (const row of gstRows ?? []) map.set(row.id, row);
    return map;
  }, [gstRows]);

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

  const rows = useMemo(
    () =>
      counterparties.map((item) => {
        const billed = billedByName.get(item.name.trim().toLowerCase()) ?? 0;
        return { ...item, balance: billed - (paidById.get(item.id) ?? 0) };
      }),
    [counterparties, billedByName, paidById],
  );

  const summary = useMemo(
    () => ({
      owed: rows.reduce((sum, row) => sum + Math.max(row.balance, 0), 0),
      urd: gstRows ? gstRows.filter((row) => !row.gstin).length : 0,
      unassigned: gstRows ? gstRows.filter((row) => !row.company_id).length : 0,
    }),
    [rows, gstRows],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (filter === "pending" && !(row.balance > EPSILON)) return false;
        const gst = gstById.get(row.id);
        if (filter === "urd" && !(gst && !gst.gstin)) return false;
        if (!needle) return true;
        return (
          row.name.toLowerCase().includes(needle) ||
          (gst?.gstin ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) =>
        sortBy === "balance"
          ? b.balance - a.balance || a.name.localeCompare(b.name)
          : a.name.localeCompare(b.name),
      );
  }, [rows, query, filter, sortBy, gstById]);

  // A record hidden by the search or filter is not shown on the right either.
  const active = useMemo(
    () => visible.find((row) => row.id === activeId) ?? visible[0] ?? null,
    [visible, activeId],
  );
  const activeGst = active ? gstById.get(active.id) : undefined;

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

  const select = (id: string) => {
    setActiveId(id);
    setTab("entries");
  };

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
        // With the company layer in place a delete only hides the record
        // (deleted_at), so re-adding the name brings it back. Before that,
        // the ledger's own delete is all there is.
        if (gstRows) {
          const result = await softDeleteCounterpartyAction(kind, target.id);
          if (!result.success) {
            toast.error(result.message);
            return;
          }
        } else {
          await deleteAction(target.id);
        }
        toast.success(`${target.name} deleted`);
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

  const assignUnassigned = () => {
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
    "rounded-xl border border-[#1f2229] bg-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]";
  const thClassName =
    "whitespace-nowrap border-b border-[#252932] bg-[#15171c] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400";
  const tdClassName = "whitespace-nowrap border-b border-[#1c1f26] px-3 py-2";
  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    ...(gstRows ? [{ key: "urd" as const, label: "URD" }] : []),
  ];

  return (
    <div>
      {/* ------------------------------------------------------- header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            {title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-zinc-500">
            <span>
              {counterparties.length}{" "}
              {counterparties.length === 1 ? counterpartyLabel.toLowerCase() : noun}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              <span className="font-semibold tabular-nums text-[#ff8f6b]">
                {money(summary.owed)}
              </span>{" "}
              {balanceNoun}
            </span>
            {gstRows ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{summary.urd} URD</span>
              </>
            ) : null}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setEditingId(null);
            setNameDraft("");
            setFormOpen(true);
          }}
          className="h-9 cursor-pointer border border-[#ff6a3d] bg-[#ff6a3d] px-3 text-sm text-white hover:bg-[#ff5a28]"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add {counterpartyLabel.toLowerCase()}
        </Button>
      </div>

      {summary.unassigned > 0 && activeCompanyId ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#3d3418] bg-[#2a2412]/40 px-3 py-2 text-xs text-[#f7e3b0]">
          <span>
            {summary.unassigned} {summary.unassigned === 1 ? counterpartyLabel.toLowerCase() : noun}{" "}
            not assigned to any company yet.
          </span>
          <Button
            variant="outline"
            onClick={assignUnassigned}
            disabled={isPending}
            className="h-7 cursor-pointer border-[#3d3418] bg-transparent px-2 text-xs text-[#f7e3b0] hover:bg-[#2a2412]"
          >
            Assign to the open company
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* ------------------------------------------------- master list */}
        <section
          aria-label={`${counterpartyLabel} list`}
          className={cn(panelClassName, "flex flex-col overflow-hidden xl:sticky xl:top-4")}
        >
          <div className="space-y-2 border-b border-[#1f2229] p-3">
            <label className="flex h-9 items-center gap-2 rounded-md border border-[#2a2d34] bg-[#111214] px-2.5 focus-within:border-[#ff6a3d]/60">
              <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  gstRows
                    ? `Search ${counterpartyLabel.toLowerCase()} or GSTIN`
                    : `Search ${counterpartyLabel.toLowerCase()}`
                }
                aria-label={`Search ${noun}`}
                className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
            </label>
            <div className="flex items-center gap-1.5">
              {filters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={filter === item.key}
                  onClick={() => setFilter(item.key)}
                  className={cn(
                    "h-7 cursor-pointer rounded-full border px-3 text-xs transition-colors",
                    filter === item.key
                      ? "border-[#ff6a3d]/50 bg-[#ff6a3d]/12 text-[#ff8f6b]"
                      : "border-[#2a2d34] text-zinc-400 hover:text-zinc-100",
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setSortBy((current) => (current === "balance" ? "name" : "balance"))
                }
                className="ml-auto inline-flex h-7 cursor-pointer items-center gap-1 rounded-md px-1.5 text-xs text-zinc-400 hover:text-zinc-100"
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                Sort: {sortBy === "balance" ? "Balance" : "Name"}
              </button>
            </div>
          </div>

          <div className="max-h-[45vh] overflow-y-auto p-1.5 xl:max-h-[calc(100vh-250px)]">
            {visible.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-zinc-500">
                {counterparties.length === 0 ? (
                  <>No {noun} yet. Use “Add {counterpartyLabel.toLowerCase()}” to add one.</>
                ) : query.trim() ? (
                  <>
                    No {counterpartyLabel.toLowerCase()} matches “{query.trim()}”.{" "}
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="cursor-pointer text-[#ff8f6b] underline-offset-2 hover:underline"
                    >
                      Clear search
                    </button>
                  </>
                ) : (
                  <>No {noun} in this filter.</>
                )}
              </div>
            ) : (
              <ul className="space-y-0.5">
                {visible.map((row) => {
                  const gst = gstById.get(row.id);
                  const isActive = row.id === active?.id;
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => select(row.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                          isActive ? "bg-white/6" : "hover:bg-white/3",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            title={row.name}
                            className={cn(
                              "block truncate text-[13px] font-medium",
                              isActive ? "text-white" : "text-zinc-200",
                            )}
                          >
                            {row.name}
                          </span>
                          {gst ? (
                            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-500">
                              <GstBadge gst={gst} />
                              <span className="truncate">{gst.place || "—"}</span>
                            </span>
                          ) : null}
                        </span>
                        <Balance
                          value={row.balance}
                          className="shrink-0 text-xs font-medium tabular-nums"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* --------------------------------------------- detail / ledger */}
        <section aria-label={`${counterpartyLabel} details`} className={cn(panelClassName, "min-w-0")}>
          {!active ? (
            <div className="px-6 py-20 text-center text-sm text-zinc-500">
              Select a {counterpartyLabel.toLowerCase()} to see its entries and
              payments.
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold text-zinc-100 [overflow-wrap:anywhere]">
                    {active.name}
                  </h2>
                  {activeGst ? (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      {activeGst.gstin ? (
                        <span className="font-mono text-zinc-300">{activeGst.gstin}</span>
                      ) : null}
                      <GstBadge gst={activeGst} />
                      {activeGst.place || activeGst.state_code ? (
                        <span>
                          {[activeGst.place, stateNameForCode(activeGst.state_code)]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={exportEntries}
                    className="h-8 cursor-pointer border-[#2a2d34] bg-[#1b1e24] px-2.5 text-xs text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
                  >
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    Export
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStatementOpen(true)}
                    className="h-8 cursor-pointer border-[#2a2d34] bg-[#1b1e24] px-2.5 text-xs text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
                  >
                    <Receipt className="mr-1.5 h-3.5 w-3.5" />
                    Statement
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(active.id);
                      setNameDraft(active.name);
                      setFormOpen(true);
                    }}
                    aria-label={`Rename ${active.name}`}
                    title="Rename"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-400 hover:bg-white/6 hover:text-zinc-100"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(active)}
                    aria-label={`Delete ${active.name}`}
                    title="Delete"
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-zinc-400 hover:bg-[#2a1616] hover:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-[#252932] bg-[#15171c] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {billedLabel}
                  </div>
                  <div className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">
                    {money(totals.billed)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#252932] bg-[#15171c] px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                    {paidLabel}
                  </div>
                  <div className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-100">
                    {money(totals.paid)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#ff6a3d]/40 bg-[#ff6a3d]/10 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-[#ffb295]">
                    {balanceLabel}
                  </div>
                  <Balance
                    value={totals.balance}
                    className="mt-0.5 block text-lg font-semibold tabular-nums"
                  />
                </div>
              </div>

              <div role="tablist" className="flex gap-1 border-b border-[#252932]">
                {(
                  [
                    ["entries", "Entries", activeEntries.length],
                    ["payments", "Payments", activePayments.length],
                    ...(activeGst ? [["gst", "GST details", null] as const] : []),
                  ] as const
                ).map(([key, label, count]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={tab === key}
                    onClick={() => setTab(key)}
                    className={cn(
                      "-mb-px inline-flex cursor-pointer items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                      tab === key
                        ? "border-[#ff6a3d] text-zinc-100"
                        : "border-transparent text-zinc-500 hover:text-zinc-200",
                    )}
                  >
                    {label}
                    {count !== null ? (
                      <span className="rounded-full bg-white/6 px-1.5 text-[11px] tabular-nums text-zinc-400">
                        {count}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              {tab === "entries" ? (
                <div className="overflow-x-auto rounded-lg border border-[#252932]">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        {entryColumns.map((column, index) => (
                          <th
                            key={`${column.label}-${index}`}
                            className={cn(
                              thClassName,
                              column.align === "right" ? "text-right" : "text-left",
                            )}
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
                            No entries for this {counterpartyLabel.toLowerCase()}.
                          </td>
                        </tr>
                      ) : (
                        activeEntries.map((entry) => (
                          <tr key={entry.id} className="text-zinc-200 hover:bg-white/2">
                            {entryColumns.map((column, index) => (
                              <td
                                key={`${column.label}-${index}`}
                                className={cn(
                                  tdClassName,
                                  column.align === "right" && "text-right tabular-nums",
                                )}
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
              ) : tab === "payments" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-zinc-500">
                      {activePayments.length} payment
                      {activePayments.length === 1 ? "" : "s"} ·{" "}
                      <span className="tabular-nums">{money(totals.paid)}</span>
                    </span>
                    <Button
                      type="button"
                      onClick={() => setPaymentOpen(true)}
                      className="h-8 cursor-pointer border border-[#ff6a3d] bg-[#ff6a3d] px-3 text-xs text-white hover:bg-[#ff5a28]"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Record payment
                    </Button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-[#252932]">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          <th className={cn(thClassName, "text-left")}>SL NO</th>
                          <th className={cn(thClassName, "text-left")}>DATE</th>
                          <th className={cn(thClassName, "text-left")}>BANK</th>
                          <th className={cn(thClassName, "text-right")}>AMOUNT</th>
                          {showRemarks ? (
                            <th className={cn(thClassName, "text-left")}>REMRKS</th>
                          ) : null}
                          <th className={cn(thClassName, "w-12")}>
                            <span className="sr-only">Actions</span>
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
                            <tr key={payment.id} className="text-zinc-200 hover:bg-white/2">
                              <td className={tdClassName}>{index + 1}</td>
                              <td className={tdClassName}>{formatDate(payment.paid_on)}</td>
                              <td className={tdClassName}>{payment.bank || "-"}</td>
                              <td className={cn(tdClassName, "text-right tabular-nums")}>
                                {money(payment.amount)}
                              </td>
                              {showRemarks ? (
                                <td className={cn(tdClassName, "whitespace-normal")}>
                                  {payment.remarks || "-"}
                                </td>
                              ) : null}
                              <td className={cn(tdClassName, "text-right")}>
                                <button
                                  type="button"
                                  onClick={() => setDeletePaymentTarget(payment)}
                                  aria-label="Delete payment"
                                  title="Delete payment"
                                  className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-zinc-500 hover:bg-[#2a1616] hover:text-red-300"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : activeGst ? (
                <div className="space-y-4">
                  <dl className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
                    {(
                      [
                        ["GSTIN", activeGst.gstin || "—", true],
                        [
                          "Registration",
                          registrationLabel(activeGst),
                          false,
                        ],
                        ["State", stateNameForCode(activeGst.state_code) || "—", false],
                        ["Address", activeGst.address || "—", false],
                        ["Place", activeGst.place || "—", false],
                        ["Pincode", activeGst.pincode || "—", false],
                        ["Phone", activeGst.phone || "—", false],
                      ] as const
                    ).map(([label, value, mono]) => (
                      <div key={label} className="contents">
                        <dt className="text-zinc-500">{label}</dt>
                        <dd className={cn("text-zinc-200 [overflow-wrap:anywhere]", mono && "font-mono")}>
                          {value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {!activeGst.gstin ? (
                    <p className="rounded-md border border-[#3d3418] bg-[#2a2412]/40 px-3 py-2 text-xs text-[#f7e3b0]">
                      No GSTIN, so this {counterpartyLabel.toLowerCase()} is treated as
                      URD (unregistered dealer). If it is registered, add the GSTIN
                      before invoicing it.
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setGstEditing(activeGst)}
                    className="h-8 cursor-pointer border-[#2a2d34] bg-[#1b1e24] px-3 text-xs text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit GST details
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      <CounterpartyGstDialog
        kind={kind}
        row={gstEditing}
        onClose={() => setGstEditing(null)}
      />

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
            <DialogTitle>Delete {deleteTarget?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Delete <span className="font-semibold">{deleteTarget?.name}</span>?{" "}
            {gstRows
              ? `It will be removed from this company's ${counterpartyLabel.toLowerCase()} list and dropdowns. A ${counterpartyLabel.toLowerCase()} that still has bills or payments here cannot be deleted. Adding the same name again brings it back.`
              : "This is blocked while it still has entries."}
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
              className="bg-red-600 text-white hover:bg-red-500"
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
