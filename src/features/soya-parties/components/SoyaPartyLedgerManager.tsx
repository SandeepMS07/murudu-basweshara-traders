"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addDays, format, isValid, parseISO } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Printer,
  Receipt,
} from "lucide-react";

import {
  Company,
  CompanyPayment,
  CompanyPaymentAllocation,
} from "@/features/companies/schemas";
import { Sale } from "@/features/sales/schemas";
import {
  createSoyaPartyPaymentAction,
  createSoyaPartyCompanyAction,
  deleteSoyaPartyPaymentAction,
  deleteSoyaPartyCompanyAction,
  updateSoyaPartyCompanyAction,
} from "@/app/soya/parties/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { computeEffectiveSalePending } from "@/features/companies/lib/payment-allocation";
import { exportWorkbookToXlsx } from "@/lib/excel/client-export";
import { printIframeAs } from "@/lib/print-iframe";

type CompanyDraft = {
  type: "issuer" | "buyer";
  name: string;
  display_name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  invoice_prefix: string;
  is_active: boolean;
  is_default: boolean;
};

const emptyDraft: CompanyDraft = {
  type: "buyer",
  name: "",
  display_name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  gstin: "",
  invoice_prefix: "",
  is_active: true,
  is_default: false,
};

interface SoyaPartyLedgerManagerProps {
  companies: Company[];
  sales: Sale[];
  payments: CompanyPayment[];
  allocations: CompanyPaymentAllocation[];
}

/**
 * Party master + receivables ledger for Soya Parties.
 *
 * Copied once from the maize CompaniesManager rather than extracted out of it:
 * that component is live revenue-carrying code with no test coverage, and the
 * brief is that the maize side must not be touched. The row types stay the maize
 * ones (SoyaCompany is an alias of Company, SoyaTrade of Sale), so the FIFO
 * allocator and the statement view are reused verbatim.
 */
