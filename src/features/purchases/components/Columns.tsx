"use client";

import { ColumnDef } from "@tanstack/react-table";
import { PaymentMethod, Purchase } from "@/features/purchases/schemas";
import { Button } from "@/components/ui/button";
import { Edit, Eye, ReceiptText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import {
  deletePurchaseAction,
  generateBillFromPurchaseAction,
} from "@/app/purchases/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { stripIndiaCountryCode } from "@/lib/phone-format";

function PurchaseActionsCell({ purchase }: { purchase: Purchase }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const previewBillNumber = String(purchase.bill_no || "-");
  const isManual = purchase.source === "manual";
  const billToPhone = stripIndiaCountryCode(purchase.mob);
  const previewTotalText = formatCurrencyINR(purchase.final_total, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const previewTotalValueSizeClass =
    previewTotalText.length >= 12
      ? "bill-print-total-value-sm"
      : previewTotalText.length >= 10
        ? "bill-print-total-value-md"
        : "";

  const handleDelete = () => {
    if (isManual) return;
    setConfirmOpen(true);
  };

  const confirmDelete = () => {
    startTransition(async () => {
      try {
        await deletePurchaseAction(purchase.id);
        toast.success("Purchase deleted");
        setConfirmOpen(false);
        router.refresh();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to delete purchase";
        toast.error(message);
      }
    });
  };

  const handleGenerateBill = () => {
    setGenerateOpen(true);
  };

  const confirmGenerateBill = () => {
    startTransition(async () => {
      try {
        const bill = await generateBillFromPurchaseAction(purchase.id);
        const printUrl = `/bills/${bill.id}/print?pid=${purchase.id}`;

        // Keep user on the same page and print using a hidden iframe.
        const iframe = document.createElement("iframe");
        iframe.style.position = "fixed";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        iframe.style.opacity = "0";
        iframe.style.pointerEvents = "none";
        iframe.src = printUrl;
        document.body.appendChild(iframe);

        window.setTimeout(() => {
          iframe.remove();
        }, 60000);

        toast.success("Bill generated from purchase");
        setGenerateOpen(false);
        router.refresh();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to generate bill";
        toast.error(message);
      }
    });
  };

  return (
    <>
      <div className="flex justify-end gap-1 pr-2">
        <Link href={`/purchases/${purchase.id}/edit`}>
          <Button
            variant="ghost"
            size="icon"
            disabled={isManual || isPending}
            title={isManual ? "Manual entries are read-only" : "Edit"}
          >
            {isManual ? (
              <Eye className="h-4 w-4" />
            ) : (
              <Edit className="h-4 w-4" />
            )}
          </Button>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          disabled={isPending}
          title="Generate Bill"
          onClick={handleGenerateBill}
        >
          <ReceiptText className="h-4 w-4 text-emerald-600" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          disabled={isManual || isPending}
          title={isManual ? "Manual entries are read-only" : "Delete"}
          onClick={handleDelete}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          showCloseButton={false}
          className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
        >
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Delete Purchase</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete this purchase? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="-mx-4 -mb-4 rounded-b-xl border-t border-[#2a2d34] bg-[#15171c] p-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setConfirmOpen(false)}
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

      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent
          showCloseButton={false}
          className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.55)] sm:max-w-xl"
        >
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Generate Bill</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Preview the invoice below, then click Generate Bill.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto rounded-md border border-[#2a2d34] bg-[#1b1e24] p-3">
            <div className="bill-print-root bill-print-preview bill-print-inline-preview p-2 sm:p-3">
              <section
                className="bill-print-copy mx-auto"
                style={{ width: "480px", height: "600px", maxWidth: "100%" }}
              >
                <header className="bill-print-header">
                  <div className="bill-print-brand-row">
                    <div className="bill-print-brand">
                      <div className="bill-print-logo-mark">MB</div>
                      <div className="bill-print-title">MB Groups</div>
                    </div>
                    <div className="bill-print-invoice-box">
                      <div className="bill-print-invoice-label">
                        ESTIMATION INVOICE
                      </div>
                      <div className="bill-print-invoice-number">
                        {previewBillNumber}
                      </div>
                    </div>
                  </div>
                </header>

                <section className="bill-print-info">
                  <div className="bill-print-info-left">
                    <div className="bill-print-yard">APMC Yard</div>
                    <div>Honnali</div>
                    <div>Harish Putta :- 9019800731</div>
                    <div>
                      Jagadish&nbsp;&nbsp;&nbsp;&nbsp;:-&nbsp;&nbsp;7795953398
                    </div>
                  </div>
                  <div className="bill-print-info-right">
                    <div className="bill-print-kv">
                      <span className="bill-print-icon">◼</span>
                      <span>DATE:</span> <strong>{purchase.date}</strong>
                    </div>
                    <div className="bill-print-kv">
                      <span className="bill-print-icon">◼</span>
                      <span>BILL TO:</span>{" "}
                      <strong>{purchase.name || "-"}</strong>
                    </div>
                    <div className="bill-print-kv">
                      <span className="bill-print-icon">◼</span>
                      <span>PHONE:</span> <strong>{billToPhone}</strong>
                    </div>
                    <div className="bill-print-kv">
                      <span className="bill-print-icon">◉</span>
                      <span>PLACE:</span>{" "}
                      <strong>{purchase.place || "-"}</strong>
                    </div>
                  </div>
                </section>

                <table className="bill-print-table bill-print-main-table">
                  <tbody>
                    <tr>
                      <th>DESCRIPTION</th>
                      <th>AMOUNT</th>
                    </tr>
                    <tr>
                      <td>WEIGHT</td>
                      <td>
                        {formatNumberIN(purchase.weight, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td>LESS</td>
                      <td>
                        {formatNumberIN(purchase.less_weight, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td>NET WEIGHT</td>
                      <td>
                        {formatNumberIN(purchase.net_weight, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                    <tr>
                      <td>RATE</td>
                      <td>
                        {formatCurrencyINR(purchase.rate, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                    <tr className="bill-print-key-row">
                      <td>AMOUNT</td>
                      <td>
                        {formatCurrencyINR(purchase.amount, {
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <section className="bill-print-note-row">
                  <div className="bill-print-note-left">
                    Make all checks payable to MB GROUPS.
                    <br />
                    Send this bill nd bank passbook to whastapp
                    9019800731/7795953398
                    <span className="bill-print-note-icons">● 🏦</span>
                  </div>
                  <div className="bill-print-note-right" />
                </section>

                <section className="bill-print-sign-row">
                  <div className="bill-print-sign">
                    <div className="bill-print-sign-title">
                      Farmer Signature
                    </div>
                    <div className="bill-print-sign-line" />
                    <div className="bill-print-sign-caption">
                      Farmer Signature
                    </div>
                  </div>
                  <table className="bill-print-table bill-print-summary-table">
                    <tbody>
                      <tr>
                        <td>AMOUNT</td>
                        <td>
                          {formatCurrencyINR(purchase.amount, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td>BAG LESS</td>
                        <td>
                          {formatCurrencyINR(purchase.bag_less, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td>CASH</td>
                        <td>
                          {formatCurrencyINR(purchase.cash_paid, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                      </tr>
                      <tr>
                        <td>EXTRA</td>
                        <td>
                          {formatCurrencyINR(purchase.add_amount, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                          })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </section>

                <footer className="bill-print-total-row">
                  <div className="bill-print-thanks">
                    THANK YOU FOR YOUR BUSINESS!
                  </div>
                  <div className="bill-print-total-label">TOTAL</div>
                  <div
                    className={`bill-print-total-value ${previewTotalValueSizeClass}`.trim()}
                  >
                    {previewTotalText}
                  </div>
                </footer>
              </section>
            </div>
          </div>
          <DialogFooter className="-mx-4 -mb-4 rounded-b-xl border-t border-[#2a2d34] bg-[#15171c] p-4">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setGenerateOpen(false)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={confirmGenerateBill}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? "Generating..." : "Generate Bill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export interface PurchaseColumnOptions {
  paymentMethodById: Record<string, PaymentMethod>;
  onPaymentMethodChange: (purchaseId: string, method: PaymentMethod) => void;
}

const paymentSelectOptions: { label: string; value: PaymentMethod }[] = [
  { label: "RTGS", value: "RTGS" },
  { label: "UPI", value: "UPI" },
  { label: "None", value: "none" },
];

export function createPurchaseColumns(
  options: PurchaseColumnOptions,
): ColumnDef<Purchase>[] {
  const { paymentMethodById, onPaymentMethodChange } = options;

  return [
    {
      id: "bill_no",
      header: "BILL NO",
      cell: ({ row }) => row.original.bill_no || "-",
    },
    {
      accessorKey: "name",
      header: "NAME",
    },
    {
      accessorKey: "date",
      header: "DATE",
      cell: ({ row }) => {
        const rawDate = String(row.getValue("date"));
        try {
          return format(parseISO(rawDate), "dd-MM-yyyy");
        } catch {
          return rawDate;
        }
      },
    },
    {
      accessorKey: "place",
      header: "PLACE",
    },
    {
      accessorKey: "mob",
      header: "MOB",
    },
    {
      accessorKey: "bags",
      header: "BAGS",
    },
    {
      accessorKey: "weight",
      header: "WEIGHT",
    },
    {
      accessorKey: "less_weight",
      header: "LESS",
    },
    {
      accessorKey: "net_weight",
      header: "NET WEIGHT",
    },
    {
      accessorKey: "rate",
      header: "RATE",
      cell: ({ row }) => {
        const amount = Number(row.getValue("rate"));
        return formatCurrencyINR(amount);
      },
    },
    {
      accessorKey: "amount",
      header: "AMOUNT",
      cell: ({ row }) => {
        const amount = Number(row.getValue("amount"));
        return formatCurrencyINR(amount);
      },
    },
    {
      accessorKey: "bag_less",
      header: "LESS",
      cell: ({ row }) => {
        const amount = Number(row.getValue("bag_less"));
        return formatCurrencyINR(amount);
      },
    },
    {
      accessorKey: "add_amount",
      header: "ADD",
      cell: ({ row }) => {
        const amount = Number(row.getValue("add_amount"));
        return formatCurrencyINR(amount);
      },
    },
    {
      accessorKey: "cash_paid",
      header: "CASH",
      cell: ({ row }) => {
        const amount = Number(row.getValue("cash_paid"));
        return formatCurrencyINR(amount);
      },
    },
    {
      accessorKey: "upi_paid",
      header: "PHONE PAY",
      cell: ({ row }) => {
        const amount = Number(row.getValue("upi_paid"));
        return formatCurrencyINR(amount);
      },
    },
    {
      accessorKey: "final_total",
      header: "TOTAL AMOUNT",
      cell: ({ row }) => {
        const amount = Number(row.getValue("final_total"));
        return <div className="font-medium">{formatCurrencyINR(amount)}</div>;
      },
    },
    {
      id: "payment_through",
      header: "PAYMENT THROUGH",
      cell: ({ row }) => {
        const purchaseId = row.original.id;
        const current = paymentMethodById[purchaseId] ?? "none";
        return (
          <select
            value={current}
            onChange={(event) =>
              onPaymentMethodChange(
                purchaseId,
                event.target.value as PaymentMethod,
              )
            }
            className="w-full cursor-pointer rounded border border-[#2a2d34] bg-[#17191f] px-2 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-300"
          >
            {paymentSelectOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      id: "mode",
      header: "MODE",
      cell: ({ row }) => {
        return String(row.original.source || "").toUpperCase();
      },
    },
    {
      accessorKey: "bag_avg",
      header: "BAG AVG",
      cell: ({ row }) => {
        const avg = Number(row.getValue("bag_avg"));
        return formatNumberIN(avg);
      },
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => {
        const purchase = row.original;
        return <PurchaseActionsCell purchase={purchase} />;
      },
      meta: {
        sticky: true,
        right: "0px",
        zIndex: 30,
        width: "132px",
        headClassName: "bg-[#15171c] border-l border-[#252932]",
        cellClassName: "bg-[#111214] border-l border-[#252932]",
        boxShadow: "-8px 0 12px rgba(0, 0, 0, 0.45)",
      },
    },
  ];
}
