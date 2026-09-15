export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";

import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import {
  getSoyaInvoiceById,
  sellerForCompany,
} from "@/features/soya-invoices/service/soya-invoice.service";
import { SoyaInvoicePrintView } from "@/features/soya-invoices/components/SoyaInvoicePrintView";

/**
 * Deliberately outside AppShell — a printed invoice must not carry the app's
 * sidebar or dark chrome onto paper.
 */
export default async function SoyaInvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string }>;
}) {
  await requireSoyaAdminPage();
  const { id } = await params;
  const { auto } = await searchParams;

  const invoice = await getSoyaInvoiceById(id);
  if (!invoice) notFound();
  const seller = await sellerForCompany(invoice.company_id);

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <SoyaInvoicePrintView
        invoice={invoice}
        seller={seller}
        autoPrint={auto === "1"}
      />
    </div>
  );
}
