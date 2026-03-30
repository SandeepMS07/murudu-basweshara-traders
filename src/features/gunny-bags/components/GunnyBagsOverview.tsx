"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  createGunnyBagPartyAction,
  createGunnyBagPaymentAction,
  createGunnyBagPurchaseAction,
  deleteGunnyBagPaymentAction,
  deleteGunnyBagPurchaseAction,
  updateGunnyBagPartyAction,
  updateGunnyBagPaymentAction,
  updateGunnyBagPurchaseAction,
} from "@/app/gunny-bags/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import {
  GunnyPartyRow,
  GunnyPaymentRow,
  GunnyPurchaseOverviewRow,
  GunnyPurchaseRow,
} from "@/features/gunny-bags/service/gunny-bag.service";

interface GunnyBagsOverviewProps {
  purchases: GunnyPurchaseRow[];
  payments: GunnyPaymentRow[];
  purchaseOverview: GunnyPurchaseOverviewRow[];
  parties: GunnyPartyRow[];
  stockSummary: {
    totalBags: number;
    usedBags: number;
    leftBags: number;
  };
}

type PaymentModePreset = "RTGS" | "UPI" | "CASH" | "OTHER";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDateInputValue(value: string): string {
  if (!value) return todayISO();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (/^\d{2}-\d{2}-\d{4}$/.test(value)) {
    const [dd, mm, yyyy] = value.split("-");
    return `${yyyy}-${mm}-${dd}`;
  }
  return todayISO();
}