export function SoyaPartyLedgerManager({
  companies,
  sales,
  payments,
  allocations,
}: SoyaPartyLedgerManagerProps) {
  // Soya is admin-only and the page guard already enforces it, so there is no
  // per-module edit gate here.
  const canEdit = true;
  const [data, setData] = useState(companies);
  const [paymentData, setPaymentData] = useState(payments);
  const [allocationData, setAllocationData] = useState(allocations);
  const [draft, setDraft] = useState<CompanyDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [activeBuyerId, setActiveBuyerId] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState<"sales" | "ledger">("sales");
  const [statementOpen, setStatementOpen] = useState(false);
  const statementFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [isPending, startTransition] = useTransition();

  const buyerCompanies = useMemo(
    () =>
      data.filter((company) => company.type === "buyer" && company.is_active),
    [data],
  );
  const salesByCompany = useMemo(() => {
    const grouped = new Map<string, Sale[]>();
    for (const sale of sales) {
      if (!sale.sale_company_id) continue;
      const current = grouped.get(sale.sale_company_id) ?? [];
      current.push(sale);
      grouped.set(sale.sale_company_id, current);
    }
    return grouped;
  }, [sales]);

  const activeBuyer = useMemo(() => {
    if (buyerCompanies.length === 0) return null;
    if (
      activeBuyerId &&
      buyerCompanies.some((company) => company.id === activeBuyerId)
    ) {
      return (
        buyerCompanies.find((company) => company.id === activeBuyerId) ?? null
      );
    }
    return buyerCompanies[0];
  }, [activeBuyerId, buyerCompanies]);

  const activeBuyerSales = useMemo(() => {
    if (!activeBuyer) return [];
    return salesByCompany.get(activeBuyer.id) ?? [];
  }, [activeBuyer, salesByCompany]);
  const activeBuyerPayments = useMemo(() => {
    if (!activeBuyer) return [];
    return paymentData.filter(
      (payment) => payment.company_id === activeBuyer.id,
    );
  }, [activeBuyer, paymentData]);
  const activeBuyerSaleIdSet = useMemo(
    () => new Set(activeBuyerSales.map((sale) => sale.id)),
    [activeBuyerSales],
  );
  const activeBuyerAllocations = useMemo(
    () =>
      allocationData.filter((allocation) =>
        activeBuyerSaleIdSet.has(allocation.sale_id),
      ),
    [activeBuyerSaleIdSet, allocationData],
  );
  const activeBuyerPending = useMemo(
    () =>
      computeEffectiveSalePending(
        activeBuyerSales,
        activeBuyerPayments,
        activeBuyerAllocations,
      ),
    [activeBuyerAllocations, activeBuyerPayments, activeBuyerSales],
  );

  const submitDraft = () => {
    startTransition(async () => {
      try {
        if (editingId) {
          const updated = await updateSoyaPartyCompanyAction(editingId, draft);
          setData((current) =>
            current.map((item) => (item.id === updated.id ? updated : item)),
          );
          toast.success("Company updated");
        } else {
          const created = await createSoyaPartyCompanyAction(draft);
          setData((current) => [...current, created]);
          toast.success("Company created");
        }
        setDraft(emptyDraft);
        setEditingId(null);
        setFormOpen(false);
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save company",
        );
      }
    });
  };

  const startEdit = (company: Company) => {
    setEditingId(company.id);
    setDraft({
      type: company.type,
      name: company.name,
      display_name: company.display_name,
      code: company.code,
      address: company.address,
      phone: company.phone,
      email: company.email,
      gstin: company.gstin,
      invoice_prefix: company.invoice_prefix,
      is_active: company.is_active,
      is_default: company.is_default,
    });
    setFormOpen(true);
  };

  const removeCompany = (id: string) => {
    startTransition(async () => {
      try {
        const result = await deleteSoyaPartyCompanyAction(id);
        if (result.status === "deleted") {
          setData((current) => current.filter((item) => item.id !== id));
          if (editingId === id) {
            setEditingId(null);
            setDraft(emptyDraft);
          }
          toast.success(result.message);
        } else {
          setData((current) =>
            current.map((item) =>
              item.id === id
                ? { ...item, is_active: false, is_default: false }
                : item,
            ),
          );
          toast.info(result.message);
        }
        if (deleteTarget?.id === id) {
          setDeleteTarget(null);
        }
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete company",
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[#252932] bg-[#111214] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="inline-flex rounded-md border border-[#252932] bg-[#14161b] px-3 py-1.5 text-sm text-zinc-300">
            Sale Companies
          </div>
          {canEdit ? (
            <Button
              type="button"
              onClick={() => {
                setEditingId(null);
                setDraft(emptyDraft);
                setFormOpen(true);
              }}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              Add Company
            </Button>
          ) : null}
        </div>

        <div className="mt-3 space-y-3">
          <div className="overflow-x-auto hide-scrollbar">
            <div className="inline-flex min-w-max gap-2 whitespace-nowrap">
              {buyerCompanies.map((company) => (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => setActiveBuyerId(company.id)}
                  className={`rounded-md border px-3 py-2 text-sm transition ${
                    activeBuyer?.id === company.id
                      ? "border-[#ff6a3d] bg-[#2a1d1a] text-[#ffb39a]"
                      : "border-[#252932] bg-[#15171c] text-zinc-300 hover:text-zinc-100"
                  }`}
                >
                  {company.display_name || company.name}
                </button>
              ))}
            </div>
          </div>

          {activeBuyer ? (
            <>
              <CompanyTable
                data={[activeBuyer]}
                onEdit={startEdit}
                onDelete={(company) => setDeleteTarget(company)}
                isPending={isPending}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex rounded-md border border-[#252932] bg-[#14161b] p-1">
                  <button
                    type="button"
                    onClick={() => setDetailsTab("sales")}
                    className={`cursor-pointer rounded-sm px-3 py-1.5 text-sm transition ${
                      detailsTab === "sales"
                        ? "bg-[#23262e] text-zinc-100"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    Sale Details
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
                <button
                  type="button"
                  onClick={() => setStatementOpen(true)}
                  className="inline-flex items-center rounded-md border border-[#2a2d34] bg-[#1b1e24] px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-[#23262e] hover:text-zinc-100"
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  View Statement
                </button>
              </div>

              {detailsTab === "sales" ? (
                <SalesDetailsTable
                  companyName={activeBuyer.display_name || activeBuyer.name}
                  sales={activeBuyerSales}
                  payments={activeBuyerPayments}
                  pendingBySaleId={activeBuyerPending.pendingBySaleId}
                  companies={data}
                />
              ) : (
                <CompanyPaymentsLedger
                  companyId={activeBuyer.id}
                  sales={activeBuyerSales}
                  payments={activeBuyerPayments}
                  allocations={activeBuyerAllocations}
                  companies={data}
                  pendingBySaleId={activeBuyerPending.pendingBySaleId}
                  totalAmount={activeBuyerSales.reduce(
                    (sum, sale) => sum + sale.amount,
                    0,
                  )}
                  onCreate={(payment, createdAllocations) => {
                    setPaymentData((current) => [payment, ...current]);
                    if (createdAllocations.length > 0) {
                      setAllocationData((current) => [
                        ...createdAllocations,
                        ...current,
                      ]);
                    }
                  }}
                  onDelete={(paymentId) => {
                    setPaymentData((current) =>
                      current.filter((payment) => payment.id !== paymentId),
                    );
                    setAllocationData((current) =>
                      current.filter(
                        (allocation) => allocation.payment_id !== paymentId,
                      ),
                    );
                  }}
                />
              )}
            </>
          ) : (
            <div className="rounded-md border border-[#252932] bg-[#15171c] p-4 text-sm text-zinc-400">
              No sale companies found.
            </div>
          )}
        </div>
      </section>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Company" : "Add Company"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-sm text-zinc-400">
              Type
              <select
                className="h-10 w-full rounded-md border border-[#2a2d34] bg-[#14161b] px-3 text-zinc-100"
                value={draft.type}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    type: event.target.value as "issuer" | "buyer",
                  }))
                }
              >
                <option value="buyer">Buyer</option>
                <option value="issuer">Issuer</option>
              </select>
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Name
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Display Name
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.display_name}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    display_name: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Invoice Prefix
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.invoice_prefix}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    invoice_prefix: event.target.value.toUpperCase(),
                  }))
                }
                placeholder={
                  draft.type === "issuer" ? "Required for issuer" : "Optional"
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Code
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.code}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    code: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Phone
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.phone}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    phone: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Email
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.email}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              GSTIN
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.gstin}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    gstin: event.target.value,
                  }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400 md:col-span-2 xl:col-span-3">
              Address
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.address}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
                setDraft(emptyDraft);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={submitDraft}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {editingId ? "Update Company" : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Company?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-zinc-200">
              {deleteTarget?.display_name || deleteTarget?.name}
            </span>
            ? If this company has linked sales or invoices, we will deactivate
            it instead of deleting data.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !deleteTarget}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              onClick={() => {
                if (!deleteTarget) return;
                removeCompany(deleteTarget.id);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={statementOpen} onOpenChange={setStatementOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[90vh] w-[95vw] max-w-5xl flex-col gap-0 overflow-hidden rounded-xl border border-[#2a2d34] bg-[#15171c] p-0 sm:max-w-5xl"
        >
          <div className="flex items-center justify-between border-b border-[#2a2d34] px-4 py-2.5">
            <span className="text-sm font-medium text-zinc-200">
              Statement of Account
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  if (!activeBuyer) return;
                  const name = activeBuyer.display_name || activeBuyer.name;
                  printIframeAs(
                    statementFrameRef.current?.contentWindow,
                    `${name} Statement ${format(new Date(), "dd-MM-yyyy")}`,
                  );
                }}
                className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setStatementOpen(false)}
                className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              >
                Close
              </Button>
            </div>
          </div>
          {activeBuyer && statementOpen ? (
            <iframe
              ref={statementFrameRef}
              src={`/soya/parties/companies/${activeBuyer.id}/statement?embed=1`}
              title="Statement of Account"
              className="min-h-0 flex-1 bg-white"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompanyTable({
  data,
  onEdit,
  onDelete,
  isPending,
}: {
  data: Company[];
  onEdit: (company: Company) => void;
  onDelete: (company: Company) => void;
  isPending: boolean;
}) {
  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-[#252932]">
      <table className="w-full min-w-[980px] border-collapse text-sm text-zinc-200">
        <thead className="bg-[#15171c]">
          <tr>
            <th className="border-b border-[#252932] px-3 py-2 text-left">
              Name
            </th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">
              Code
            </th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">
              GSTIN
            </th>
            <th className="w-[260px] border-b border-[#252932] px-3 py-2 text-left">
              Email
            </th>
            <th className="w-[360px] border-b border-[#252932] px-3 py-2 text-left">
              Address
            </th>
            <th className="sticky right-0 z-10 border-b border-l border-[#252932] bg-[#15171c] px-3 py-2 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-zinc-500" colSpan={6}>
                No companies found.
              </td>
            </tr>
          ) : (
            data.map((company) => (
              <tr
                key={company.id}
                className="border-b border-[#252932] last:border-b-0"
              >
                <td className="px-3 py-2">{company.name}</td>
                <td className="px-3 py-2">{company.code || "-"}</td>
                <td className="px-3 py-2">{company.gstin || "-"}</td>
                <td
                  className="max-w-[260px] break-words px-3 py-2 align-top"
                  title={company.email || ""}
                >
                  {company.email || "-"}
                </td>
                <td className="max-w-[360px] whitespace-normal break-words px-3 py-2 align-top">
                  {company.address || "-"}
                </td>
                <td className="sticky right-0 z-10 border-l border-[#252932] bg-[#111214] px-3 py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
                      onClick={() => onEdit(company)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                      className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
                      onClick={() => onDelete(company)}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SalesDetailsTable({
  companyName,
  sales,
  payments,
  pendingBySaleId,
  companies,
}: {
  companyName: string;
  sales: Sale[];
  payments: CompanyPayment[];
  pendingBySaleId: Record<string, number>;
  companies: Company[];
}) {
  const PAGE_SIZE = 8;
  const companyNameById = useMemo(
    () =>
      new Map(companies.map((c) => [c.id, c.display_name || c.name])),
    [companies],
  );
  const totalAmount = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalPending = sales.reduce(
    (sum, sale) => sum + (pendingBySaleId[sale.id] ?? sale.pending_amount),
    0,
  );
  const totalBags = sales.reduce((sum, sale) => sum + sale.bags, 0);
  const [page, setPage] = useState(1);
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sales.slice(start, start + PAGE_SIZE);
  }, [currentPage, sales]);

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

  const totalOverduePending = sales.reduce((sum, sale) => {
    const dueDate = getDueDate(sale);
    if (!dueDate) return sum;
    const dueStart = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate(),
    );
    if (dueStart.getTime() >= todayStart.getTime()) return sum;
    const pending = pendingBySaleId[sale.id] ?? sale.pending_amount;
    if (pending <= 0) return sum;
    return sum + pending;
  }, 0);

  const getRowDueStatus = (sale: Sale) => {
    const dueDate = getDueDate(sale);
    if (!dueDate) return "unknown" as const;
    const dueStart = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate(),
    );
    const effectivePending = pendingBySaleId[sale.id] ?? sale.pending_amount;
    if (effectivePending <= 0) return "cleared" as const;
    if (dueStart.getTime() < todayStart.getTime()) return "overdue" as const;
    if (dueStart.getTime() === todayStart.getTime())
      return "due_today" as const;
    return "upcoming" as const;
  };

  const getRowClassName = (sale: Sale) => {
    const status = getRowDueStatus(sale);
    if (status === "overdue")
      return "bg-[#2a1111]/40 text-[#f5d3d3] hover:bg-[#361616]/50";
    if (status === "due_today")
      return "bg-[#2a2412]/40 text-[#f7e3b0] hover:bg-[#352d16]/50";
    if (status === "cleared")
      return "bg-[#102015]/30 text-[#c7f2d2] hover:bg-[#16301f]/45";
    return "";
  };

  const formatDueDate = (sale: Sale) => {
    const dueDate = getDueDate(sale);
    if (!dueDate) return "-";
    return format(dueDate, "dd-MM-yyyy");
  };

  const getOverdueDays = (sale: Sale) => {
    const dueDate = getDueDate(sale);
    if (!dueDate) return null;
    const dueStart = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate(),
    );
    const effectivePending = pendingBySaleId[sale.id] ?? sale.pending_amount;
    if (effectivePending <= 0) return null;
    const diffMs = todayStart.getTime() - dueStart.getTime();
    if (diffMs <= 0) return null;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };

  const formatDisplayDate = (value: string) => {
    try {
      return format(parseISO(value), "dd-MM-yyyy");
    } catch {
      return value;
    }
  };

  const handleExportCompanySales = () => {
    const totalReceived = payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );
    const totalPendingSummary = sales.reduce(
      (sum, sale) => sum + (pendingBySaleId[sale.id] ?? sale.pending_amount),
      0,
    );
    const totalAmountSummary = sales.reduce((sum, sale) => sum + sale.amount, 0);

    const summaryRows = [
      { Metric: "Company", Value: companyName },
      { Metric: "Total Sales Amount", Value: totalAmountSummary },
      { Metric: "Total Received", Value: totalReceived },
      { Metric: "Total Pending", Value: totalPendingSummary },
      { Metric: "No. of Sales Records", Value: sales.length },
      { Metric: "No. of Payment Entries", Value: payments.length },
      {
        Metric: "Exported On",
        Value: format(new Date(), "dd-MM-yyyy HH:mm"),
      },
    ];

    const today = new Date();
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const sortedSales = [...sales].sort((a, b) =>
      b.sale_date.localeCompare(a.sale_date),
    );
    const saleRows = sortedSales.map((sale) => {
      const dueDate = getDueDate(sale);
      const pending = pendingBySaleId[sale.id] ?? sale.pending_amount;
      const dueStart = dueDate
        ? new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
        : null;
      const status =
        pending <= 0
          ? "Cleared"
          : dueStart && dueStart.getTime() < todayStart.getTime()
            ? "Overdue"
            : dueStart && dueStart.getTime() === todayStart.getTime()
              ? "Due Today"
              : "Upcoming";

      return {
        "Bill No": sale.bill_number,
        "Sale Date": formatDisplayDate(sale.sale_date),
        Party: sale.party,
        Lorry: sale.lorry_number || "-",
        Bags: sale.bags,
        "Net Weight (kg)": sale.net_weight,
        "Rate (/kg)": sale.rate,
        Amount: sale.amount,
        Pending: pending,
        "Due Date": dueDate ? format(dueDate, "dd-MM-yyyy") : "-",
        Status: status,
        "Payment Terms": sale.payment_terms || "-",
      };
    });

    let runningBalance = totalAmountSummary;
    const paymentRows = [...payments]
      .sort((a, b) => b.paid_on.localeCompare(a.paid_on))
      .map((payment) => {
        runningBalance -= payment.amount;
        return {
          "Payment Date": formatDisplayDate(payment.paid_on),
          Amount: payment.amount,
          "Running Balance": Math.max(runningBalance, 0),
          Note: payment.note || "-",
          "Payment ID": payment.id,
        };
      });

    exportWorkbookToXlsx(
      [
        {
          name: "Summary",
          rows: summaryRows,
          columnWidths: [24, 24],
        },
        {
          name: "Sales Details",
          rows: saleRows,
          columnWidths: [10, 12, 20, 14, 8, 14, 10, 12, 12, 12, 12, 16],
        },
        {
          name: "Payment Ledger",
          rows: paymentRows,
          columnWidths: [14, 12, 16, 28, 40],
        },
      ],
      {
      fileName: `company-report-${companyName.replace(/\s+/g, "-").toLowerCase()}`,
      emptyMessage: "No company data found",
      }
    );
  };

  return (
    <section className="space-y-3 rounded-md border border-[#252932] bg-[#111214] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Sale Details</h3>
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-400">Records: {sales.length}</div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCompanySales}
            className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
          >
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-2 rounded-md border border-[#3b1b1b] bg-[#2a1111]/40 px-2 py-1 text-xs text-zinc-200">
          <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
          Overdue (date crossed)
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-[#3d3418] bg-[#2a2412]/40 px-2 py-1 text-xs text-zinc-200">
          <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
          Due Today
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-[#1d3a27] bg-[#102015]/30 px-2 py-1 text-xs text-zinc-200">
          <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
          Cleared
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-[#2a2d34] bg-[#15171c] px-2 py-1 text-xs text-zinc-200">
          <span className="h-2 w-2 rounded-full bg-[#71717a]" />
          Upcoming
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
          <div className="text-zinc-500">Total Amount</div>
          <div className="font-semibold text-zinc-100">
            {formatCurrencyINR(totalAmount, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
          <div className="text-zinc-500">Total Pending</div>
          <div className="font-semibold text-zinc-100">
            {formatCurrencyINR(totalPending, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-md border border-[#3b1b1b] bg-[#2a1111]/40 p-2 text-sm">
          <div className="text-zinc-300">Total Overdue</div>
          <div className="font-semibold text-zinc-100">
            {formatCurrencyINR(totalOverduePending, {
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
        <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
          <div className="text-zinc-500">Total Bags</div>
          <div className="font-semibold text-zinc-100">
            {formatNumberIN(totalBags, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#252932]">
        <table className="w-full min-w-[980px] border-collapse text-sm text-zinc-200">
          <thead className="bg-[#15171c]">
            <tr>
              <th className="border-b border-[#252932] px-3 py-2 text-left">
                Bill No
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">
                Issuer
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">
                Date
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">
                Lorry
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">
                Bags
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">
                Net Wt
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">
                Rate
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">
                Amount
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">
                Pending
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">
                Terms
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">
                Due Date
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">
                Overdue Days
              </th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-zinc-500" colSpan={12}>
                  No sales found for this company.
                </td>
              </tr>
            ) : (
              paginatedSales.map((sale) => (
                <tr
                  key={sale.id}
                  className={`border-b border-[#252932] last:border-b-0 ${getRowClassName(sale)}`}
                >
                  <td className="px-3 py-2">{sale.bill_number}</td>
                  <td className="px-3 py-2">
                    {sale.issuer_company_id
                      ? companyNameById.get(sale.issuer_company_id) ?? "-"
                      : "-"}
                  </td>
                  <td className="px-3 py-2">
                    {formatDisplayDate(sale.sale_date)}
                  </td>
                  <td className="px-3 py-2">{sale.lorry_number || "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {formatNumberIN(sale.bags, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatNumberIN(sale.net_weight, {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrencyINR(sale.rate)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrencyINR(sale.amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrencyINR(
                      pendingBySaleId[sale.id] ?? sale.pending_amount,
                    )}
                  </td>
                  <td className="px-3 py-2">{sale.payment_terms || "-"}</td>
                  <td className="px-3 py-2">{formatDueDate(sale)}</td>
                  <td className="px-3 py-2 text-right">
                    {getOverdueDays(sale) ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() =>
            setPage((current) => Math.max(Math.min(current, totalPages) - 1, 1))
          }
          className="cursor-pointer border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
        >
          Previous
        </Button>
        <span className="text-xs text-zinc-500">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() =>
            setPage((current) =>
              Math.min(Math.min(current, totalPages) + 1, totalPages),
            )
          }
          className="cursor-pointer border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
        >
          Next
        </Button>
      </div>
    </section>
  );
}

function CompanyPaymentsLedger({
  companyId,
  sales,
  payments,
  allocations,
  companies,
  pendingBySaleId,
  totalAmount,
  onCreate,
  onDelete,
}: {
  companyId: string;
  sales: Sale[];
  payments: CompanyPayment[];
  allocations: CompanyPaymentAllocation[];
  companies: Company[];
  pendingBySaleId: Record<string, number>;
  totalAmount: number;
  onCreate: (
    payment: CompanyPayment,
    allocations: CompanyPaymentAllocation[],
  ) => void;
  onDelete: (id: string) => void;
}) {
  const PAGE_SIZE = 8;
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [allocationInputs, setAllocationInputs] = useState<
    Record<string, string>
  >({});
  // Tracks which bills have "allocate in full" checked, as a quick-fill
  // alternative to typing the pending amount by hand.
  const [fullAllocationChecked, setFullAllocationChecked] = useState<
    Record<string, boolean>
  >({});
  // Tracks which bills have "round up" checked, and how much was added to
  // the overall payment amount for each so it can be reverted if unchecked
  // or the allocation is edited manually afterwards.
  const [roundUpChecked, setRoundUpChecked] = useState<Record<string, boolean>>(
    {},
  );
  const [roundOffAppliedByBillId, setRoundOffAppliedByBillId] = useState<
    Record<string, number>
  >({});
  // How much was added to the overall payment amount to cover allocations
  // that add up to more than what was typed in "Amount" (e.g. ticking
  // "allocate in full" on a bill that's short of the amount being paid).
  const [appliedGlobalRoundUp, setAppliedGlobalRoundUp] = useState(0);
  // When the payment amount is more than what's allocated to bills below,
  // the leftover normally rolls onto the next pending bill automatically.
  // Checking this instead holds it as an unapplied credit for the company.
  const [holdExtraAsCredit, setHoldExtraAsCredit] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CompanyPayment | null>(null);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const totalPages = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return payments.slice(start, start + PAGE_SIZE);
  }, [currentPage, payments]);

  const totalReceived = useMemo(
    () => payments.reduce((sum, payment) => sum + payment.amount, 0),
    [payments],
  );

  const saleById = useMemo(
    () => new Map(sales.map((sale) => [sale.id, sale])),
    [sales],
  );
  const companyNameById = useMemo(
    () => new Map(companies.map((c) => [c.id, c.display_name || c.name])),
    [companies],
  );
  // Bills a payment covers include both explicit allocations (chosen when the
  // payment was recorded) and the same FIFO effective-allocation used to
  // compute pending/overdue elsewhere, so every payment shows its bills even
  // if no explicit allocation was made for it.
  const effectivePendingResult = useMemo(
    () => computeEffectiveSalePending(sales, payments, allocations),
    [allocations, payments, sales],
  );
  const saleIdsByPaymentId = effectivePendingResult.saleIdsByPaymentId;
  // Money paid that isn't applied to any bill — either because staff chose
  // to hold it as credit instead of letting it roll onto the next bill, or
  // because the company has simply paid more than it's ever been billed.
  const creditBalance = effectivePendingResult.creditByCompanyId[companyId] ?? 0;

  const getPaymentBillInfo = (paymentId: string) => {
    const billSales = (saleIdsByPaymentId[paymentId] ?? [])
      .map((saleId) => saleById.get(saleId))
      .filter((sale): sale is Sale => !!sale);
    const billNumbers =
      billSales.map((sale) => sale.bill_number).join(", ") || "-";
    const issuerNames =
      [
        ...new Set(
          billSales.map(
            (sale) =>
              (sale.issuer_company_id &&
                companyNameById.get(sale.issuer_company_id)) ||
              "-",
          ),
        ),
      ].join(", ") || "-";
    return { billNumbers, issuerNames };
  };

  const formatDisplayDate = (value: string) => {
    try {
      return format(parseISO(value), "dd-MM-yyyy");
    } catch {
      return value;
    }
  };
  const saleAllocationRows = useMemo(
    () =>
      sales
        .map((sale) => {
          const remaining = Math.max(
            pendingBySaleId[sale.id] ?? sale.pending_amount,
            0,
          );
          return { sale, remaining };
        })
        .filter((row) => row.remaining > 0),
    [pendingBySaleId, sales],
  );
  const remaining = Math.max(totalAmount - totalReceived, 0);

  // Keep "allocate in full" bills capped to what's actually available as the
  // payment amount changes (e.g. typed after ticking the checkbox), so they
  // never silently drift past it — bills the user has explicitly rounded up
  // are left alone.
  useEffect(() => {
    const parsedAmountNow = Number(amount) || 0;
    setAllocationInputs((current) => {
      let changed = false;
      const next = { ...current };
      for (const row of saleAllocationRows) {
        if (!fullAllocationChecked[row.sale.id] || roundUpChecked[row.sale.id]) {
          continue;
        }
        const otherAllocated = saleAllocationRows
          .filter((otherRow) => otherRow.sale.id !== row.sale.id)
          .reduce(
            (sum, otherRow) => sum + (Number(current[otherRow.sale.id]) || 0),
            0,
          );
        const available = Math.max(parsedAmountNow - otherAllocated, 0);
        const fillAmount = Math.min(row.remaining, available);
        const fillStr = fillAmount > 0 ? String(fillAmount) : "";
        if (current[row.sale.id] !== fillStr) {
          next[row.sale.id] = fillStr;
          changed = true;
        }
      }
      return changed ? next : current;
    });
    // Only re-run when the payment amount changes; checkbox toggles already
    // set the correct value themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount]);

  // If allocations add up to more than the payment amount (e.g. "allocate in
  // full" was ticked on a bill whose pending is bigger than what's actually
  // being paid), warn instead of letting it through silently — the user must
  // explicitly tick "round up" to bump the payment amount to cover it.
  const totalAllocatedLive = saleAllocationRows.reduce(
    (sum, row) => sum + (Number(allocationInputs[row.sale.id]) || 0),
    0,
  );
  const parsedAmountLive = Number(amount) || 0;
  const globalAllocationShortfall = Math.max(
    totalAllocatedLive - parsedAmountLive,
    0,
  );
  const isGlobalRoundedUp =
    appliedGlobalRoundUp > 0 && globalAllocationShortfall === 0;
  const showGlobalRoundUp =
    globalAllocationShortfall > 0 || isGlobalRoundedUp;
  // Amount typed that isn't allocated to any bill above — left alone, this
  // rolls onto the next pending bill automatically when pending is computed.
  const extraUnallocated = Math.max(
    parsedAmountLive - totalAllocatedLive,
    0,
  );

  const handleGlobalRoundUpToggle = (checked: boolean) => {
    if (checked) {
      const delta = globalAllocationShortfall;
      if (delta > 0) {
        setAmount((current) => String((Number(current) || 0) + delta));
        setAppliedGlobalRoundUp(delta);
      }
    } else {
      if (appliedGlobalRoundUp > 0) {
        setAmount((current) => {
          const next = (Number(current) || 0) - appliedGlobalRoundUp;
          return next > 0 ? String(next) : "";
        });
      }
      setAppliedGlobalRoundUp(0);
    }
  };

  // Undo the effect of a previously-applied round-up: subtract what it added
  // to the overall payment amount and forget the applied delta.
  const revertRoundUp = (saleId: string) => {
    const appliedDelta = roundOffAppliedByBillId[saleId] ?? 0;
    if (appliedDelta > 0) {
      setAmount((current) => {
        const next = (Number(current) || 0) - appliedDelta;
        return next > 0 ? String(next) : "";
      });
    }
    setRoundOffAppliedByBillId((current) => ({ ...current, [saleId]: 0 }));
  };

  // Fills the bill's allocation with its full pending amount and bumps the
  // overall payment amount by the shortfall, so a short payment (e.g. a
  // customer sending 5,10,000 against a 5,10,108 bill) can be marked as
  // fully cleared with the difference absorbed as a round-off.
  const handleRoundUpToggle = (
    row: { sale: Sale; remaining: number },
    checked: boolean,
  ) => {
    setRoundUpChecked((current) => ({ ...current, [row.sale.id]: checked }));
    if (checked) {
      const currentInput = Number(allocationInputs[row.sale.id]) || 0;
      const delta = Math.max(row.remaining - currentInput, 0);
      setAllocationInputs((current) => ({
        ...current,
        [row.sale.id]: String(row.remaining),
      }));
      if (delta > 0) {
        setAmount((current) => String((Number(current) || 0) + delta));
        setRoundOffAppliedByBillId((current) => ({
          ...current,
          [row.sale.id]: delta,
        }));
      }
    } else {
      revertRoundUp(row.sale.id);
    }
  };

  // Quick-fill: tick the box to allocate a bill's full pending amount
  // instead of typing it in by hand.
  const handleFullAllocationToggle = (
    row: { sale: Sale; remaining: number },
    checked: boolean,
  ) => {
    setFullAllocationChecked((current) => ({
      ...current,
      [row.sale.id]: checked,
    }));
    if (checked) {
      // Cap the fill to what's actually left of the typed payment amount
      // (after what's already allocated to other bills) — don't silently
      // fill more than that; let the shortfall warning + round-up handle it.
      // (If the payment amount isn't typed yet, this caps to 0 for now; the
      // effect below re-fills it once an amount is entered.)
      const parsedAmountNow = Number(amount) || 0;
      const otherAllocated = saleAllocationRows
        .filter((otherRow) => otherRow.sale.id !== row.sale.id)
        .reduce(
          (sum, otherRow) =>
            sum + (Number(allocationInputs[otherRow.sale.id]) || 0),
          0,
        );
      const available = Math.max(parsedAmountNow - otherAllocated, 0);
      const fillAmount = Math.min(row.remaining, available);
      setAllocationInputs((current) => ({
        ...current,
        [row.sale.id]: fillAmount > 0 ? String(fillAmount) : "",
      }));
      if (roundUpChecked[row.sale.id]) {
        setRoundUpChecked((current) => ({ ...current, [row.sale.id]: false }));
        revertRoundUp(row.sale.id);
      }
    } else {
      setAllocationInputs((current) => ({ ...current, [row.sale.id]: "" }));
      if (roundUpChecked[row.sale.id]) {
        setRoundUpChecked((current) => ({ ...current, [row.sale.id]: false }));
        revertRoundUp(row.sale.id);
      }
    }
  };

  const createPayment = () => {
    const parsedAmount = Number(amount);
    if (!date) {
      toast.error("Payment date is required");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }
    const allocationsPayload = saleAllocationRows
      .map((row) => {
        const raw = allocationInputs[row.sale.id];
        if (!raw) return null;
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) return null;
        return { sale_id: row.sale.id, amount: value, max: row.remaining };
      })
      .filter(
        (item): item is { sale_id: string; amount: number; max: number } =>
          !!item,
      );
    const totalAllocated = allocationsPayload.reduce(
      (sum, item) => sum + item.amount,
      0,
    );
    if (totalAllocated > parsedAmount) {
      toast.error("Allocated total cannot exceed payment amount");
      return;
    }
    const invalidAllocation = allocationsPayload.find(
      (item) => item.amount > item.max,
    );
    if (invalidAllocation) {
      toast.error("Allocation exceeds remaining pending for one or more bills");
      return;
    }

    const creditHoldAmount = holdExtraAsCredit
      ? Math.max(parsedAmount - totalAllocated, 0)
      : 0;

    startTransition(async () => {
      try {
        const created = await createSoyaPartyPaymentAction({
          company_id: companyId,
          paid_on: date,
          amount: parsedAmount,
          note,
          credit_hold_amount: creditHoldAmount,
          allocations: allocationsPayload.map((item) => ({
            sale_id: item.sale_id,
            amount: item.amount,
          })),
        });
        onCreate(created.payment, created.allocations);
        setAmount("");
        setNote("");
        setAllocationInputs({});
        setFullAllocationChecked({});
        setRoundUpChecked({});
        setRoundOffAppliedByBillId({});
        setAppliedGlobalRoundUp(0);
        setHoldExtraAsCredit(false);
        setPaymentDialogOpen(false);
        toast.success("Payment added");
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to add payment",
        );
      }
    });
  };

  const removePayment = (id: string) => {
    startTransition(async () => {
      try {
        await deleteSoyaPartyPaymentAction(id);
        onDelete(id);
        if (deleteTarget?.id === id) {
          setDeleteTarget(null);
        }
        toast.success("Payment deleted");
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to delete payment",
        );
      }
    });
  };

  return (
    <section className="space-y-3 rounded-md border border-[#252932] bg-[#111214] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Payment Ledger</h3>
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-400">
            Entries: {payments.length}
          </div>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => setPaymentDialogOpen(true)}
            className="cursor-pointer border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
          >
            Add Payment
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
          <div className="text-zinc-500">Total Amount</div>
          <div className="font-semibold text-zinc-100">
            {formatCurrencyINR(totalAmount, { maximumFractionDigits: 0 })}
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
        {creditBalance > 0 ? (
          <div className="rounded-md border border-emerald-800/60 bg-emerald-950/30 p-2 text-sm">
            <div className="text-emerald-500">Credit Balance</div>
            <div className="font-semibold text-emerald-300">
              {formatCurrencyINR(creditBalance, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-emerald-500/70">
              Not applied to any bill — internal only, not shown on the
              customer statement.
            </div>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-md border border-[#252932]">
        <table className="w-full min-w-225 border-collapse text-sm text-zinc-200">
          <thead className="bg-[#15171c]">
            <tr>
              <th className="border-b border-[#252932] px-3 py-2 text-left">
                Date
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">
                Bill No
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">
                Issuer
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">
                Amount
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">
                Note
              </th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-zinc-500" colSpan={6}>
                  No payments added yet.
                </td>
              </tr>
            ) : (
              paginatedPayments.map((payment) => {
                const { billNumbers, issuerNames } = getPaymentBillInfo(
                  payment.id,
                );
                return (
                  <tr
                    key={payment.id}
                    className="border-b border-[#252932] last:border-b-0"
                  >
                    <td className="px-3 py-2">
                      {formatDisplayDate(payment.paid_on)}
                    </td>
                    <td className="px-3 py-2">{billNumbers}</td>
                    <td className="px-3 py-2">{issuerNames}</td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrencyINR(payment.amount)}
                    </td>
                    <td className="px-3 py-2">{payment.note || "-"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
                        onClick={() => setDeleteTarget(payment)}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() =>
            setPage((current) => Math.max(Math.min(current, totalPages) - 1, 1))
          }
          className="cursor-pointer border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
        >
          Previous
        </Button>
        <span className="text-xs text-zinc-500">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() =>
            setPage((current) =>
              Math.min(Math.min(current, totalPages) + 1, totalPages),
            )
          }
          className="cursor-pointer border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
        >
          Next
        </Button>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <div className="grid max-h-[calc(90vh-11rem)] grid-cols-1 gap-3 overflow-y-auto pr-1">
            <Input
              type="date"
              className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Input
              type="number"
              step="0.01"
              placeholder="Amount"
              className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <Input
              placeholder="Note (optional)"
              className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <div className="rounded-md border border-[#252932] bg-[#14161b] p-3">
              <div className="mb-2 text-sm font-medium text-zinc-200">
                Allocate To Bills (Optional)
              </div>
              <div className="max-h-[38vh] space-y-2 overflow-y-auto pr-1 sm:max-h-72">
                {saleAllocationRows.length === 0 ? (
                  <div className="text-xs text-zinc-500">
                    No sales available for allocation.
                  </div>
                ) : (
                  saleAllocationRows.map((row) => {
                    const enteredValue =
                      Number(allocationInputs[row.sale.id]) || 0;
                    const isRoundUp = !!roundUpChecked[row.sale.id];
                    const hasShortfall =
                      enteredValue > 0 && enteredValue < row.remaining;
                    const shortfall = Math.max(
                      row.remaining - enteredValue,
                      0,
                    );
                    return (
                      <div
                        key={row.sale.id}
                        className="grid grid-cols-12 items-start gap-2 text-xs"
                      >
                        <div className="col-span-4 pt-2 text-zinc-300">
                          Bill {row.sale.bill_number} • Pending{" "}
                          {formatCurrencyINR(row.remaining)}
                        </div>
                        <div className="col-span-8">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              title="Allocate the full pending amount"
                              checked={!!fullAllocationChecked[row.sale.id]}
                              onChange={(event) =>
                                handleFullAllocationToggle(
                                  row,
                                  event.target.checked,
                                )
                              }
                              className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-[#2a2d34] bg-[#111214] accent-[#ff6a3d]"
                            />
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={row.remaining}
                              placeholder="Allocate amount"
                              className="h-9 border-[#2a2d34] bg-[#111214] text-zinc-100"
                              value={allocationInputs[row.sale.id] ?? ""}
                              onChange={(event) => {
                                setAllocationInputs((current) => ({
                                  ...current,
                                  [row.sale.id]: event.target.value,
                                }));
                                if (fullAllocationChecked[row.sale.id]) {
                                  setFullAllocationChecked((current) => ({
                                    ...current,
                                    [row.sale.id]: false,
                                  }));
                                }
                                if (roundUpChecked[row.sale.id]) {
                                  setRoundUpChecked((current) => ({
                                    ...current,
                                    [row.sale.id]: false,
                                  }));
                                  revertRoundUp(row.sale.id);
                                }
                              }}
                            />
                          </div>
                          {(hasShortfall || isRoundUp) && (
                            <div
                              className={`mt-2 flex items-start gap-2 rounded-md border px-2.5 py-2 ${
                                isRoundUp
                                  ? "border-emerald-500/25 bg-emerald-500/10"
                                  : "border-amber-500/25 bg-amber-500/10"
                              }`}
                            >
                              {isRoundUp ? (
                                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-400" />
                              ) : (
                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                              )}
                              <div className="flex-1 space-y-1.5">
                                {!isRoundUp && (
                                  <p className="text-[11px] leading-snug text-amber-300">
                                    {formatCurrencyINR(shortfall)} short of
                                    the pending amount.
                                  </p>
                                )}
                                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-300">
                                  <input
                                    type="checkbox"
                                    checked={isRoundUp}
                                    onChange={(event) =>
                                      handleRoundUpToggle(
                                        row,
                                        event.target.checked,
                                      )
                                    }
                                    className="h-3.5 w-3.5 cursor-pointer rounded accent-[#ff6a3d]"
                                  />
                                  {isRoundUp
                                    ? "Rounded up — bill will be cleared in full"
                                    : "Round up to clear this bill in full"}
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {showGlobalRoundUp && (
                <div
                  className={`mt-2 flex items-start gap-2 rounded-md border px-3 py-2.5 ${
                    isGlobalRoundedUp
                      ? "border-emerald-500/25 bg-emerald-500/10"
                      : "border-amber-500/30 bg-amber-500/10"
                  }`}
                >
                  {isGlobalRoundedUp ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  )}
                  <div className="flex-1 space-y-1.5">
                    {!isGlobalRoundedUp && (
                      <p className="text-[11px] leading-snug text-amber-300">
                        Allocated total ({formatCurrencyINR(totalAllocatedLive)}
                        ) is {formatCurrencyINR(globalAllocationShortfall)}{" "}
                        more than the payment amount (
                        {formatCurrencyINR(parsedAmountLive)}).
                      </p>
                    )}
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-300">
                      <input
                        type="checkbox"
                        checked={isGlobalRoundedUp}
                        onChange={(event) =>
                          handleGlobalRoundUpToggle(event.target.checked)
                        }
                        className="h-3.5 w-3.5 cursor-pointer rounded accent-[#ff6a3d]"
                      />
                      {isGlobalRoundedUp
                        ? `Rounded up — payment amount is now ${formatCurrencyINR(totalAllocatedLive)}`
                        : `Round up payment amount to ${formatCurrencyINR(totalAllocatedLive)}`}
                    </label>
                  </div>
                </div>
              )}
              {extraUnallocated > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-md border border-zinc-500/30 bg-zinc-500/10 px-3 py-2.5">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-zinc-400" />
                  <div className="flex-1 space-y-1.5">
                    <p className="text-[11px] leading-snug text-zinc-300">
                      {formatCurrencyINR(extraUnallocated)} of this payment
                      isn&apos;t allocated to a bill above — by default it
                      will be applied to the next pending bill automatically.
                    </p>
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-300">
                      <input
                        type="checkbox"
                        checked={holdExtraAsCredit}
                        onChange={(event) =>
                          setHoldExtraAsCredit(event.target.checked)
                        }
                        className="h-3.5 w-3.5 cursor-pointer rounded accent-[#ff6a3d]"
                      />
                      Hold {formatCurrencyINR(extraUnallocated)} as credit
                      instead — don&apos;t apply it to the next bill
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="cursor-pointer border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              onClick={() => setPaymentDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={createPayment}
              className="cursor-pointer border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              Add Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Payment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Are you sure you want to delete this payment entry?
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || !deleteTarget}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
              onClick={() => {
                if (!deleteTarget) return;
                removePayment(deleteTarget.id);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
