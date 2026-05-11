"use client";

import { useMemo, useState, useTransition } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type Bilty,
  type BiltyParty,
  type BiltyPartyPayment,
} from "@/features/bilty/schemas";
import {
  createBiltyPartyAction,
  createBiltyPartyPaymentAction,
  deleteBiltyPartyAction,
  deleteBiltyPartyPaymentAction,
  updateBiltyPartyAction,
} from "@/app/bilty/actions";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

interface BiltyPartiesManagerProps {
  parties: BiltyParty[];
  biltys: Bilty[];
  payments: BiltyPartyPayment[];
}

export function BiltyPartiesManager({ parties, biltys, payments }: BiltyPartiesManagerProps) {
  const [partyData, setPartyData] = useState(parties);
  const [paymentData, setPaymentData] = useState(payments);
  const [partyDraft, setPartyDraft] = useState("");
  const [partyPlaceDraft, setPartyPlaceDraft] = useState("");
  const [partyMobDraft, setPartyMobDraft] = useState("");
  const [partyFormOpen, setPartyFormOpen] = useState(false);
  const [editingPartyId, setEditingPartyId] = useState<string | null>(null);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [deletePartyTarget, setDeletePartyTarget] = useState<BiltyParty | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<BiltyPartyPayment | null>(null);
  const [activePartyId, setActivePartyId] = useState<string | null>(parties[0]?.id ?? null);
  const [detailsTab, setDetailsTab] = useState<"purchases" | "ledger">("purchases");
  const [paidOn, setPaidOn] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<"" | "none" | "cash" | "rtgs">("");
  const [rtgsName, setRtgsName] = useState("");
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  const sortedParties = useMemo(
    () => [...partyData].sort((a, b) => a.name.localeCompare(b.name)),
    [partyData]
  );

  const activeParty = useMemo(() => {
    if (sortedParties.length === 0) return null;
    if (activePartyId) {
      const found = sortedParties.find((party) => party.id === activePartyId);
      if (found) return found;
    }
    return sortedParties[0];
  }, [activePartyId, sortedParties]);

  const activePartyBiltys = useMemo(() => {
    if (!activeParty) return [];
    const normalized = activeParty.name.trim().toLowerCase();
    return biltys
      .filter((bilty) => bilty.party.trim().toLowerCase() === normalized)
      .sort((a, b) => b.date.localeCompare(a.date) || b.bill_no - a.bill_no);
  }, [activeParty, biltys]);

  const activePartyPayments = useMemo(() => {
    if (!activeParty) return [];
    return paymentData
      .filter((payment) => payment.party_id === activeParty.id)
      .sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  }, [activeParty, paymentData]);

  const purchaseTotals = useMemo(
    () =>
      activePartyBiltys.reduce(
        (acc, row) => {
          acc.bags += row.bags;
          acc.weight += row.net_weight;
          acc.amount += row.final_total;
          return acc;
        },
        { bags: 0, weight: 0, amount: 0 }
      ),
    [activePartyBiltys]
  );

  const totalReceived = useMemo(
    () => activePartyPayments.reduce((sum, payment) => sum + payment.amount, 0),
    [activePartyPayments]
  );
  const remaining = Math.max(purchaseTotals.amount - totalReceived, 0);

  const handleSaveParty = () => {
    const value = partyDraft.trim();
    if (!value) {
      toast.error("Enter a party name");
      return;
    }
    if (!partyPlaceDraft.trim()) {
      toast.error("Enter place");
      return;
    }
    if (!partyMobDraft.trim()) {
      toast.error("Enter mobile number");
      return;
    }

    startTransition(async () => {
      try {
        if (editingPartyId) {
          const updated = await updateBiltyPartyAction(
            editingPartyId,
            value,
            partyPlaceDraft.trim(),
            partyMobDraft.trim()
          );
          setPartyData((current) =>
            current.map((party) => (party.id === updated.id ? updated : party))
          );
          setActivePartyId(updated.id);
          toast.success("Party updated");
        } else {
          const created = await createBiltyPartyAction(
            value,
            partyPlaceDraft.trim(),
            partyMobDraft.trim()
          );
          setPartyData((current) => {
            const existingIndex = current.findIndex(
              (party) => party.id === created.id || party.name === created.name
            );
            if (existingIndex >= 0) {
              const next = [...current];
              next[existingIndex] = created;
              return next;
            }
            return [...current, created];
          });
          setActivePartyId(created.id);
          toast.success("Party saved");
        }

        setPartyDraft("");
        setPartyPlaceDraft("");
        setPartyMobDraft("");
        setEditingPartyId(null);
        setPartyFormOpen(false);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to save party");
      }
    });
  };

  const handleDeleteParty = (party: BiltyParty) => {
    startTransition(async () => {
      try {
        await deleteBiltyPartyAction(party.id);
        setPartyData((current) => {
          const next = current.filter((item) => item.id !== party.id);
          const nextActive = next[0]?.id ?? null;
          setActivePartyId((currentActive) =>
            currentActive === party.id ? nextActive : currentActive
          );
          return next;
        });
        setDeletePartyTarget(null);
        toast.success("Party deleted");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete party");
      }
    });
  };

  const handleCreatePayment = () => {
    if (!activeParty) return;
    const parsedAmount = Number(amount);

    if (!paidOn) {
      toast.error("Payment date is required");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }
    if (!paymentMode) {
      toast.error("Select payment mode");
      return;
    }
    if (paymentMode === "rtgs" && !rtgsName.trim()) {
      toast.error("RTGS name is required");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createBiltyPartyPaymentAction({
          party_id: activeParty.id,
          paid_on: paidOn,
          amount: parsedAmount,
          payment_mode: paymentMode,
          rtgs_name: paymentMode === "rtgs" ? rtgsName.trim() : "",
          note: note.trim(),
        });
        setPaymentData((current) => [created, ...current]);
        setPaymentFormOpen(false);
        setAmount("");
        setPaymentMode("");
        setRtgsName("");
        setNote("");
        toast.success("Payment added");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to add payment");
      }
    });
  };

  const handleDeletePayment = (payment: BiltyPartyPayment) => {
    startTransition(async () => {
      try {
        await deleteBiltyPartyPaymentAction(payment.id);
        setPaymentData((current) => current.filter((item) => item.id !== payment.id));
        setDeletePaymentTarget(null);
        toast.success("Payment deleted");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete payment");
      }
    });
  };

  return (
    <div className="space-y-4">
      <Card className="border-[#1f2229] bg-[#111214] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
        <CardHeader className="border-b border-[#252932]">
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
            <div className="flex gap-2">
              {sortedParties.map((party) => {
                const isActive = activeParty?.id === party.id;
                return (
                  <button
                    key={party.id}
                    type="button"
                    onClick={() => setActivePartyId(party.id)}
                    className={`whitespace-nowrap rounded-md border px-4 py-2 text-sm transition ${
                      isActive
                        ? "border-[#ff6a3d] bg-[#3a1f17] text-[#ffc2ae]"
                        : "border-[#2a2d34] bg-[#15171c] text-zinc-300 hover:text-zinc-100"
                    }`}
                  >
                    {party.name}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              onClick={() => {
                setEditingPartyId(null);
                setPartyDraft("");
                setPartyPlaceDraft("");
                setPartyMobDraft("");
                setPartyFormOpen(true);
              }}
              disabled={isPending}
              className="ml-auto whitespace-nowrap border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              Add Party
            </Button>
          </div>

          <div className="overflow-x-auto rounded-md border border-[#252932]">
            <table className="w-full table-fixed border-collapse text-sm text-zinc-200">
              <thead className="bg-[#15171c]">
                <tr>
                  <th className="w-1/4 border-b border-[#252932] px-4 py-3 text-left">Name</th>
                  <th className="w-1/4 border-b border-[#252932] px-4 py-3 text-left">Place</th>
                  <th className="w-1/4 border-b border-[#252932] px-4 py-3 text-left">Mobile</th>
                  <th className="w-1/4 border-b border-[#252932] px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeParty ? (
                  <tr>
                    <td className="px-4 py-3 font-medium text-zinc-100">{activeParty.name}</td>
                    <td className="px-4 py-3 text-zinc-300">{activeParty.place || "-"}</td>
                    <td className="px-4 py-3 text-zinc-300">{activeParty.mob || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isPending}
                          className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
                          onClick={() => {
                            setEditingPartyId(activeParty.id);
                            setPartyDraft(activeParty.name);
                            setPartyPlaceDraft(activeParty.place ?? "");
                            setPartyMobDraft(activeParty.mob ?? "");
                            setPartyFormOpen(true);
                          }}
                        >
                          Edit Party
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          disabled={isPending}
                          className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
                          onClick={() => setDeletePartyTarget(activeParty)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr>
                    <td className="px-4 py-6 text-zinc-500" colSpan={4}>
                      No parties found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {activeParty && (!activeParty.place?.trim() || !activeParty.mob?.trim()) ? (
            <div className="mt-3 flex items-center justify-between rounded-md border border-[#7a1f1f] bg-[#2a1212] px-3 py-2 text-sm text-[#ffc9c9]">
              <p>Party details are incomplete. Please fill place and mobile number.</p>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                className="border-[#8f2f2f] bg-[#3a1717] text-[#ffc9c9] hover:bg-[#4a1c1c]"
                onClick={() => {
                  setEditingPartyId(activeParty.id);
                  setPartyDraft(activeParty.name);
                  setPartyPlaceDraft(activeParty.place ?? "");
                  setPartyMobDraft(activeParty.mob ?? "");
                  setPartyFormOpen(true);
                }}
              >
                Fill Details
              </Button>
            </div>
          ) : null}

          <div className="mt-4 inline-flex rounded-md border border-[#252932] bg-[#14161b] p-1">
            <button
              type="button"
              onClick={() => setDetailsTab("purchases")}
              className={`cursor-pointer rounded-sm px-3 py-1.5 text-sm transition ${
                detailsTab === "purchases"
                  ? "bg-[#23262e] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Purchase Details
            </button>
            <button
              type="button"
              onClick={() => setDetailsTab("ledger")}
              className={`cursor-pointer rounded-sm px-3 py-1.5 text-sm transition ${
                detailsTab === "ledger"
                  ? "bg-[#23262e] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Payment Ledger
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          {detailsTab === "purchases" ? (
            <section className="space-y-3 rounded-md border border-[#252932] bg-[#111214] p-3">
              <h3 className="text-sm font-semibold text-zinc-200">Purchase Details</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
                  <div className="text-zinc-500">Total Bags</div>
                  <div className="font-semibold text-zinc-100">
                    {formatNumberIN(purchaseTotals.bags, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
                  <div className="text-zinc-500">Total Weight</div>
                  <div className="font-semibold text-zinc-100">
                    {formatNumberIN(purchaseTotals.weight, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
                  <div className="text-zinc-500">Total Amount</div>
                  <div className="font-semibold text-zinc-100">
                    {formatCurrencyINR(purchaseTotals.amount, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-[#252932]">
                <table className="w-full min-w-[900px] border-collapse text-sm text-zinc-200">
                  <thead className="bg-[#15171c]">
                    <tr>
                      <th className="border-b border-[#252932] px-3 py-2 text-left">Bill No</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-left">Date</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-right">Bags</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-right">Net Wt</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-right">Rate</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-right">Amount</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-left">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePartyBiltys.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-500" colSpan={7}>
                          No purchase entries for this party.
                        </td>
                      </tr>
                    ) : (
                      activePartyBiltys.map((row) => (
                        <tr key={row.id} className="border-b border-[#252932] last:border-b-0">
                          <td className="px-3 py-2">{row.bill_no}</td>
                          <td className="px-3 py-2">{row.date}</td>
                          <td className="px-3 py-2 text-right">
                            {formatNumberIN(row.bags, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatNumberIN(row.net_weight, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrencyINR(row.rate, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrencyINR(row.final_total, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2 uppercase">{row.payment_through}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
            <section className="space-y-3 rounded-md border border-[#252932] bg-[#111214] p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-zinc-200">Payment Ledger</h3>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-zinc-400">Entries: {activePartyPayments.length}</div>
                  <Button
                    type="button"
                    disabled={!activeParty || isPending}
                    onClick={() => setPaymentFormOpen(true)}
                    className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
                  >
                    Add Payment
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
                  <div className="text-zinc-500">Total Amount</div>
                  <div className="font-semibold text-zinc-100">
                    {formatCurrencyINR(purchaseTotals.amount, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
                  <div className="text-zinc-500">Received</div>
                  <div className="font-semibold text-zinc-100">
                    {formatCurrencyINR(totalReceived, { maximumFractionDigits: 0 })}
                  </div>
                </div>
                <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
                  <div className="text-zinc-500">Remaining</div>
                  <div className="font-semibold text-zinc-100">
                    {formatCurrencyINR(remaining, { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto rounded-md border border-[#252932]">
                <table className="w-full min-w-[900px] border-collapse text-sm text-zinc-200">
                  <thead className="bg-[#15171c]">
                    <tr>
                      <th className="border-b border-[#252932] px-3 py-2 text-left">Date</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-right">Amount</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-left">Mode</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-left">RTGS Name</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-left">Note</th>
                      <th className="border-b border-[#252932] px-3 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePartyPayments.length === 0 ? (
                      <tr>
                        <td className="px-3 py-3 text-zinc-500" colSpan={6}>
                          No payments added yet.
                        </td>
                      </tr>
                    ) : (
                      activePartyPayments.map((payment) => (
                        <tr key={payment.id} className="border-b border-[#252932] last:border-b-0">
                          <td className="px-3 py-2">{payment.paid_on}</td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrencyINR(payment.amount, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="px-3 py-2 uppercase">{payment.payment_mode}</td>
                          <td className="px-3 py-2">{payment.rtgs_name || "-"}</td>
                          <td className="px-3 py-2">{payment.note || "-"}</td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={isPending}
                              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
                              onClick={() => setDeletePaymentTarget(payment)}
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
            </section>
          )}
        </CardContent>
      </Card>

      <Dialog open={partyFormOpen} onOpenChange={setPartyFormOpen}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPartyId ? "Edit Party" : "Add Party"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Party Name</p>
              <Input
                value={partyDraft}
                onChange={(event) => setPartyDraft(event.target.value)}
                placeholder="Type a new party name"
                className="h-11 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Place</p>
                <Input
                  value={partyPlaceDraft}
                  onChange={(event) => setPartyPlaceDraft(event.target.value)}
                  placeholder="Enter place"
                  className="h-11 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Mobile</p>
                <Input
                  value={partyMobDraft}
                  inputMode="numeric"
                  onChange={(event) =>
                    setPartyMobDraft(event.target.value.replace(/\D/g, "").slice(0, 10))
                  }
                  placeholder="Enter mobile number"
                  className="h-11 border-[#2a2d34] bg-[#14161b] text-zinc-100 placeholder:text-zinc-500"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              onClick={() => {
                setPartyFormOpen(false);
                setPartyDraft("");
                setPartyPlaceDraft("");
                setPartyMobDraft("");
                setEditingPartyId(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveParty}
              disabled={isPending}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editingPartyId ? "Save Changes" : "Add Party"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentFormOpen} onOpenChange={setPaymentFormOpen}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
            <Input
              type="date"
              className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
              value={paidOn}
              onChange={(event) => setPaidOn(event.target.value)}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Amount"
              className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <Select
              value={paymentMode}
              onValueChange={(value) => setPaymentMode(value as "" | "none" | "cash" | "rtgs")}
            >
              <SelectTrigger className="h-10 w-full border-[#2a2d34] bg-[#14161b] text-zinc-100">
                <SelectValue placeholder="Select payment mode" />
              </SelectTrigger>
              <SelectContent className="border-[#2a2d34] bg-[#14161b] text-zinc-100">
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="rtgs">RTGS</SelectItem>
              </SelectContent>
            </Select>
            {paymentMode === "rtgs" ? (
              <Input
                placeholder="RTGS Name"
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={rtgsName}
                onChange={(event) => setRtgsName(event.target.value)}
              />
            ) : null}
            <Input
              placeholder="Note (optional)"
              className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              onClick={() => setPaymentFormOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending || !activeParty}
              onClick={handleCreatePayment}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              Add Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletePartyTarget} onOpenChange={(open) => !open && setDeletePartyTarget(null)}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Party?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">Are you sure you want to delete this party entry?</p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              onClick={() => setDeletePartyTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !deletePartyTarget}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              onClick={() => {
                if (!deletePartyTarget) return;
                handleDeleteParty(deletePartyTarget);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletePaymentTarget} onOpenChange={(open) => !open && setDeletePaymentTarget(null)}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Payment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">Are you sure you want to delete this payment entry?</p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              onClick={() => setDeletePaymentTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !deletePaymentTarget}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              onClick={() => {
                if (!deletePaymentTarget) return;
                handleDeletePayment(deletePaymentTarget);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