export function GunnyBagsOverview({
  purchases,
  payments,
  purchaseOverview,
  parties,
  stockSummary,
}: GunnyBagsOverviewProps) {
  type DataTab = "purchases" | "payments" | "purchaseSummary";

  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deletePurchaseDialogOpen, setDeletePurchaseDialogOpen] = useState(false);
  const [deletePaymentDialogOpen, setDeletePaymentDialogOpen] = useState(false);
  const [partyDialogOpen, setPartyDialogOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<GunnyPurchaseRow | null>(null);
  const [paymentToDelete, setPaymentToDelete] = useState<GunnyPaymentRow | null>(null);

  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [purchaseParty, setPurchaseParty] = useState("");
  const [purchaseBags, setPurchaseBags] = useState("");
  const [purchaseRate, setPurchaseRate] = useState("");

  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentParty, setPaymentParty] = useState("");
  const [paymentModePreset, setPaymentModePreset] = useState<PaymentModePreset>("RTGS");
  const [paymentModeOther, setPaymentModeOther] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [selectedSummaryParty, setSelectedSummaryParty] = useState("ALL");
  const [partyName, setPartyName] = useState("");
  const [partyContactPerson, setPartyContactPerson] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [partyPlace, setPartyPlace] = useState("");
  const [partyNotes, setPartyNotes] = useState("");
  const [activeTab, setActiveTab] = useState<DataTab>("purchases");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [pageByTab, setPageByTab] = useState<Record<DataTab, number>>({
    purchases: 1,
    payments: 1,
    purchaseSummary: 1,
  });

  const stats = useMemo(() => {
    const totalPurchase = purchases.reduce((sum, row) => sum + row.amount, 0);
    const totalPaid = payments.reduce((sum, row) => sum + row.amount, 0);
    const totalBalance = totalPurchase - totalPaid;
    return { totalPurchase, totalPaid, totalBalance };
  }, [payments, purchases]);

  const computedPurchaseAmount = useMemo(
    () => parseNumber(purchaseBags) * parseNumber(purchaseRate),
    [purchaseBags, purchaseRate]
  );

  const partyTabs = useMemo(() => {
    const names = new Set<string>([
      ...parties.map((party) => party.name),
      ...purchaseOverview.map((row) => row.party),
    ]);
    return ["ALL", ...[...names].sort((a, b) => a.localeCompare(b))];
  }, [parties, purchaseOverview]);

  const selectedPartyDetails = useMemo(
    () => parties.find((party) => party.name === selectedSummaryParty) ?? null,
    [parties, selectedSummaryParty]
  );

  const filteredPurchaseOverview = useMemo(
    () =>
      selectedSummaryParty === "ALL"
        ? purchaseOverview
        : purchaseOverview.filter((row) => row.party === selectedSummaryParty),
    [purchaseOverview, selectedSummaryParty]
  );

  const totalRowsByTab = useMemo<Record<DataTab, number>>(
    () => ({
      purchases: purchases.length,
      payments: payments.length,
      purchaseSummary: filteredPurchaseOverview.length,
    }),
    [filteredPurchaseOverview.length, payments.length, purchases.length]
  );

  const activeTotalRows = totalRowsByTab[activeTab];
  const totalPages = Math.max(1, Math.ceil(activeTotalRows / rowsPerPage));
  const currentPage = Math.min(pageByTab[activeTab], totalPages);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const pagedPurchases = purchases.slice(startIndex, endIndex);
  const pagedPayments = payments.slice(startIndex, endIndex);
  const pagedPurchaseOverview = filteredPurchaseOverview.slice(startIndex, endIndex);

  function updatePage(tab: DataTab, nextPage: number) {
    setPageByTab((prev) => ({ ...prev, [tab]: nextPage }));
  }

  function switchTab(tab: DataTab) {
    setActiveTab(tab);
  }

  function resetPartyForm() {
    setEditingPartyId(null);
    setPartyName("");
    setPartyContactPerson("");
    setPartyPhone("");
    setPartyPlace("");
    setPartyNotes("");
  }

  function openCreatePartyDialog() {
    resetPartyForm();
    setPartyDialogOpen(true);
  }

  function openEditPartyDialog(party: GunnyPartyRow | null) {
    if (!party) return;
    setEditingPartyId(party.id);
    setPartyName(party.name);
    setPartyContactPerson(party.contactPerson);
    setPartyPhone(party.phone);
    setPartyPlace(party.place);
    setPartyNotes(party.notes);
    setPartyDialogOpen(true);
  }

  function resetPurchaseForm() {
    setEditingPurchaseId(null);
    setPurchaseDate(todayISO());
    setPurchaseParty("");
    setPurchaseBags("");
    setPurchaseRate("");
  }

  function resetPaymentForm() {
    setEditingPaymentId(null);
    setPaymentDate(todayISO());
    setPaymentParty("");
    setPaymentModePreset("RTGS");
    setPaymentModeOther("");
    setPaymentAmount("");
  }

  function openCreatePurchaseDialog() {
    resetPurchaseForm();
    setPurchaseDialogOpen(true);
  }

  function openCreatePaymentDialog() {
    resetPaymentForm();
    setPaymentDialogOpen(true);
  }

  function openEditPurchaseDialog(row: GunnyPurchaseRow) {
    if (!row.id) return;
    setEditingPurchaseId(row.id);
    setPurchaseDate(toDateInputValue(row.date));
    setPurchaseParty(row.party);
    setPurchaseBags(String(row.bags));
    setPurchaseRate(String(row.rate));
    setPurchaseDialogOpen(true);
  }

  function openEditPaymentDialog(row: GunnyPaymentRow) {
    if (!row.id) return;
    setEditingPaymentId(row.id);
    setPaymentDate(toDateInputValue(row.date));
    setPaymentParty(row.party);
    const normalizedMode = String(row.mode ?? "").trim().toUpperCase();
    if (normalizedMode === "RTGS" || normalizedMode === "UPI" || normalizedMode === "CASH") {
      setPaymentModePreset(normalizedMode);
      setPaymentModeOther("");
    } else {
      setPaymentModePreset("OTHER");
      setPaymentModeOther(row.mode || "");
    }
    setPaymentAmount(String(row.amount));
    setPaymentDialogOpen(true);
  }

  function submitPurchase() {
    const bags = parseNumber(purchaseBags);
    const rate = parseNumber(purchaseRate);
    if (!purchaseDate) return toast.error("Purchase date is required");
    if (!purchaseParty.trim()) return toast.error("Purchase party is required");
    if (bags <= 0) return toast.error("Bags must be greater than zero");
    if (rate < 0) return toast.error("Rate must be zero or more");

    startTransition(async () => {
      try {
        const payload = {
          date: purchaseDate,
          party: purchaseParty.trim(),
          bags,
          rate,
          amount: Number(computedPurchaseAmount.toFixed(2)),
        };
        if (editingPurchaseId) {
          await updateGunnyBagPurchaseAction(editingPurchaseId, payload);
          toast.success("Purchase updated");
        } else {
          await createGunnyBagPurchaseAction(payload);
          toast.success("Purchase added");
        }
        setPurchaseDialogOpen(false);
        resetPurchaseForm();
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to save purchase");
      }
    });
  }

  function submitPayment() {
    const amount = parseNumber(paymentAmount);
    const resolvedMode = paymentModePreset === "OTHER" ? paymentModeOther.trim() : paymentModePreset;
    if (!paymentDate) return toast.error("Payment date is required");
    if (!paymentParty.trim()) return toast.error("Payment party is required");
    if (!resolvedMode) return toast.error("Payment mode is required");
    if (amount <= 0) return toast.error("Amount must be greater than zero");

    startTransition(async () => {
      try {
        const payload = {
          date: paymentDate,
          party: paymentParty.trim(),
          mode: resolvedMode,
          amount,
        };
        if (editingPaymentId) {
          await updateGunnyBagPaymentAction(editingPaymentId, payload);
          toast.success("Payment updated");
        } else {
          await createGunnyBagPaymentAction(payload);
          toast.success("Payment added");
        }
        setPaymentDialogOpen(false);
        resetPaymentForm();
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to save payment");
      }
    });
  }

  function submitParty() {
    if (!partyName.trim()) return toast.error("Party name is required");

    startTransition(async () => {
      try {
        const payload = {
          name: partyName.trim(),
          contactPerson: partyContactPerson.trim(),
          phone: partyPhone.trim(),
          place: partyPlace.trim(),
          notes: partyNotes.trim(),
        };

        if (editingPartyId) {
          await updateGunnyBagPartyAction(editingPartyId, payload);
          toast.success("Party details updated");
        } else {
          await createGunnyBagPartyAction(payload);
          toast.success("Party added");
        }

        setPartyDialogOpen(false);
        resetPartyForm();
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to save party");
      }
    });
  }

  function requestDeletePurchase(row: GunnyPurchaseRow) {
    if (!row.id) return;
    setPurchaseToDelete(row);
    setDeletePurchaseDialogOpen(true);
  }

  function deletePurchase(row: GunnyPurchaseRow) {
    const rowId = row.id;
    if (!rowId) return;
    startTransition(async () => {
      try {
        await deleteGunnyBagPurchaseAction(rowId);
        toast.success("Purchase deleted");
        setDeletePurchaseDialogOpen(false);
        setPurchaseToDelete(null);
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete purchase");
      }
    });
  }

  function deletePayment(row: GunnyPaymentRow) {
    const rowId = row.id;
    if (!rowId) return;
    startTransition(async () => {
      try {
        await deleteGunnyBagPaymentAction(rowId);
        toast.success("Payment deleted");
        setDeletePaymentDialogOpen(false);
        setPaymentToDelete(null);
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete payment");
      }
    });
  }

  function requestDeletePayment(row: GunnyPaymentRow) {
    if (!row.id) return;
    setPaymentToDelete(row);
    setDeletePaymentDialogOpen(true);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#2a2d34] bg-gradient-to-br from-[#161922] to-[#101217] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Gunny Bags Dashboard</h2>
            <p className="text-sm text-zinc-400">Transactions, party totals, and purchase summary in one place.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={openCreatePurchaseDialog} disabled={isPending} className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]">
              <Plus className="mr-1 h-4 w-4" />
              Add Purchase
            </Button>
            <Button type="button" onClick={openCreatePaymentDialog} disabled={isPending} className="border border-[#3478f6]/60 bg-[#1f3c70] text-[#c8ddff] hover:bg-[#274987]">
              <Plus className="mr-1 h-4 w-4" />
              Add Payment
            </Button>
            <Button type="button" onClick={openCreatePartyDialog} disabled={isPending} className="border border-[#2f3440] bg-[#141821] text-zinc-200 hover:bg-[#1d222e]">
              <Plus className="mr-1 h-4 w-4" />
              Add Party
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-xl border border-[#2a2d34] bg-[#111318] p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total Bags</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{formatNumberIN(stockSummary.totalBags)}</p>
          </div>
          <div className="rounded-xl border border-[#2a2d34] bg-[#111318] p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Used Bags</p>
            <p className="mt-1 text-2xl font-semibold text-[#ffb390]">{formatNumberIN(stockSummary.usedBags)}</p>
          </div>
          <div className="rounded-xl border border-[#2a2d34] bg-[#111318] p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Bags Left</p>
            <p className={`mt-1 text-2xl font-semibold ${stockSummary.leftBags >= 0 ? "text-zinc-100" : "text-[#ff8f6b]"}`}>
              {formatNumberIN(stockSummary.leftBags)}
            </p>
          </div>
          <div className="rounded-xl border border-[#2a2d34] bg-[#111318] p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total Purchase</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{formatCurrencyINR(stats.totalPurchase)}</p>
          </div>
          <div className="rounded-xl border border-[#2a2d34] bg-[#111318] p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total Paid</p>
            <p className="mt-1 text-2xl font-semibold text-emerald-300">{formatCurrencyINR(stats.totalPaid)}</p>
          </div>
          <div className="rounded-xl border border-[#2a2d34] bg-[#111318] p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Balance</p>
            <p className={`mt-1 text-2xl font-semibold ${stats.totalBalance > 0 ? "text-[#ff8f6b]" : "text-zinc-100"}`}>
              {formatCurrencyINR(stats.totalBalance)}
            </p>
          </div>
        </div>
      </section>

      <section className="flex min-h-[56vh] flex-col rounded-xl border border-[#252932] bg-[#111214] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-zinc-100">
            {activeTab === "purchases"
              ? "Purchase Entries"
              : activeTab === "payments"
                ? "Payment Entries"
                : "Purchase by Party"}
          </h3>
          <div className="inline-flex rounded-lg border border-[#2e3340] bg-[#12161f] p-1">
            <button
              type="button"
              onClick={() => switchTab("purchases")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                activeTab === "purchases" ? "bg-[#203a67] text-[#dbe7ff]" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Purchase Entries
            </button>
            <button
              type="button"
              onClick={() => switchTab("payments")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                activeTab === "payments" ? "bg-[#203a67] text-[#dbe7ff]" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Payment Entries
            </button>
            <button
              type="button"
              onClick={() => switchTab("purchaseSummary")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                activeTab === "purchaseSummary" ? "bg-[#203a67] text-[#dbe7ff]" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Purchase by Party
            </button>
          </div>
        </div>

        {activeTab === "purchaseSummary" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#252932] bg-[#13161d] p-2">
            <div className="flex max-w-full gap-2 overflow-x-auto">
              {partyTabs.map((party) => (
                <button
                  key={party}
                  type="button"
                  onClick={() => {
                    setSelectedSummaryParty(party);
                    updatePage("purchaseSummary", 1);
                  }}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    selectedSummaryParty === party
                      ? "bg-[#203a67] text-[#dbe7ff]"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {party === "ALL" ? "All Parties" : party}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {selectedSummaryParty !== "ALL" && (
                <Button type="button" className="border border-[#2f3440] bg-[#151a23] text-zinc-200 hover:bg-[#1d2330]" onClick={() => openEditPartyDialog(selectedPartyDetails)}>
                  Edit Party Details
                </Button>
              )}
              <Button type="button" className="border border-[#2f3440] bg-[#151a23] text-zinc-200 hover:bg-[#1d2330]" onClick={openCreatePartyDialog}>
                Add Party
              </Button>
            </div>
          </div>
        )}

        <div className="mt-3 flex-1 overflow-x-auto rounded-lg border border-[#252932]">
          {activeTab === "purchases" && (
            <table className="min-w-full text-sm text-zinc-200">
              <thead className="bg-[#171a22] text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Party</th>
                  <th className="px-3 py-2 text-right">Bags</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedPurchases.length > 0 ? (
                  pagedPurchases.map((row, index) => {
                    const canEdit = !!row.id;
                    return (
                      <tr key={row.id ?? `${row.party}-${row.date}-${index}`} className="border-t border-[#252932] odd:bg-[#12141a]">
                        <td className="px-3 py-2">{row.date || "-"}</td>
                        <td className="px-3 py-2">{row.party}</td>
                        <td className="px-3 py-2 text-right">{formatNumberIN(row.bags)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrencyINR(row.amount)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            {canEdit ? (
                              <>
                                <button type="button" onClick={() => openEditPurchaseDialog(row)} className="text-xs font-medium text-[#7fb0ff] hover:text-[#a9cbff]">Edit</button>
                                <button type="button" onClick={() => requestDeletePurchase(row)} className="text-xs font-medium text-[#ff9b86] hover:text-[#ffc3b6]">Delete</button>
                              </>
                            ) : (
                              <span className="text-xs text-zinc-500">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-zinc-500">No purchase records found.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === "payments" && (
            <table className="min-w-full text-sm text-zinc-200">
              <thead className="bg-[#171a22] text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Party</th>
                  <th className="px-3 py-2 text-left">Mode</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedPayments.length > 0 ? (
                  pagedPayments.map((row, index) => {
                    const canEdit = !!row.id;
                    return (
                      <tr key={row.id ?? `${row.party}-${row.date}-${index}`} className="border-t border-[#252932] odd:bg-[#12141a]">
                        <td className="px-3 py-2">{row.date || "-"}</td>
                        <td className="px-3 py-2">{row.party}</td>
                        <td className="px-3 py-2">{row.mode || "-"}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrencyINR(row.amount)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            {canEdit ? (
                              <>
                                <button type="button" onClick={() => openEditPaymentDialog(row)} className="text-xs font-medium text-[#7fb0ff] hover:text-[#a9cbff]">Edit</button>
                                <button type="button" onClick={() => requestDeletePayment(row)} className="text-xs font-medium text-[#ff9b86] hover:text-[#ffc3b6]">Delete</button>
                              </>
                            ) : (
                              <span className="text-xs text-zinc-500">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-zinc-500">No payment records found.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {activeTab === "purchaseSummary" && (
            <table className="min-w-full text-sm text-zinc-200">
              <thead className="bg-[#171a22] text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">Party</th>
                  <th className="px-3 py-2 text-right">Bags</th>
                  <th className="px-3 py-2 text-right">Avg Rate</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pagedPurchaseOverview.length > 0 ? (
                  pagedPurchaseOverview.map((row) => (
                    <tr key={row.party} className="border-t border-[#252932] odd:bg-[#12141a]">
                      <td className="px-3 py-2">{row.party}</td>
                      <td className="px-3 py-2 text-right">{formatNumberIN(row.totalBags)}</td>
                      <td className="px-3 py-2 text-right">{formatNumberIN(row.avgRate)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{formatCurrencyINR(row.totalAmount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-zinc-500">No records found.</td></tr>
                )}
              </tbody>
            </table>
          )}

        </div>

        {activeTab === "purchaseSummary" && selectedSummaryParty !== "ALL" && (
          <div className="mt-3 rounded-lg border border-[#252932] bg-[#12161d] p-3">
            <h4 className="text-sm font-semibold text-zinc-100">Party Details</h4>
            <div className="mt-2 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
              <p><span className="text-zinc-500">Name:</span> {selectedSummaryParty}</p>
              <p><span className="text-zinc-500">Contact:</span> {selectedPartyDetails?.contactPerson || "-"}</p>
              <p><span className="text-zinc-500">Phone:</span> {selectedPartyDetails?.phone || "-"}</p>
              <p><span className="text-zinc-500">Place:</span> {selectedPartyDetails?.place || "-"}</p>
            </div>
            <p className="mt-2 text-sm text-zinc-300">
              <span className="text-zinc-500">Notes:</span> {selectedPartyDetails?.notes || "-"}
            </p>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Rows per page</span>
            <select
              value={rowsPerPage}
              onChange={(event) => {
                const next = Number(event.target.value) || 10;
                setRowsPerPage(next);
                setPageByTab({
                  purchases: 1,
                  payments: 1,
                  purchaseSummary: 1,
                });
              }}
              className="rounded-md border border-[#2a2d34] bg-[#131720] px-2 py-1 text-zinc-200"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>
              {activeTotalRows === 0
                ? "0-0"
                : `${startIndex + 1}-${Math.min(endIndex, activeTotalRows)}`} of {activeTotalRows}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => updatePage(activeTab, Math.max(1, currentPage - 1))}
            >
              Previous
            </Button>
            <span className="text-zinc-300">Page {currentPage} / {totalPages}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => updatePage(activeTab, Math.min(totalPages, currentPage + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </section>

      <datalist id="gunny-party-options">
        {parties.map((party) => (
          <option key={party.id} value={party.name} />
        ))}
      </datalist>

      <Dialog open={partyDialogOpen} onOpenChange={setPartyDialogOpen}>
        <DialogContent className="overflow-hidden border border-[#2a2d34] bg-[#15171c] p-0 text-zinc-100 sm:max-w-md">
          <div className="p-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-zinc-100">{editingPartyId ? "Edit Party Details" : "Add Party"}</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Party Name
                <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" placeholder="Party name" value={partyName} onChange={(event) => setPartyName(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Contact Person
                <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" placeholder="Contact person" value={partyContactPerson} onChange={(event) => setPartyContactPerson(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Phone
                <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" placeholder="Phone number" value={partyPhone} onChange={(event) => setPartyPhone(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Place
                <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" placeholder="Place" value={partyPlace} onChange={(event) => setPartyPlace(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Notes
                <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" placeholder="Notes" value={partyNotes} onChange={(event) => setPartyNotes(event.target.value)} />
              </label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[#252932] bg-[#12151d] px-5 py-4">
            <Button type="button" className="border border-[#2f3440] bg-transparent text-zinc-200 hover:bg-[#1c2029]" onClick={() => setPartyDialogOpen(false)}>Cancel</Button>
            <Button type="button" className="border border-[#3478f6]/60 bg-[#1f3c70] text-[#d7e5ff] hover:bg-[#2a4f8f]" onClick={submitParty} disabled={isPending}>{editingPartyId ? "Update" : "Add"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="overflow-hidden border border-[#2a2d34] bg-[#15171c] p-0 text-zinc-100 sm:max-w-md">
          <div className="p-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-zinc-100">{editingPurchaseId ? "Edit Purchase" : "Add Purchase"}</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Date
                <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Party
                <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" list="gunny-party-options" placeholder="Party name" value={purchaseParty} onChange={(event) => setPurchaseParty(event.target.value)} />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1.5 text-xs text-zinc-400">
                  Bags
                  <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" type="number" step="0.01" placeholder="Bags" value={purchaseBags} onChange={(event) => setPurchaseBags(event.target.value)} />
                </label>
                <label className="grid gap-1.5 text-xs text-zinc-400">
                  Rate
                  <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" type="number" step="0.01" placeholder="Rate" value={purchaseRate} onChange={(event) => setPurchaseRate(event.target.value)} />
                </label>
              </div>
              <p className="rounded-md border border-[#293042] bg-[#101723] px-3 py-2 text-xs text-zinc-300">Amount: <span className="font-semibold text-zinc-100">{formatCurrencyINR(computedPurchaseAmount)}</span></p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[#252932] bg-[#12151d] px-5 py-4">
            <Button type="button" className="border border-[#2f3440] bg-transparent text-zinc-200 hover:bg-[#1c2029]" onClick={() => setPurchaseDialogOpen(false)}>Cancel</Button>
            <Button type="button" className="border border-[#3478f6]/60 bg-[#1f3c70] text-[#d7e5ff] hover:bg-[#2a4f8f]" onClick={submitPurchase} disabled={isPending}>{editingPurchaseId ? "Update" : "Add"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletePurchaseDialogOpen}
        onOpenChange={(open) => {
          setDeletePurchaseDialogOpen(open);
          if (!open) setPurchaseToDelete(null);
        }}
      >
        <DialogContent className="overflow-hidden border border-[#2a2d34] bg-[#15171c] p-0 text-zinc-100 sm:max-w-md">
          <div className="p-5">
            <DialogHeader className="gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg border border-[#7d2a1f]/60 bg-[#3b1b17]/60 p-2 text-[#ff8f6b]">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-zinc-100">Delete Purchase?</DialogTitle>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    Are you sure you want to delete this purchase
                    {purchaseToDelete?.party ? ` for ${purchaseToDelete.party}` : ""}? This action cannot be undone.
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#252932] bg-[#12151d] px-5 py-4">
            <Button
              type="button"
              className="border border-[#2f3440] bg-transparent text-zinc-200 hover:bg-[#1c2029]"
              onClick={() => {
                setDeletePurchaseDialogOpen(false);
                setPurchaseToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending || !purchaseToDelete}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              onClick={() => {
                if (!purchaseToDelete) return;
                deletePurchase(purchaseToDelete);
              }}
            >
              Yes, Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deletePaymentDialogOpen}
        onOpenChange={(open) => {
          setDeletePaymentDialogOpen(open);
          if (!open) setPaymentToDelete(null);
        }}
      >
        <DialogContent className="overflow-hidden border border-[#2a2d34] bg-[#15171c] p-0 text-zinc-100 sm:max-w-md">
          <div className="p-5">
            <DialogHeader className="gap-3">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg border border-[#7d2a1f]/60 bg-[#3b1b17]/60 p-2 text-[#ff8f6b]">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-zinc-100">Delete Payment?</DialogTitle>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    Are you sure you want to delete this payment
                    {paymentToDelete?.party ? ` for ${paymentToDelete.party}` : ""}? This action cannot be undone.
                  </p>
                </div>
              </div>
            </DialogHeader>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#252932] bg-[#12151d] px-5 py-4">
            <Button
              type="button"
              className="border border-[#2f3440] bg-transparent text-zinc-200 hover:bg-[#1c2029]"
              onClick={() => {
                setDeletePaymentDialogOpen(false);
                setPaymentToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending || !paymentToDelete}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              onClick={() => {
                if (!paymentToDelete) return;
                deletePayment(paymentToDelete);
              }}
            >
              Yes, Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="overflow-hidden border border-[#2a2d34] bg-[#15171c] p-0 text-zinc-100 sm:max-w-md">
          <div className="p-5">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-zinc-100">{editingPaymentId ? "Edit Payment" : "Add Payment"}</DialogTitle>
            </DialogHeader>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Date
                <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Party
                <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" list="gunny-party-options" placeholder="Party name" value={paymentParty} onChange={(event) => setPaymentParty(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Mode
                <Select
                  value={paymentModePreset}
                  onValueChange={(value) => setPaymentModePreset((value as PaymentModePreset) || "RTGS")}
                >
                  <SelectTrigger className="!h-10 w-full border-[#2f3440] bg-[#0f1218] text-zinc-100">
                    <SelectValue placeholder="Select mode" />
                  </SelectTrigger>
                  <SelectContent className="border border-[#343946] bg-[#1f2430] text-zinc-100 ring-0">
                    <SelectItem value="RTGS" className="text-zinc-100 hover:bg-[#31384a] hover:text-white focus:bg-[#31384a] focus:text-white data-[highlighted]:bg-[#31384a] data-[highlighted]:text-white data-[selected]:bg-[#ff6a3d]/20 data-[selected]:text-[#ffd8ca]">RTGS</SelectItem>
                    <SelectItem value="UPI" className="text-zinc-100 hover:bg-[#31384a] hover:text-white focus:bg-[#31384a] focus:text-white data-[highlighted]:bg-[#31384a] data-[highlighted]:text-white data-[selected]:bg-[#ff6a3d]/20 data-[selected]:text-[#ffd8ca]">UPI</SelectItem>
                    <SelectItem value="CASH" className="text-zinc-100 hover:bg-[#31384a] hover:text-white focus:bg-[#31384a] focus:text-white data-[highlighted]:bg-[#31384a] data-[highlighted]:text-white data-[selected]:bg-[#ff6a3d]/20 data-[selected]:text-[#ffd8ca]">CASH</SelectItem>
                    <SelectItem value="OTHER" className="text-zinc-100 hover:bg-[#31384a] hover:text-white focus:bg-[#31384a] focus:text-white data-[highlighted]:bg-[#31384a] data-[highlighted]:text-white data-[selected]:bg-[#ff6a3d]/20 data-[selected]:text-[#ffd8ca]">OTHER</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {paymentModePreset === "OTHER" && (
                <label className="grid gap-1.5 text-xs text-zinc-400">
                  Other Mode
                  <Input
                    className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0"
                    placeholder="Type custom mode"
                    value={paymentModeOther}
                    onChange={(event) => setPaymentModeOther(event.target.value)}
                  />
                </label>
              )}
              <label className="grid gap-1.5 text-xs text-zinc-400">
                Amount
                <Input className="h-10 border-[#2f3440] bg-[#0f1218] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-[#3c4a65] focus-visible:ring-0" type="number" step="0.01" placeholder="Amount" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
              </label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[#252932] bg-[#12151d] px-5 py-4">
            <Button type="button" className="border border-[#2f3440] bg-transparent text-zinc-200 hover:bg-[#1c2029]" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button type="button" className="border border-[#3478f6]/60 bg-[#1f3c70] text-[#d7e5ff] hover:bg-[#2a4f8f]" onClick={submitPayment} disabled={isPending}>{editingPaymentId ? "Update" : "Add"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
