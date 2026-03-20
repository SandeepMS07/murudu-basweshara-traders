"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Company } from "@/features/companies/schemas";
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

type IssuerDraft = {
  name: string;
  display_name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
  bank_name: string;
  bank_account_no: string;
  bank_branch_ifsc: string;
  invoice_prefix: string;
  is_active: boolean;
  is_default: boolean;
};

const emptyDraft: IssuerDraft = {
  name: "",
  display_name: "",
  code: "",
  address: "",
  phone: "",
  email: "",
  gstin: "",
  bank_name: "",
  bank_account_no: "",
  bank_branch_ifsc: "",
  invoice_prefix: "",
  is_active: true,
  is_default: false,
};

interface OurCompaniesManagerProps {
  companies: Company[];
}

export function OurCompaniesManager({ companies }: OurCompaniesManagerProps) {
  const [data, setData] = useState(companies);
  const [draft, setDraft] = useState<IssuerDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Company | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeCompanies = useMemo(
    () => data.filter((company) => company.type === "issuer" && company.is_active),
    [data]
  );

  const submitDraft = () => {
    startTransition(async () => {
      try {
        if (editingId) {
          const updated = await updateCompanyAction(editingId, { ...draft, type: "issuer" });
          setData((current) => current.map((item) => (item.id === updated.id ? updated : item)));
          toast.success("Company updated");
        } else {
          const created = await createCompanyAction({ ...draft, type: "issuer" });
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
      name: company.name,
      display_name: company.display_name,
      code: company.code,
      address: company.address,
      phone: company.phone,
      email: company.email,
      gstin: company.gstin,
      bank_name: company.bank_name,
      bank_account_no: company.bank_account_no,
      bank_branch_ifsc: company.bank_branch_ifsc,
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
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-md border border-[#252932] bg-[#14161b] px-3 py-1.5 text-sm text-zinc-300">
            Our Companies
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

        <div className="mt-3 overflow-x-auto rounded-md border border-[#252932]">
          <table className="w-full min-w-[1520px] border-collapse text-sm text-zinc-200">
            <thead className="bg-[#15171c]">
              <tr>
                <th className="whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">Name</th>
                <th className="whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">Code</th>
                <th className="whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">GSTIN</th>
                <th className="whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">Bank Name</th>
                <th className="whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">A/c No</th>
                <th className="whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">Branch & IFSC</th>
                <th className="w-[280px] whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">Email</th>
                <th className="w-[420px] whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">Address</th>
                <th className="whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">Prefix</th>
                <th className="whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">Phone</th>
                <th className="whitespace-nowrap border-b border-[#252932] px-3 py-2 text-center">Status</th>
                <th className="sticky right-0 z-10 whitespace-nowrap border-b border-l border-[#252932] bg-[#15171c] px-3 py-2 text-center">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {activeCompanies.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-zinc-500" colSpan={12}>
                    No active issuer companies found.
                  </td>
                </tr>
              ) : (
                activeCompanies.map((company) => (
                  <tr key={company.id} className="border-b border-[#252932] last:border-b-0">
                    <td className="px-3 py-2 text-center align-middle">{company.name}</td>
                    <td className="px-3 py-2 text-center align-middle">{company.code || "-"}</td>
                    <td className="px-3 py-2 text-center align-middle">{company.gstin || "-"}</td>
                    <td className="px-3 py-2 text-center align-middle">{company.bank_name || "-"}</td>
                    <td className="px-3 py-2 text-center align-middle">{company.bank_account_no || "-"}</td>
                    <td className="max-w-[240px] break-words px-3 py-2 text-center align-middle">{company.bank_branch_ifsc || "-"}</td>
                    <td className="max-w-[280px] break-words px-3 py-2 text-center align-middle" title={company.email || ""}>
                      {company.email || "-"}
                    </td>
                    <td className="max-w-[420px] whitespace-normal break-words px-3 py-2 text-center align-middle">
                      {company.address || "-"}
                    </td>
                    <td className="px-3 py-2 text-center align-middle">{company.invoice_prefix || "-"}</td>
                    <td className="px-3 py-2 text-center align-middle">{company.phone || "-"}</td>
                    <td className="px-3 py-2 text-center align-middle">{company.is_active ? "Active" : "Inactive"}</td>
                    <td className="sticky right-0 z-10 border-l border-[#252932] bg-[#111214] px-3 py-2 text-center align-middle">
                      <div className="flex justify-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e] hover:text-zinc-100"
                          onClick={() => startEdit(company)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          disabled={isPending}
                          className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
                          onClick={() => setDeleteTarget(company)}
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

      </section>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Company" : "Add Company"}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
            <label className="space-y-1 text-sm text-zinc-400">
              Bank Name
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.bank_name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, bank_name: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Bank Account No
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.bank_account_no}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, bank_account_no: event.target.value }))
                }
              />
            </label>
            <label className="space-y-1 text-sm text-zinc-400">
              Branch & IFSC
              <Input
                className="h-10 border-[#2a2d34] bg-[#14161b] text-zinc-100"
                value={draft.bank_branch_ifsc}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, bank_branch_ifsc: event.target.value }))
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
