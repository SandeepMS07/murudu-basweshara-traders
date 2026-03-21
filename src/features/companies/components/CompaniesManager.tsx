"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addDays, format, isValid, parseISO } from "date-fns";

import {
  Company,
  CompanyPayment,
  CompanyPaymentAllocation,
} from "@/features/companies/schemas";
import { Sale } from "@/features/sales/schemas";
import {
  createCompanyPaymentAction,
  createCompanyAction,
  deleteCompanyPaymentAction,
  deleteCompanyAction,
  updateCompanyAction,
} from "@/app/companies/actions";
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

interface CompaniesManagerProps {
  companies: Company[];
  sales: Sale[];
  payments: CompanyPayment[];
  allocations: CompanyPaymentAllocation[];
}

export function CompaniesManager({
  companies,
  sales,
  payments,
  allocations,
}: CompaniesManagerProps) {
  const [data, setData] = useState(companies);
  const [paymentData, setPaymentData] = useState(payments);
  const [allocationData, setAllocationData] = useState(allocations);
  const [draft, setDraft] = useState<CompanyDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [activeBuyerId, setActiveBuyerId] = useState<string | null>(null);
  const [detailsTab, setDetailsTab] = useState<"sales" | "ledger">("sales");
  const [isPending, startTransition] = useTransition();

  const buyerCompanies = useMemo(
    () => data.filter((company) => company.type === "buyer" && company.is_active),
    [data]
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
    if (activeBuyerId && buyerCompanies.some((company) => company.id === activeBuyerId)) {
      return buyerCompanies.find((company) => company.id === activeBuyerId) ?? null;
    }
    return buyerCompanies[0];
  }, [activeBuyerId, buyerCompanies]);

  const activeBuyerSales = useMemo(() => {
    if (!activeBuyer) return [];
    return salesByCompany.get(activeBuyer.id) ?? [];
  }, [activeBuyer, salesByCompany]);
  const activeBuyerPayments = useMemo(() => {
    if (!activeBuyer) return [];
    return paymentData.filter((payment) => payment.company_id === activeBuyer.id);
  }, [activeBuyer, paymentData]);
  const activeBuyerSaleIdSet = useMemo(
    () => new Set(activeBuyerSales.map((sale) => sale.id)),
    [activeBuyerSales]
  );
  const activeBuyerAllocations = useMemo(
    () => allocationData.filter((allocation) => activeBuyerSaleIdSet.has(allocation.sale_id)),
    [activeBuyerSaleIdSet, allocationData]
  );
  const activeBuyerPending = useMemo(
    () =>
      computeEffectiveSalePending(
        activeBuyerSales,
        activeBuyerPayments,
        activeBuyerAllocations
      ),
    [activeBuyerAllocations, activeBuyerPayments, activeBuyerSales]
  );

  const submitDraft = () => {
    startTransition(async () => {
      try {
        if (editingId) {
          const updated = await updateCompanyAction(editingId, draft);
          setData((current) =>
            current.map((item) => (item.id === updated.id ? updated : item))
          );
          toast.success("Company updated");
        } else {
          const created = await createCompanyAction(draft);
          setData((current) => [...current, created]);
          toast.success("Company created");
        }
        setDraft(emptyDraft);
        setEditingId(null);
        setFormOpen(false);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to save company");
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
        const result = await deleteCompanyAction(id);
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
              item.id === id ? { ...item, is_active: false, is_default: false } : item
            )
          );
          toast.info(result.message);
        }
        if (deleteTarget?.id === id) {
          setDeleteTarget(null);
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete company");
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
        </div>

        <div className="mt-3 space-y-3">
          <div className="overflow-x-auto">
            <div className="inline-flex min-w-full gap-2">
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

              {detailsTab === "sales" ? (
                <SalesDetailsTable
                  sales={activeBuyerSales}
                  pendingBySaleId={activeBuyerPending.pendingBySaleId}
                />
              ) : (
                <CompanyPaymentsLedger
                  companyId={activeBuyer.id}
                  sales={activeBuyerSales}
                  payments={activeBuyerPayments}
                  pendingBySaleId={activeBuyerPending.pendingBySaleId}
                  totalAmount={activeBuyerSales.reduce(
                    (sum, sale) => sum + sale.amount + sale.flight,
                    0
                  )}
                  onCreate={(payment, createdAllocations) => {
                    setPaymentData((current) => [payment, ...current]);
                    if (createdAllocations.length > 0) {
                      setAllocationData((current) => [...createdAllocations, ...current]);
                    }
                  }}
                  onDelete={(paymentId) =>
                    {
                      setPaymentData((current) =>
                        current.filter((payment) => payment.id !== paymentId)
                      );
                      setAllocationData((current) =>
                        current.filter((allocation) => allocation.payment_id !== paymentId)
                      );
                    }
                  }
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
            <DialogTitle>{editingId ? "Edit Company" : "Add Company"}</DialogTitle>
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
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Display Name
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.display_name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, display_name: event.target.value }))
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
                placeholder={draft.type === "issuer" ? "Required for issuer" : "Optional"}
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Code
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.code}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, code: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Phone
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.phone}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, phone: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Email
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.email}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              GSTIN
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.gstin}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, gstin: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400 md:col-span-2 xl:col-span-3">
              Address
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.address}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, address: event.target.value }))
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Company?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-zinc-200">
              {deleteTarget?.display_name || deleteTarget?.name}
            </span>
            ? If this company has linked sales or invoices, we will deactivate it instead of
            deleting data.
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
            <th className="border-b border-[#252932] px-3 py-2 text-left">Name</th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">Code</th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">GSTIN</th>
            <th className="w-[260px] border-b border-[#252932] px-3 py-2 text-left">Email</th>
            <th className="w-[360px] border-b border-[#252932] px-3 py-2 text-left">Address</th>
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
              <tr key={company.id} className="border-b border-[#252932] last:border-b-0">
                <td className="px-3 py-2">{company.name}</td>
                <td className="px-3 py-2">{company.code || "-"}</td>
                <td className="px-3 py-2">{company.gstin || "-"}</td>
                <td className="max-w-[260px] break-words px-3 py-2 align-top" title={company.email || ""}>
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
  sales,
  pendingBySaleId,
}: {
  sales: Sale[];
  pendingBySaleId: Record<string, number>;
}) {
  const PAGE_SIZE = 8;
  const totalAmount = sales.reduce((sum, sale) => sum + sale.amount + sale.flight, 0);
  const totalPending = sales.reduce((sum, sale) => sum + (pendingBySaleId[sale.id] ?? sale.pending_amount), 0);
  const totalBags = sales.reduce((sum, sale) => sum + sale.bags, 0);
  const [page, setPage] = useState(1);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
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

  const getRowDueStatus = (sale: Sale) => {
    const dueDate = getDueDate(sale);
    if (!dueDate) return "unknown" as const;
    const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
    const effectivePending = pendingBySaleId[sale.id] ?? sale.pending_amount;
    if (effectivePending <= 0) return "cleared" as const;
    if (dueStart.getTime() < todayStart.getTime()) return "overdue" as const;
    if (dueStart.getTime() === todayStart.getTime()) return "due_today" as const;
    return "upcoming" as const;
  };

  const getRowClassName = (sale: Sale) => {
    const status = getRowDueStatus(sale);
    if (status === "overdue") return "bg-[#2a1111]/40 hover:bg-[#361616]/50";
    if (status === "due_today") return "bg-[#2a2412]/40 hover:bg-[#352d16]/50";
    if (status === "cleared") return "bg-[#102015]/30 hover:bg-[#16301f]/45";
    return "";
  };

  const formatDueDate = (sale: Sale) => {
    const dueDate = getDueDate(sale);
    if (!dueDate) return "-";
    return format(dueDate, "yyyy-MM-dd");
  };

  return (
    <section className="space-y-3 rounded-md border border-[#252932] bg-[#111214] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Sale Details</h3>
        <div className="text-xs text-zinc-400">Records: {sales.length}</div>
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

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
          <div className="text-zinc-500">Total Amount</div>
          <div className="font-semibold text-zinc-100">{formatCurrencyINR(totalAmount)}</div>
        </div>
        <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
          <div className="text-zinc-500">Total Pending</div>
          <div className="font-semibold text-zinc-100">{formatCurrencyINR(totalPending)}</div>
        </div>
        <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
          <div className="text-zinc-500">Total Bags</div>
          <div className="font-semibold text-zinc-100">{formatNumberIN(totalBags, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#252932]">
        <table className="w-full min-w-[980px] border-collapse text-sm text-zinc-200">
          <thead className="bg-[#15171c]">
            <tr>
              <th className="border-b border-[#252932] px-3 py-2 text-left">Bill No</th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">Date</th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">Lorry</th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">Bags</th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">Net Wt</th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">Rate</th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">Amount</th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">Pending</th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">Terms</th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">Due Date</th>
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-zinc-500" colSpan={10}>
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
                  <td className="px-3 py-2">{sale.sale_date}</td>
                  <td className="px-3 py-2">{sale.lorry_number || "-"}</td>
                  <td className="px-3 py-2 text-right">
                    {formatNumberIN(sale.bags, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatNumberIN(sale.net_weight, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-3 py-2 text-right">{formatCurrencyINR(sale.rate)}</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrencyINR(sale.amount + sale.flight)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrencyINR(pendingBySaleId[sale.id] ?? sale.pending_amount)}
                  </td>
                  <td className="px-3 py-2">{sale.payment_terms || "-"}</td>
                  <td className="px-3 py-2">{formatDueDate(sale)}</td>
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
          onClick={() => setPage((current) => Math.max(Math.min(current, totalPages) - 1, 1))}
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
          onClick={() => setPage((current) => Math.min(Math.min(current, totalPages) + 1, totalPages))}
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
  pendingBySaleId,
  totalAmount,
  onCreate,
  onDelete,
}: {
  companyId: string;
  sales: Sale[];
  payments: CompanyPayment[];
  pendingBySaleId: Record<string, number>;
  totalAmount: number;
  onCreate: (payment: CompanyPayment, allocations: CompanyPaymentAllocation[]) => void;
  onDelete: (id: string) => void;
}) {
  const PAGE_SIZE = 8;
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [allocationInputs, setAllocationInputs] = useState<Record<string, string>>({});
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
    [payments]
  );
  const saleAllocationRows = useMemo(
    () =>
      sales.map((sale) => {
        const remaining = Math.max(pendingBySaleId[sale.id] ?? sale.pending_amount, 0);
        return { sale, remaining };
      }),
    [pendingBySaleId, sales]
  );
  const remaining = Math.max(totalAmount - totalReceived, 0);

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
      .filter((item): item is { sale_id: string; amount: number; max: number } => !!item);
    const totalAllocated = allocationsPayload.reduce((sum, item) => sum + item.amount, 0);
    if (totalAllocated > parsedAmount) {
      toast.error("Allocated total cannot exceed payment amount");
      return;
    }
    const invalidAllocation = allocationsPayload.find((item) => item.amount > item.max);
    if (invalidAllocation) {
      toast.error("Allocation exceeds remaining pending for one or more bills");
      return;
    }

    startTransition(async () => {
      try {
        const created = await createCompanyPaymentAction({
          company_id: companyId,
          paid_on: date,
          amount: parsedAmount,
          note,
          allocations: allocationsPayload.map((item) => ({
            sale_id: item.sale_id,
            amount: item.amount,
          })),
        });
        onCreate(created.payment, created.allocations);
        setAmount("");
        setNote("");
        setAllocationInputs({});
        setPaymentDialogOpen(false);
        toast.success("Payment added");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to add payment");
      }
    });
  };

  const removePayment = (id: string) => {
    startTransition(async () => {
      try {
        await deleteCompanyPaymentAction(id);
        onDelete(id);
        if (deleteTarget?.id === id) {
          setDeleteTarget(null);
        }
        toast.success("Payment deleted");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete payment");
      }
    });
  };

  return (
    <section className="space-y-3 rounded-md border border-[#252932] bg-[#111214] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Payment Ledger</h3>
        <div className="flex items-center gap-3">
          <div className="text-xs text-zinc-400">Entries: {payments.length}</div>
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
          <div className="font-semibold text-zinc-100">{formatCurrencyINR(totalAmount)}</div>
        </div>
        <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
          <div className="text-zinc-500">Received</div>
          <div className="font-semibold text-zinc-100">{formatCurrencyINR(totalReceived)}</div>
        </div>
        <div className="rounded-md border border-[#252932] bg-[#15171c] p-2 text-sm">
          <div className="text-zinc-500">Remaining</div>
          <div className="font-semibold text-zinc-100">{formatCurrencyINR(remaining)}</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#252932]">
        <table className="w-full min-w-[720px] border-collapse text-sm text-zinc-200">
          <thead className="bg-[#15171c]">
            <tr>
              <th className="border-b border-[#252932] px-3 py-2 text-left">Date</th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">Amount</th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">Note</th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-zinc-500" colSpan={4}>
                  No payments added yet.
                </td>
              </tr>
            ) : (
              paginatedPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-[#252932] last:border-b-0">
                  <td className="px-3 py-2">{payment.paid_on}</td>
                  <td className="px-3 py-2 text-right">{formatCurrencyINR(payment.amount)}</td>
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
          onClick={() => setPage((current) => Math.max(Math.min(current, totalPages) - 1, 1))}
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
          onClick={() => setPage((current) => Math.min(Math.min(current, totalPages) + 1, totalPages))}
          className="cursor-pointer border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
        >
          Next
        </Button>
      </div>

      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Payment</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3">
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
              <div className="mb-2 text-sm font-medium text-zinc-200">Allocate To Bills (Optional)</div>
              <div className="space-y-2">
                {saleAllocationRows.length === 0 ? (
                  <div className="text-xs text-zinc-500">No sales available for allocation.</div>
                ) : (
                  saleAllocationRows.map((row) => (
                    <div key={row.sale.id} className="grid grid-cols-12 items-center gap-2 text-xs">
                      <div className="col-span-4 text-zinc-300">
                        Bill {row.sale.bill_number} • Pending {formatCurrencyINR(row.remaining)}
                      </div>
                      <div className="col-span-8">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={row.remaining}
                          placeholder="Allocate amount"
                          className="h-9 border-[#2a2d34] bg-[#111214] text-zinc-100"
                          value={allocationInputs[row.sale.id] ?? ""}
                          onChange={(event) =>
                            setAllocationInputs((current) => ({
                              ...current,
                              [row.sale.id]: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
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
