"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Company } from "@/features/companies/schemas";
import { Sale } from "@/features/sales/schemas";
import {
  createCompanyAction,
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
}

export function CompaniesManager({ companies, sales }: CompaniesManagerProps) {
  const [data, setData] = useState(companies);
  const [draft, setDraft] = useState<CompanyDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<"issuer" | "buyer">("issuer");
  const [activeBuyerId, setActiveBuyerId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const issuerCompanies = useMemo(
    () => data.filter((company) => company.type === "issuer" && company.is_active),
    [data]
  );
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
          <div className="inline-flex w-full rounded-md border border-[#252932] bg-[#14161b] p-1 md:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab("issuer")}
              className={`rounded-sm px-3 py-1.5 text-sm transition ${
                activeTab === "issuer"
                  ? "bg-[#23262e] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Our Company
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("buyer");
                if (!activeBuyerId && buyerCompanies[0]) {
                  setActiveBuyerId(buyerCompanies[0].id);
                }
              }}
              className={`rounded-sm px-3 py-1.5 text-sm transition ${
                activeTab === "buyer"
                  ? "bg-[#23262e] text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Sale Companies
            </button>
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

        {activeTab === "issuer" ? (
          <CompanyTable
            data={issuerCompanies}
            onEdit={startEdit}
            onDelete={(company) => setDeleteTarget(company)}
            isPending={isPending}
          />
        ) : (
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
                <SalesDetailsTable sales={activeBuyerSales} />
              </>
            ) : (
              <div className="rounded-md border border-[#252932] bg-[#15171c] p-4 text-sm text-zinc-400">
                No sale companies found.
              </div>
            )}
          </div>
        )}
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
      <table className="w-full min-w-[1240px] border-collapse text-sm text-zinc-200">
        <thead className="bg-[#15171c]">
          <tr>
            <th className="border-b border-[#252932] px-3 py-2 text-left">Name</th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">Display Name</th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">Code</th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">GSTIN</th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">Email</th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">Address</th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">Prefix</th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">Phone</th>
            <th className="border-b border-[#252932] px-3 py-2 text-left">Status</th>
            <th className="sticky right-0 z-10 border-b border-l border-[#252932] bg-[#15171c] px-3 py-2 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td className="px-3 py-3 text-zinc-500" colSpan={10}>
                No companies found.
              </td>
            </tr>
          ) : (
            data.map((company) => (
              <tr key={company.id} className="border-b border-[#252932] last:border-b-0">
                <td className="px-3 py-2">{company.name}</td>
                <td className="px-3 py-2">{company.display_name || "-"}</td>
                <td className="px-3 py-2">{company.code || "-"}</td>
                <td className="px-3 py-2">{company.gstin || "-"}</td>
                <td className="px-3 py-2">{company.email || "-"}</td>
                <td className="max-w-[280px] truncate px-3 py-2" title={company.address || ""}>
                  {company.address || "-"}
                </td>
                <td className="px-3 py-2">{company.invoice_prefix || "-"}</td>
                <td className="px-3 py-2">{company.phone || "-"}</td>
                <td className="px-3 py-2">{company.is_active ? "Active" : "Inactive"}</td>
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

function SalesDetailsTable({ sales }: { sales: Sale[] }) {
  const totalAmount = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalPending = sales.reduce((sum, sale) => sum + sale.pending_amount, 0);
  const totalBags = sales.reduce((sum, sale) => sum + sale.bags, 0);

  return (
    <section className="space-y-3 rounded-md border border-[#252932] bg-[#111214] p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Sale Details</h3>
        <div className="text-xs text-zinc-400">Records: {sales.length}</div>
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
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-zinc-500" colSpan={9}>
                  No sales found for this company.
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr key={sale.id} className="border-b border-[#252932] last:border-b-0">
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
                  <td className="px-3 py-2 text-right">{formatCurrencyINR(sale.amount)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrencyINR(sale.pending_amount)}</td>
                  <td className="px-3 py-2">{sale.payment_terms || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
