export const dynamic = "force-dynamic";

import Link from "next/link";
import { FileText, Plus } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getActiveSoyaCompany } from "@/features/soya/lib/active-company";
import { getSoyaInvoices } from "@/features/soya-invoices/service/soya-invoice.service";
import { SoyaSetupNotice } from "@/features/soya-invoices/components/SoyaSetupNotice";
import { irpStatus } from "@/features/soya-invoices/service/irp-client";
import { formatNumberIN } from "@/lib/number-format";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  pending: "Not filed",
  generated: "Filed",
  cancelled: "Cancelled",
  failed: "Rejected",
  not_applicable: "N/A",
};

export default async function SoyaInvoicesPage() {
  await requireSoyaAdminPage();

  let company;
  try {
    company = await getActiveSoyaCompany();
  } catch (error) {
    return (
      <AppShell>
        <SoyaSetupNotice error={error} />
      </AppShell>
    );
  }

  if (!company) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#2a2d34] bg-[#14161b] p-8 text-center">
          <h1 className="text-xl font-semibold text-zinc-100">No company yet</h1>
          <p className="mt-2 text-sm text-zinc-500">
            An invoice is raised by a trading firm. Add one first.
          </p>
          <Link
            href="/soya/companies"
            className="mt-4 inline-block cursor-pointer rounded-md bg-[#ff6a3d] px-4 py-2 text-sm font-medium text-white hover:bg-[#ff7f57]"
          >
            Go to Companies
          </Link>
        </div>
      </AppShell>
    );
  }

  let invoices;
  try {
    invoices = await getSoyaInvoices(company.id);
  } catch (error) {
    return (
      <AppShell>
        <SoyaSetupNotice error={error} />
      </AppShell>
    );
  }

  const portal = irpStatus();
  const filed = invoices.filter((invoice) => invoice.einvoice_status === "generated").length;

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Invoices</h1>
          <p className="text-zinc-500">
            Tax invoices raised by {company.name}
            {company.gstin ? ` (${company.gstin})` : ""}.
          </p>
        </div>
        <Link
          href="/soya/invoices/new"
          className="inline-flex cursor-pointer items-center rounded-md bg-[#ff6a3d] px-4 py-2 text-sm font-medium text-white hover:bg-[#ff7f57]"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Link>
      </div>

      {!portal.configured ? (
        <div className="mb-4 rounded-lg border border-[#2a3a44] bg-[#0f1a1f] px-4 py-3 text-sm text-sky-200/80">
          <strong className="text-sky-200">Portal not connected.</strong> Invoices
          can be created, printed and checked against every rule the portal
          applies. Filing shows a preview of the exact payload instead of sending
          it, until credentials are configured.
        </div>
      ) : null}

      {invoices.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2a2d34] bg-[#14161b] p-10 text-center">
          <FileText className="mx-auto h-10 w-10 text-zinc-600" />
          <h2 className="mt-3 text-lg font-semibold text-zinc-200">No invoices yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
            Raise one and it will be numbered in {company.name}&apos;s own series,
            starting at 0001 for this financial year.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-zinc-500">
            {invoices.length} invoice{invoices.length === 1 ? "" : "s"} · {filed} filed
          </p>
          <div className="overflow-x-auto rounded-2xl border border-[#2a2d34] bg-[#14161b]">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-[#2a2d34] text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3 font-medium">Number</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Party</th>
                  <th className="px-4 py-3 text-right font-medium">Taxable</th>
                  <th className="px-4 py-3 text-right font-medium">Tax</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">e-Invoice</th>
                  <th className="px-4 py-3 font-medium">e-Way Bill</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-[#1d2026] transition-colors last:border-0 hover:bg-[#181a1f]"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/soya/invoices/${invoice.id}`}
                        className="cursor-pointer font-medium text-[#ff8f6b] hover:underline"
                      >
                        {invoice.invoice_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{invoice.invoice_date}</td>
                    <td className="px-4 py-3 text-zinc-200">{invoice.party_name}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-300">
                      {formatNumberIN(invoice.taxable_value, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-zinc-400">
                      {formatNumberIN(invoice.cgst + invoice.sgst + invoice.igst, {
                        minimumFractionDigits: 2,
                      })}
                      <span className="ml-1 text-[10px] uppercase text-zinc-600">
                        {invoice.igst > 0 ? "igst" : "c+s"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-zinc-100">
                      {formatNumberIN(invoice.total_value)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          invoice.einvoice_status === "generated" &&
                            "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
                          invoice.einvoice_status === "failed" &&
                            "border-red-800/50 bg-red-950/40 text-red-300",
                          invoice.einvoice_status === "cancelled" &&
                            "border-[#3d3418] bg-[#2a2412]/50 text-[#f7e3b0]",
                          (invoice.einvoice_status === "pending" ||
                            invoice.einvoice_status === "not_applicable") &&
                            "border-[#2a2d34] bg-[#1b1e24] text-zinc-500",
                        )}
                      >
                        {STATUS_LABEL[invoice.einvoice_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {invoice.ewb_no || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppShell>
  );
}
