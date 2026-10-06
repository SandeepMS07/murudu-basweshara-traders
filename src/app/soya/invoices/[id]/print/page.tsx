export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import QRCode from "qrcode";

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

  // CGST Rule 48(4): an e-invoice must print the QR code the IRP signed. It is
  // rendered from the portal's own SignedQRCode, untouched — scanning it is how
  // a buyer or officer verifies the IRN against the government's records.
  const qrSvg = invoice.signed_qr
    ? await QRCode.toString(invoice.signed_qr, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 0,
      })
    : "";

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <SoyaInvoicePrintView
        invoice={invoice}
        seller={seller}
        autoPrint={auto === "1"}
        qrSvg={qrSvg}
      />
    </div>
  );
}
