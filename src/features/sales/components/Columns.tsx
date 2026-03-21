"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Edit, FileText, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addDays, format, isValid, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { Sale } from "@/features/sales/schemas";
import {
  deleteSaleAction,
  generateSalesInvoiceAction,
} from "@/app/sales/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Company } from "@/features/companies/schemas";
import { Input } from "@/components/ui/input";

function SaleActionsCell({
  sale,
  issuerCompanies,
}: {
  sale: Sale;
  issuerCompanies: Company[];
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [previewInvoiceId, setPreviewInvoiceId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [issuedOn, setIssuedOn] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const defaultIssuerId = useMemo(() => {
    if (
      sale.issuer_company_id &&
      issuerCompanies.some((company) => company.id === sale.issuer_company_id)
    ) {
      return sale.issuer_company_id;
    }
    return issuerCompanies[0]?.id ?? "";
  }, [issuerCompanies, sale.issuer_company_id]);
  const [selectedIssuerId, setSelectedIssuerId] = useState(defaultIssuerId);

  useEffect(() => {
    setSelectedIssuerId(defaultIssuerId);
  }, [defaultIssuerId]);

  const confirmDelete = () => {
    startTransition(async () => {
      try {
        const result = await deleteSaleAction(sale.id);
        if (!result.success) {
          toast.error(result.message);
          return;
        }
        toast.success("Sale deleted");
        setConfirmOpen(false);
        router.refresh();
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to delete sale";
        toast.error(message);
      }
    });
  };

  const handleOpenGenerate = () => {
    if (issuerCompanies.length === 0) {
      toast.error("No active issuer company found. Add one in Companies.");
      return;
    }
    setPreviewInvoiceId(null);
    setIssuedOn(format(new Date(), "yyyy-MM-dd"));
    setSelectedIssuerId(defaultIssuerId);
    setGenerateOpen(true);

    startTransition(async () => {
      try {
        const invoice = await generateSalesInvoiceAction({
          saleIds: [sale.id],
          issuerCompanyId: defaultIssuerId,
          issuedOn: format(new Date(), "yyyy-MM-dd"),
        });
        setPreviewInvoiceId(invoice.id);
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to generate bill";
        toast.error(message);
      }
    });
  };

  const handlePrintBill = () => {
    if (!previewInvoiceId) {
      toast.error("Generate preview first");
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.src = `/sales/invoices/${previewInvoiceId}/print`;
    document.body.appendChild(iframe);

    window.setTimeout(() => {
      iframe.remove();
    }, 60000);
  };

  return (
    <>
      <div className="flex justify-end gap-1 pr-2">
        <Link href={`/sales/${sale.id}/edit`}>
          <Button
            variant="ghost"
            size="icon"
            title="Edit sale"
            className="cursor-pointer"
          >
            <Edit className="h-4 w-4" />
          </Button>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Generate Bill"
          disabled={isPending}
          onClick={handleOpenGenerate}
          className="cursor-pointer"
        >
          <FileText className="h-4 w-4 text-emerald-500" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Delete sale"
          disabled={isPending}
          onClick={() => setConfirmOpen(true)}
          className="cursor-pointer"
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
            <DialogTitle className="text-zinc-100">Delete Sale</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Are you sure you want to delete this sale? This action cannot be
              undone.
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

      <Dialog
        open={generateOpen}
        onOpenChange={(open) => {
          setGenerateOpen(open);
          if (!open) {
            setPreviewInvoiceId(null);
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="flex h-[95vh] max-h-[95vh] min-w-[48vw] w-auto max-w-[98vw] flex-col overflow-hidden border border-[#2a2d34] bg-[#15171c] text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.55)] sm:max-w-[98vw]"
        >
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Generate Bill</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Preview the invoice, then print.
            </DialogDescription>
          </DialogHeader>

          {/* Inputs removed as requested */}

          <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-[#2a2d34] bg-white p-2 text-center">
            {previewInvoiceId ? (
              <div className="relative flex h-full w-full items-center justify-center overflow-hidden ">
                <div
                  className="min-w-[45vw] h-full p-2"
                  style={{
                    transform:
                      "translate(-50%, -50%) scale(min(calc(100cqw / 794), calc(100cqh / 1123)))",
                    transformOrigin: "center center",
                  }}
                >
                  <iframe
                    title={`Sales Bill Preview ${sale.id}`}
                    src={`/sales/invoices/${previewInvoiceId}/print?preview=1`}
                    // className="block border-0 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 text-sm text-zinc-800">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-700" />
                <div className="font-medium">
                  {isPending
                    ? "Generating invoice preview..."
                    : "Preparing preview..."}
                </div>
              </div>
            )}
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
              disabled={!previewInvoiceId || isPending}
              onClick={handlePrintBill}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              Print Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function createSaleColumns(
  issuerCompanies: Company[],
  pendingBySaleId: Record<string, number>,
): ColumnDef<Sale>[] {
  const parseTermDays = (terms: string | null | undefined) => {
    const parsed = Number.parseInt(String(terms ?? "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  };

  const getDueDate = (sale: Sale) => {
    const saleDate = parseISO(sale.sale_date);
    if (!isValid(saleDate)) return null;
    return addDays(saleDate, parseTermDays(sale.payment_terms));
  };

  return [
    {
      accessorKey: "bill_number",
      header: "BILL NUM",
    },
    {
      accessorKey: "sale_date",
      header: "DATE",
      cell: ({ row }) => {
        const rawDate = String(row.getValue("sale_date"));
        try {
          return format(parseISO(rawDate), "dd-MM-yyyy");
        } catch {
          return rawDate;
        }
      },
    },
    {
      accessorKey: "lorry_number",
      header: "LORRY NUM",
    },
    {
      accessorKey: "bags",
      header: "BAGS",
      cell: ({ row }) =>
        formatNumberIN(row.original.bags, { maximumFractionDigits: 0 }),
    },
    {
      accessorKey: "net_weight",
      header: "NET WEIGHT",
      cell: ({ row }) => formatNumberIN(row.original.net_weight),
    },
    {
      accessorKey: "factory_weight",
      header: "FACTORY",
      cell: ({ row }) => formatNumberIN(row.original.factory_weight),
    },
    {
      accessorKey: "rate",
      header: "RATE",
      cell: ({ row }) => formatNumberIN(row.original.rate),
    },
    {
      accessorKey: "flight",
      header: "FLIGHT",
      cell: ({ row }) => formatNumberIN(row.original.flight),
    },
    {
      accessorKey: "amount",
      header: "AMOUNT",
      cell: ({ row }) => formatCurrencyINR(row.original.amount),
    },
    {
      accessorKey: "party",
      header: "PARTY",
    },
    {
      accessorKey: "payment_terms",
      header: "PAYMENT",
      cell: ({ row }) => row.original.payment_terms || "-",
    },
    {
      accessorKey: "pending_amount",
      header: "PENDING",
      cell: ({ row }) =>
        formatCurrencyINR(
          Math.max(
            pendingBySaleId[row.original.id] ?? row.original.pending_amount,
            0,
          ),
        ),
    },
    {
      id: "due_date",
      header: "DUE DATE",
      cell: ({ row }) => {
        const dueDate = getDueDate(row.original);
        if (!dueDate) return "-";
        return format(dueDate, "yyyy-MM-dd");
      },
      meta: {
        width: "160px",
        headClassName: "whitespace-nowrap",
      },
    },
    {
      id: "actions",
      header: "ACTIONS",
      cell: ({ row }) => (
        <SaleActionsCell
          sale={row.original}
          issuerCompanies={issuerCompanies}
        />
      ),
      meta: {
        sticky: true,
        right: "0",
        zIndex: 4,
        width: "120px",
        headClassName: "whitespace-nowrap text-right pr-4",
        cellClassName: "text-right",
        boxShadow: "-8px 0 18px rgba(6, 8, 13, 0.45)",
      },
    },
  ];
}
