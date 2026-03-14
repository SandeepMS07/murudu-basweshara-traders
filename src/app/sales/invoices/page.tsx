import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { getSalesInvoices } from "@/features/sales/service/sales-invoice.service";
import { formatCurrencyINR } from "@/lib/number-format";
import { Button } from "@/components/ui/button";

export default async function SalesInvoicesPage() {
  await requireAuth();
  const invoices = await getSalesInvoices();

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Sales Invoices
        </h1>
        <p className="text-zinc-500">Generated invoices from selected sales rows.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#252932] bg-[#111214]">
        <table className="w-full min-w-[800px] border-collapse text-sm text-zinc-200">
          <thead className="bg-[#15171c]">
            <tr>
              <th className="border-b border-[#252932] px-3 py-2 text-left">Invoice No</th>
              <th className="border-b border-[#252932] px-3 py-2 text-left">Issued On</th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">Amount</th>
              <th className="border-b border-[#252932] px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                  No invoices generated yet.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="border-b border-[#252932] last:border-b-0">
                  <td className="px-3 py-2 font-semibold">{invoice.invoice_no}</td>
                  <td className="px-3 py-2">{invoice.issued_on}</td>
                  <td className="px-3 py-2 text-right">
                    {formatCurrencyINR(invoice.total_amount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link href={`/sales/invoices/${invoice.id}/print?preview=1`}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-[#2a2d34] bg-[#17191f] text-zinc-200 hover:bg-[#1d2026]"
                      >
                        View / Print
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
