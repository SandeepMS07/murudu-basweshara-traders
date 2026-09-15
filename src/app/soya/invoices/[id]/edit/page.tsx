export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getSoyaCompanyById } from "@/features/soya-companies/service/soya-company.service";
import { getSoyaInvoiceById } from "@/features/soya-invoices/service/soya-invoice.service";
import { getSoyaItems } from "@/features/soya-invoices/service/soya-item.service";
import { getSoyaPartiesForInvoicing } from "@/features/soya/service/counterparty-gst.service";
import { SoyaInvoiceForm } from "@/features/soya-invoices/components/SoyaInvoiceForm";
import { SoyaSetupNotice } from "@/features/soya-invoices/components/SoyaSetupNotice";
import { isInvoiceLocked } from "@/features/soya-invoices/schemas";

export default async function EditSoyaInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSoyaAdminPage();
  const { id } = await params;

  let invoice;
  let company;
  let items;
  let parties;
  try {
    invoice = await getSoyaInvoiceById(id);
    if (!invoice) notFound();

    // A filed invoice is a government record. Bounce rather than render a form
    // whose save would be refused by the service anyway.
    if (isInvoiceLocked(invoice)) redirect(`/soya/invoices/${id}`);

    company = await getSoyaCompanyById(invoice.company_id);
    if (!company) notFound();

    [items, parties] = await Promise.all([
      getSoyaItems(company.id),
      getSoyaPartiesForInvoicing(company.id),
    ]);
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (message.includes("NEXT_REDIRECT") || message.includes("NEXT_NOT_FOUND")) throw error;
    return (
      <AppShell>
        <SoyaSetupNotice error={error} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4">
        <Link
          href={`/soya/invoices/${invoice.id}`}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          ← {invoice.invoice_no}
        </Link>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-100">Edit invoice</h1>
        <p className="text-zinc-500">{company.name}</p>
      </div>

      <SoyaInvoiceForm
        company={company}
        today={new Date().toISOString().slice(0, 10)}
        items={items}
        parties={parties.map((party) => ({
          id: party.id,
          name: party.name,
          gstin: party.gstin,
          state_code: party.state_code,
          address: party.address,
          place: party.place,
          pincode: party.pincode,
          phone: party.phone,
          registration_type: party.registration_type,
        }))}
        invoice={invoice}
      />
    </AppShell>
  );
}
