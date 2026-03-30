"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  createGunnyBagPaymentAction,
  createGunnyBagPurchaseAction,
  deleteGunnyBagPaymentAction,
  deleteGunnyBagPurchaseAction,
  updateGunnyBagPaymentAction,
  updateGunnyBagPurchaseAction,
} from "@/app/gunny-bags/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import {
  GunnyPartyLedgerRow,
  GunnyPaymentRow,
  GunnyPurchaseOverviewRow,
  GunnyPurchaseRow,
} from "@/features/gunny-bags/service/gunny-bag.service";

interface GunnyBagsOverviewProps {
  purchases: GunnyPurchaseRow[];
  payments: GunnyPaymentRow[];
  purchaseOverview: GunnyPurchaseOverviewRow[];
  partyLedger: GunnyPartyLedgerRow[];
}

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

function SourceBadge({ source }: { source: "sheet" | "app" }) {
  if (source === "app") {
    return <span className="rounded-full border border-emerald-500/50 bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">APP</span>;
  }
  return <span className="rounded-full border border-zinc-600 bg-zinc-800/70 px-2 py-0.5 text-xs font-medium text-zinc-300">SHEET</span>;
}

export function GunnyBagsOverview({
  purchases,
  payments,
  purchaseOverview,
  partyLedger,
}: GunnyBagsOverviewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  const [purchaseDate, setPurchaseDate] = useState(todayISO());
  const [purchaseParty, setPurchaseParty] = useState("");
  const [purchaseBags, setPurchaseBags] = useState("");
  const [purchaseRate, setPurchaseRate] = useState("");

  const [paymentDate, setPaymentDate] = useState(todayISO());
  const [paymentParty, setPaymentParty] = useState("");
  const [paymentMode, setPaymentMode] = useState("RTGS");
  const [paymentAmount, setPaymentAmount] = useState("");

  const stats = useMemo(() => {
    const totalBags = purchaseOverview.reduce((sum, row) => sum + row.totalBags, 0);
    const totalPurchase = partyLedger.reduce((sum, row) => sum + row.totalPurchase, 0);
    const totalPaid = partyLedger.reduce((sum, row) => sum + row.totalPaid, 0);
    const totalBalance = partyLedger.reduce((sum, row) => sum + row.balance, 0);
    return { totalBags, totalPurchase, totalPaid, totalBalance };
  }, [partyLedger, purchaseOverview]);

  const computedPurchaseAmount = useMemo(
    () => parseNumber(purchaseBags) * parseNumber(purchaseRate),
    [purchaseBags, purchaseRate]
  );

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
    setPaymentMode("RTGS");
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
    if (row.source !== "app" || !row.id) return;
    setEditingPurchaseId(row.id);
    setPurchaseDate(toDateInputValue(row.date));
    setPurchaseParty(row.party);
    setPurchaseBags(String(row.bags));
    setPurchaseRate(String(row.rate));
    setPurchaseDialogOpen(true);
  }

  function openEditPaymentDialog(row: GunnyPaymentRow) {
    if (row.source !== "app" || !row.id) return;
    setEditingPaymentId(row.id);
    setPaymentDate(toDateInputValue(row.date));
    setPaymentParty(row.party);
    setPaymentMode(row.mode || "RTGS");
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
    if (!paymentDate) return toast.error("Payment date is required");
    if (!paymentParty.trim()) return toast.error("Payment party is required");
    if (!paymentMode.trim()) return toast.error("Payment mode is required");
    if (amount <= 0) return toast.error("Amount must be greater than zero");

    startTransition(async () => {
      try {
        const payload = {
          date: paymentDate,
          party: paymentParty.trim(),
          mode: paymentMode.trim(),
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

  function deletePurchase(row: GunnyPurchaseRow) {
    const rowId = row.id;
    if (row.source !== "app" || !rowId) return;
    startTransition(async () => {
      try {
        await deleteGunnyBagPurchaseAction(rowId);
        toast.success("Purchase deleted");
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete purchase");
      }
    });
  }

  function deletePayment(row: GunnyPaymentRow) {
    const rowId = row.id;
    if (row.source !== "app" || !rowId) return;
    startTransition(async () => {
      try {
        await deleteGunnyBagPaymentAction(rowId);
        toast.success("Payment deleted");
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete payment");
      }
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#2a2d34] bg-gradient-to-br from-[#161922] to-[#101217] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Gunny Bags Dashboard</h2>
            <p className="text-sm text-zinc-400">Transactions, party totals, and ledger in one place.</p>
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
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-[#2a2d34] bg-[#111318] p-3">
            <p className="text-xs uppercase tracking-wide text-zinc-500">Total Bags</p>
            <p className="mt-1 text-2xl font-semibold text-zinc-100">{formatNumberIN(stats.totalBags)}</p>
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

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-[#252932] bg-[#111214] p-4">
          <h3 className="text-base font-semibold text-zinc-100">Purchase Entries</h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#252932]">
            <table className="min-w-full text-sm text-zinc-200">
              <thead className="bg-[#171a22] text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Party</th>
                  <th className="px-3 py-2 text-right">Bags</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-center">Source</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length > 0 ? (
                  purchases.map((row, index) => {
                    const canEdit = row.source === "app" && !!row.id;
                    return (
                      <tr key={row.id ?? `${row.party}-${row.date}-${index}`} className="border-t border-[#252932] odd:bg-[#12141a]">
                        <td className="px-3 py-2">{row.date || "-"}</td>
                        <td className="px-3 py-2">{row.party}</td>
                        <td className="px-3 py-2 text-right">{formatNumberIN(row.bags)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrencyINR(row.amount)}</td>
                        <td className="px-3 py-2 text-center"><SourceBadge source={row.source} /></td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            {canEdit ? (
                              <>
                                <button type="button" onClick={() => openEditPurchaseDialog(row)} className="text-xs font-medium text-[#7fb0ff] hover:text-[#a9cbff]">Edit</button>
                                <button type="button" onClick={() => deletePurchase(row)} className="text-xs font-medium text-[#ff9b86] hover:text-[#ffc3b6]">Delete</button>
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
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-500">No purchase records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-[#252932] bg-[#111214] p-4">
          <h3 className="text-base font-semibold text-zinc-100">Payment Entries</h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#252932]">
            <table className="min-w-full text-sm text-zinc-200">
              <thead className="bg-[#171a22] text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Party</th>
                  <th className="px-3 py-2 text-left">Mode</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-center">Source</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.length > 0 ? (
                  payments.map((row, index) => {
                    const canEdit = row.source === "app" && !!row.id;
                    return (
                      <tr key={row.id ?? `${row.party}-${row.date}-${index}`} className="border-t border-[#252932] odd:bg-[#12141a]">
                        <td className="px-3 py-2">{row.date || "-"}</td>
                        <td className="px-3 py-2">{row.party}</td>
                        <td className="px-3 py-2">{row.mode || "-"}</td>
                        <td className="px-3 py-2 text-right font-semibold">{formatCurrencyINR(row.amount)}</td>
                        <td className="px-3 py-2 text-center"><SourceBadge source={row.source} /></td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            {canEdit ? (
                              <>
                                <button type="button" onClick={() => openEditPaymentDialog(row)} className="text-xs font-medium text-[#7fb0ff] hover:text-[#a9cbff]">Edit</button>
                                <button type="button" onClick={() => deletePayment(row)} className="text-xs font-medium text-[#ff9b86] hover:text-[#ffc3b6]">Delete</button>
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
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-zinc-500">No payment records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-[#252932] bg-[#111214] p-4">
          <h3 className="text-base font-semibold text-zinc-100">Overall Purchase by Party</h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#252932]">
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
                {purchaseOverview.length > 0 ? (
                  purchaseOverview.map((row) => (
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
          </div>
        </div>

        <div className="rounded-xl border border-[#252932] bg-[#111214] p-4">
          <h3 className="text-base font-semibold text-zinc-100">Party Ledger</h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-[#252932]">
            <table className="min-w-full text-sm text-zinc-200">
              <thead className="bg-[#171a22] text-zinc-300">
                <tr>
                  <th className="px-3 py-2 text-left">Party</th>
                  <th className="px-3 py-2 text-right">Purchase</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                  <th className="px-3 py-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {partyLedger.length > 0 ? (
                  partyLedger.map((row) => (
                    <tr key={row.party} className="border-t border-[#252932] odd:bg-[#12141a]">
                      <td className="px-3 py-2">{row.party}</td>
                      <td className="px-3 py-2 text-right">{formatCurrencyINR(row.totalPurchase)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrencyINR(row.totalPaid)}</td>
                      <td className={`px-3 py-2 text-right font-semibold ${row.balance > 0 ? "text-[#ff8f6b]" : row.balance < 0 ? "text-emerald-300" : "text-zinc-100"}`}>
                        {formatCurrencyINR(row.balance)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-zinc-500">No records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100">
          <DialogHeader>
            <DialogTitle>{editingPurchaseId ? "Edit Purchase" : "Add Purchase"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Input type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
            <Input placeholder="Party name" value={purchaseParty} onChange={(event) => setPurchaseParty(event.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input type="number" step="0.01" placeholder="Bags" value={purchaseBags} onChange={(event) => setPurchaseBags(event.target.value)} />
              <Input type="number" step="0.01" placeholder="Rate" value={purchaseRate} onChange={(event) => setPurchaseRate(event.target.value)} />
            </div>
            <p className="text-xs text-zinc-500">Amount: <span className="font-medium text-zinc-300">{formatCurrencyINR(computedPurchaseAmount)}</span></p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPurchaseDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={submitPurchase} disabled={isPending}>{editingPurchaseId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100">
          <DialogHeader>
            <DialogTitle>{editingPaymentId ? "Edit Payment" : "Add Payment"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
            <Input placeholder="Party name" value={paymentParty} onChange={(event) => setPaymentParty(event.target.value)} />
            <Input placeholder="Mode (RTGS/UPI/CASH...)" value={paymentMode} onChange={(event) => setPaymentMode(event.target.value)} />
            <Input type="number" step="0.01" placeholder="Amount" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button type="button" onClick={submitPayment} disabled={isPending}>{editingPaymentId ? "Update" : "Add"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
