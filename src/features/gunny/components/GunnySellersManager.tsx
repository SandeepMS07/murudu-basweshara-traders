"use client";

import { useMemo, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCanEdit } from "@/features/auth/components/AuthProvider";
import { Input } from "@/components/ui/input";
import {
  type GunnyRecord,
  type GunnySeller,
  type GunnySellerPaymentAllocation,
  type GunnySellerPayment,
} from "@/features/gunny/schemas";
import {
  createGunnySellerAction,
  createGunnySellerPaymentAction,
  deleteGunnySellerAction,
  deleteGunnySellerPaymentAction,
  updateGunnySellerAction,
} from "@/app/gunny/actions";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { exportWorkbookToXlsx } from "@/lib/excel/client-export";

type Props = {
  sellers: GunnySeller[];
  records: GunnyRecord[];
  payments: GunnySellerPayment[];
  allocations: GunnySellerPaymentAllocation[];
};

export function GunnySellersManager({
  sellers,
  records,
  payments,
  allocations,
}: Props) {
  const canEdit = useCanEdit("gunny");
  const [sellerList, setSellerList] = useState(sellers);
  const [paymentList, setPaymentList] = useState(payments);
  const [allocationList, setAllocationList] = useState(allocations);
  const [activeSellerId, setActiveSellerId] = useState<string | null>(
    sellers[0]?.id ?? null,
  );
  const [tab, setTab] = useState<"purchase" | "ledger">("purchase");
  const [isPending, startTransition] = useTransition();

  const [sellerDialogOpen, setSellerDialogOpen] = useState(false);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  const [mob, setMob] = useState("");

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paidOn, setPaidOn] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<
    "none" | "cash" | "upi" | "rtgs"
  >("none");
  const [upiNumber, setUpiNumber] = useState("");
  const [rtgsName, setRtgsName] = useState("");
  const [note, setNote] = useState("");
  const [allocationDraft, setAllocationDraft] = useState<Record<string, string>>({});
  const paymentFieldClassName =
    "h-10 border-[#2a2d34] bg-[#111214] text-zinc-100";

  const activeSeller =
    sellerList.find((seller) => seller.id === activeSellerId) ?? null;

  const sellerRecords = useMemo(() => {
    if (!activeSeller) return [];
    const normalized = activeSeller.name.trim().toLowerCase();
    return records
      .filter((row) => row.seller.trim().toLowerCase() === normalized)
      .sort((a, b) => b.date.localeCompare(a.date) || b.bill_no - a.bill_no);
  }, [records, activeSeller]);

  const sellerPayments = useMemo(() => {
    if (!activeSeller) return [];
    return paymentList
      .filter((payment) => payment.seller_id === activeSeller.id)
      .sort((a, b) => b.paid_on.localeCompare(a.paid_on));
  }, [paymentList, activeSeller]);

  const totals = useMemo(() => {
    const bags = sellerRecords.reduce((sum, row) => sum + row.bags, 0);
    const amountTotal = sellerRecords.reduce((sum, row) => sum + row.amount, 0);
    const paid = sellerPayments.reduce((sum, row) => sum + row.amount, 0);
    const pending = Math.max(amountTotal - paid, 0);
    return { bags, amountTotal, paid, pending };
  }, [sellerPayments, sellerRecords]);

  const paidByRecord = useMemo(() => {
    const paymentIds = new Set(sellerPayments.map((payment) => payment.id));
    const totalsByRecord = new Map<string, number>();
    allocationList.forEach((allocation) => {
      if (!paymentIds.has(allocation.payment_id)) return;
      totalsByRecord.set(
        allocation.record_id,
        (totalsByRecord.get(allocation.record_id) ?? 0) + allocation.amount,
      );
    });
    return totalsByRecord;
  }, [allocationList, sellerPayments]);

  const resetSellerForm = () => {
    setEditingSellerId(null);
    setName("");
    setPlace("");
    setMob("");
  };

  const openAddSeller = () => {
    resetSellerForm();
    setSellerDialogOpen(true);
  };

  const openEditSeller = (seller: GunnySeller) => {
    setEditingSellerId(seller.id);
    setName(seller.name);
    setPlace(seller.place);
    setMob(seller.mob);
    setSellerDialogOpen(true);
  };

  const submitSeller = () => {
    if (!name.trim()) {
      toast.error("Seller name is required");
      return;
    }

    startTransition(async () => {
      try {
        if (editingSellerId) {
          const updated = await updateGunnySellerAction(editingSellerId, {
            name,
            place,
            mob,
          });
          setSellerList((current) =>
            current.map((seller) =>
              seller.id === updated.id ? updated : seller,
            ),
          );
          toast.success("Party updated");
        } else {
          const created = await createGunnySellerAction({ name, place, mob });
          setSellerList((current) => [...current, created]);
          setActiveSellerId(created.id);
          toast.success("Party added");
        }
        setSellerDialogOpen(false);
        resetSellerForm();
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save party",
        );
      }
    });
  };

  const deleteSeller = (seller: GunnySeller) => {
    if (!confirm(`Delete party ${seller.name}?`)) return;

    startTransition(async () => {
      try {
        await deleteGunnySellerAction(seller.id);
        setSellerList((current) => current.filter((item) => item.id !== seller.id));
        if (activeSellerId === seller.id) {
          setActiveSellerId(null);
        }
        toast.success("Party deleted");
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete party",
        );
      }
    });
  };

  const submitPayment = () => {
    if (!activeSeller) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    const allocationEntries = Object.entries(allocationDraft)
      .map(([recordId, value]) => ({
        record_id: recordId,
        amount: Number(value),
      }))
      .filter((item) => Number.isFinite(item.amount) && item.amount > 0);

    const allocationTotal = allocationEntries.reduce(
      (sum, entry) => sum + entry.amount,
      0,
    );
    if (allocationEntries.length === 0) {
      toast.error("Add allocation amount for at least one record");
      return;
    }
    if (allocationTotal > parsedAmount) {
      toast.error("Allocated amount cannot exceed payment amount");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createGunnySellerPaymentAction({
          seller_id: activeSeller.id,
          paid_on: paidOn,
          amount: parsedAmount,
          payment_mode: paymentMode,
          upi_number: upiNumber.trim(),
          rtgs_name: rtgsName.trim(),
          note,
          allocations: allocationEntries,
        });
        setPaymentList((current) => [created, ...current]);
        setAllocationList((current) => [
          ...allocationEntries.map((allocation) => ({
            id: crypto.randomUUID(),
            payment_id: created.id,
            record_id: allocation.record_id,
            amount: allocation.amount,
          })),
          ...current,
        ]);
        setPaymentDialogOpen(false);
        setAmount("");
        setUpiNumber("");
        setRtgsName("");
        setNote("");
        setAllocationDraft({});
        toast.success("Payment added");
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to add payment",
        );
      }
    });
  };

  const deletePayment = (paymentId: string) => {
    if (!confirm("Delete this payment entry?")) return;

    startTransition(async () => {
      try {
        await deleteGunnySellerPaymentAction(paymentId);
        setPaymentList((current) =>
          current.filter((payment) => payment.id !== paymentId),
        );
        setAllocationList((current) =>
          current.filter((allocation) => allocation.payment_id !== paymentId),
        );
        toast.success("Payment deleted");
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete payment",
        );
      }
    });
  };

  const exportPurchaseDetails = () => {
    if (!activeSeller) return;

    const purchaseRows = sellerRecords.map((row) => ({
      "Bill No": row.bill_no,
      Date: row.date,
      Bags: row.bags,
      Rate: row.rate,
      Amount: row.amount,
      Paid: paidByRecord.get(row.id) ?? 0,
      Pending: Math.max(row.amount - (paidByRecord.get(row.id) ?? 0), 0),
    }));

    const ledgerRows = sellerPayments.map((payment) => ({
      Date: payment.paid_on,
      Amount: payment.amount,
      "Payment Mode": payment.payment_mode.toUpperCase(),
      "UPI Number": payment.upi_number || "",
      "RTGS Name": payment.rtgs_name || "",
      Note: payment.note || "",
    }));

    const summaryRows = [
      { Metric: "Seller", Value: activeSeller.name },
      { Metric: "Total Bags", Value: totals.bags },
      { Metric: "Total Amount", Value: totals.amountTotal },
      { Metric: "Total Paid", Value: totals.paid },
      { Metric: "Total Pending", Value: totals.pending },
    ];

    exportWorkbookToXlsx(
      [
        {
          name: "Summary",
          rows: summaryRows,
          columnWidths: [24, 28],
        },
        {
          name: "Purchase Details",
          rows: purchaseRows,
          columnWidths: [12, 14, 12, 12, 14, 14, 14],
        },
        {
          name: "Payment Ledger",
          rows: ledgerRows,
          columnWidths: [14, 14, 16, 18, 18, 26],
        },
      ],
      {
        fileName: `gunny-report-${activeSeller.name.replace(/\s+/g, "-").toLowerCase()}`,
        emptyMessage: "No records found",
      },
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#252932] bg-[#111214] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto">
            {sellerList.map((seller) => (
              <button
                key={seller.id}
                type="button"
                onClick={() => setActiveSellerId(seller.id)}
                className={`rounded-md border px-4 py-2 text-sm font-medium transition ${
                  activeSeller?.id === seller.id
                    ? "border-[#ff6a3d] bg-[#2a1d1a] text-[#ffb39a]"
                    : "border-[#252932] bg-[#15171c] text-zinc-300 hover:text-zinc-100"
                }`}
              >
                {seller.name.toUpperCase()}
              </button>
            ))}
          </div>
          {canEdit ? (
            <Button
              type="button"
              onClick={openAddSeller}
              className="h-10 rounded-xl border border-[#ff6a3d] bg-[#ff6a3d] px-5 text-sm text-white hover:bg-[#ff5a28]"
            >
              Add Party
            </Button>
          ) : null}
        </div>

        {activeSeller ? (
          <>
            <div className="mt-6 overflow-x-auto rounded-xl border border-[#252932]">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-[#15171c] text-zinc-200">
                  <tr>
                    <th className="px-3 py-3 text-left text-sm">Name</th>
                    <th className="px-3 py-3 text-left text-sm">Place</th>
                    <th className="px-3 py-3 text-left text-sm">Mobile</th>
                    <th className="px-3 py-3 text-right text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[#252932] text-zinc-200">
                    <td className="px-3 py-3 text-sm">{activeSeller.name.toUpperCase()}</td>
                    <td className="px-3 py-3 text-sm">{activeSeller.place || "-"}</td>
                    <td className="px-3 py-3 text-sm">{activeSeller.mob || "-"}</td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openEditSeller(activeSeller)}
                          className="h-8 border-[#2a2d34] bg-[#17191f] text-xs text-zinc-200 hover:bg-[#1d2026]"
                        >
                          Edit Party
                        </Button>
                        <Button
                          type="button"
                          onClick={() => deleteSeller(activeSeller)}
                          className="h-8 border border-[#ff6a3d] bg-[#ff6a3d] text-xs text-white hover:bg-[#ff5a28]"
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 inline-flex rounded-xl border border-[#252932] bg-[#14161b] p-1">
              <button
                type="button"
                onClick={() => setTab("purchase")}
                className={`rounded-lg px-4 py-2 text-sm transition ${
                  tab === "purchase"
                    ? "bg-[#23262e] text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Purchase Details
              </button>
              <button
                type="button"
                onClick={() => setTab("ledger")}
                className={`rounded-lg px-4 py-2 text-sm transition ${
                  tab === "ledger"
                    ? "bg-[#23262e] text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Payment Ledger
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-md border border-[#252932] bg-[#15171c] p-4 text-sm text-zinc-400">
            No sellers found.
          </div>
        )}
      </section>

      {activeSeller && tab === "purchase" ? (
        <section className="rounded-xl border border-[#252932] bg-[#111214] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-100">Purchase Details</h3>
            <Button
              type="button"
              variant="outline"
              onClick={exportPurchaseDetails}
              className="border-[#2a2d34] bg-[#17191f] text-zinc-200 hover:bg-[#1d2026] hover:text-zinc-100"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#252932] bg-[#15171c] p-3">
              <p className="text-sm text-zinc-500">Total Bags</p>
              <p className="text-2xl font-semibold text-zinc-100">
                {formatNumberIN(totals.bags, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl border border-[#252932] bg-[#15171c] p-3">
              <p className="text-sm text-zinc-500">Total Paid</p>
              <p className="text-2xl font-semibold text-zinc-100">
                {formatCurrencyINR(totals.paid, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl border border-[#252932] bg-[#15171c] p-3">
              <p className="text-sm text-zinc-500">Total Amount</p>
              <p className="text-2xl font-semibold text-zinc-100">
                {formatCurrencyINR(totals.amountTotal, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#252932]">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[#15171c] text-zinc-200">
                <tr>
                  <th className="px-3 py-2 text-left">Bill No</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Bags</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Paid</th>
                </tr>
              </thead>
              <tbody>
                {sellerRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                      No purchase records.
                    </td>
                  </tr>
                ) : (
                  sellerRecords.map((row) => (
                    <tr key={row.id} className="border-t border-[#252932] text-zinc-200">
                      <td className="px-3 py-2">{row.bill_no}</td>
                      <td className="px-3 py-2">{row.date}</td>
                      <td className="px-3 py-2 text-right">
                        {formatNumberIN(row.bags, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrencyINR(row.rate)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrencyINR(row.amount)}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrencyINR(paidByRecord.get(row.id) ?? 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeSeller && tab === "ledger" ? (
        <section className="rounded-xl border border-[#252932] bg-[#111214] p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-zinc-100">Payment Ledger</h3>
            <Button
              type="button"
              onClick={() => setPaymentDialogOpen(true)}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              Add Payment
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#252932]">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[#15171c] text-zinc-200">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Mode</th>
                  <th className="px-3 py-2 text-left">Note</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sellerPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                      No payment entries.
                    </td>
                  </tr>
                ) : (
                  sellerPayments.map((payment) => (
                    <tr key={payment.id} className="border-t border-[#252932] text-zinc-200">
                      <td className="px-3 py-2">{payment.paid_on}</td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrencyINR(payment.amount)}
                      </td>
                      <td className="px-3 py-2">{payment.payment_mode.toUpperCase()}</td>
                      <td className="px-3 py-2">{payment.note || "-"}</td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => deletePayment(payment.id)}
                          className="h-8 border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
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
      ) : null}

      {sellerDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-xl rounded-xl border border-[#2a2d34] bg-[#15171c] p-4">
            <h3 className="text-lg font-semibold text-zinc-100">
              {editingSellerId ? "Edit Party" : "Add Party"}
            </h3>
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                className="border-[#2a2d34] bg-[#111214] text-zinc-100"
              />
              <Input
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                placeholder="Place"
                className="border-[#2a2d34] bg-[#111214] text-zinc-100"
              />
              <Input
                value={mob}
                onChange={(event) => setMob(event.target.value)}
                placeholder="Mobile"
                className="border-[#2a2d34] bg-[#111214] text-zinc-100"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSellerDialogOpen(false);
                  resetSellerForm();
                }}
                className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submitSeller}
                disabled={isPending}
                className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              >
                {editingSellerId ? "Update" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentDialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-[#2a2d34] bg-[#15171c] p-4">
            <h3 className="text-lg font-semibold text-zinc-100">Add Payment</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="space-y-1 text-sm text-zinc-400">
                Payment Date
                <Input
                  type="date"
                  value={paidOn}
                  onChange={(event) => setPaidOn(event.target.value)}
                  className={paymentFieldClassName}
                />
              </label>
              <label className="space-y-1 text-sm text-zinc-400">
                Amount
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Enter amount"
                  className={paymentFieldClassName}
                />
              </label>
              <label className="space-y-1 text-sm text-zinc-400">
                Payment Mode
                <select
                  value={paymentMode}
                  onChange={(event) => {
                    const next = event.target.value as
                      | "none"
                      | "cash"
                      | "upi"
                      | "rtgs";
                    setPaymentMode(next);
                    if (next !== "upi") setUpiNumber("");
                    if (next !== "rtgs") setRtgsName("");
                  }}
                  className="h-10 w-full rounded-md border border-[#2a2d34] bg-[#111214] px-3 text-zinc-100"
                >
                  <option value="none">None</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="rtgs">RTGS</option>
                </select>
              </label>
              {paymentMode === "upi" ? (
                <label className="space-y-1 text-sm text-zinc-400">
                  UPI Number (Optional)
                  <Input
                    value={upiNumber}
                    onChange={(event) => setUpiNumber(event.target.value)}
                    placeholder="Enter UPI number"
                    className={paymentFieldClassName}
                  />
                </label>
              ) : null}
              {paymentMode === "rtgs" ? (
                <label className="space-y-1 text-sm text-zinc-400">
                  RTGS Name (Optional)
                  <Input
                    value={rtgsName}
                    onChange={(event) => setRtgsName(event.target.value)}
                    placeholder="Enter RTGS name"
                    className={paymentFieldClassName}
                  />
                </label>
              ) : null}
              <label className="space-y-1 text-sm text-zinc-400 md:col-span-2">
                Note (Optional)
                <Input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Enter note"
                  className={paymentFieldClassName}
                />
              </label>
              <div className="md:col-span-2">
                <p className="mb-1 text-sm text-zinc-400">Record Allocation</p>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-[#2a2d34] bg-[#111214] p-2">
                  {sellerRecords.length === 0 ? (
                    <p className="text-sm text-zinc-500">No purchase records to allocate.</p>
                  ) : (
                    sellerRecords.map((record) => (
                      <div key={record.id} className="grid grid-cols-12 items-center gap-2">
                        <div className="col-span-7 text-xs text-zinc-300">
                          Bill {record.bill_no} · {record.date} · {formatCurrencyINR(record.amount)}
                        </div>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={allocationDraft[record.id] ?? ""}
                          onChange={(event) =>
                            setAllocationDraft((current) => ({
                              ...current,
                              [record.id]: event.target.value,
                            }))
                          }
                          placeholder="0"
                          className="col-span-5 h-9 border-[#2a2d34] bg-[#15171c] text-zinc-100"
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPaymentDialogOpen(false)}
                className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={submitPayment}
                disabled={isPending}
                className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
