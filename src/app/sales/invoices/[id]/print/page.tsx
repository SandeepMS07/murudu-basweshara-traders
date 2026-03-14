import { format, parseISO } from "date-fns";
import { notFound } from "next/navigation";

import { requireAuth } from "@/features/auth/lib/session";
import { BillPrintAuto } from "@/features/bills/components/BillPrintAuto";
import { getSalesInvoiceById } from "@/features/sales/service/sales-invoice.service";
import { formatNumberIN } from "@/lib/number-format";

type SnapshotShape = {
  issuer_company?: {
    name?: string;
    display_name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  buyer_company?: {
    name?: string;
    display_name?: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  items?: Array<{
    sale_id?: string;
    description?: string;
    bags?: number;
    net_weight?: number;
    rate?: number;
    amount?: number;
  }>;
  totals?: {
    subtotal?: number;
    total_amount?: number;
  };
};

function numberToWordsIN(value: number): string {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigits = (n: number) => {
    if (n < 20) return ones[n];
    const t = Math.trunc(n / 10);
    const o = n % 10;
    return `${tens[t]}${o ? ` ${ones[o]}` : ""}`;
  };

  const threeDigits = (n: number) => {
    const h = Math.trunc(n / 100);
    const r = n % 100;
    if (!h) return twoDigits(r);
    return `${ones[h]} Hundred${r ? ` ${twoDigits(r)}` : ""}`;
  };

  const n = Math.max(0, Math.trunc(value));
  if (n === 0) return "Zero";

  const crore = Math.trunc(n / 10000000);
  const lakh = Math.trunc((n % 10000000) / 100000);
  const thousand = Math.trunc((n % 100000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export default async function SalesInvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  await requireAuth();

  const { id } = await params;
  const { preview } = (await searchParams) || {};
  const previewMode = preview === "1";

  const invoice = await getSalesInvoiceById(id);
  if (!invoice) {
    notFound();
  }

  const snapshot = (invoice.snapshot_json ?? {}) as SnapshotShape;
  const issuer = snapshot.issuer_company ?? {};
  const buyer = snapshot.buyer_company ?? {};
  const items =
    snapshot.items && snapshot.items.length > 0
      ? snapshot.items
      : (invoice.items ?? []).map((item) => ({
          sale_id: item.sale_id,
          description: item.description,
          bags: item.bags,
          net_weight: item.net_weight,
          rate: item.rate,
          amount: item.amount,
        }));
  const total =
    snapshot.totals?.total_amount ??
    invoice.total_amount ??
    items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  let printDate = invoice.issued_on;
  let printDateCompact = invoice.issued_on;
  try {
    printDate = format(parseISO(invoice.issued_on), "MMMM d, yyyy");
    printDateCompact = format(parseISO(invoice.issued_on), "d-MMM-yy");
  } catch {
    printDate = invoice.issued_on;
    printDateCompact = invoice.issued_on;
  }

  const copies = [1];
  const rootClassName = `bill-print-root bill-print-preview sales-invoice-print-root${
    previewMode ? " bill-print-inline-preview" : ""
  }`;
  const totalInWords = numberToWordsIN(total);
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.net_weight ?? 0), 0);

  return (
    <main className={rootClassName}>
      {!previewMode ? <BillPrintAuto redirectTo="/sales" /> : null}
      {copies.map((copy) => (
        <section className="bill-print-copy bill-sales-invoice-copy" key={copy}>
          <div className="sales-invoice-title">INVOICE</div>

          <section className="sales-invoice-top">
            <div className="sales-invoice-seller">
              <div className="sales-invoice-company-name">
                {(issuer.display_name || issuer.name || "Issuer Company").toUpperCase()}
              </div>
              <div>{issuer.address || "-"}</div>
              <div>Email: {issuer.email || "-"}</div>
              <div>Phone: {issuer.phone || "-"}</div>

              <div className="sales-invoice-subhead">Consignee (Ship to)</div>
              <div className="sales-invoice-party-name">
                {(buyer.display_name || buyer.name || "-").toUpperCase()}
              </div>
              <div>{buyer.address || "-"}</div>

              <div className="sales-invoice-subhead">Buyer (Bill to)</div>
              <div className="sales-invoice-party-name">
                {(buyer.display_name || buyer.name || "-").toUpperCase()}
              </div>
              <div>{buyer.address || "-"}</div>
            </div>

            <div className="sales-invoice-meta">
              <div className="sales-invoice-meta-row">
                <div className="sales-invoice-meta-label">Invoice No.</div>
                <div className="sales-invoice-meta-value sales-invoice-meta-strong">{invoice.invoice_no}</div>
                <div className="sales-invoice-meta-label">Dated</div>
                <div className="sales-invoice-meta-value sales-invoice-meta-strong">{printDateCompact}</div>
              </div>
              <div className="sales-invoice-meta-row">
                <div className="sales-invoice-meta-label">Delivery Note</div>
                <div className="sales-invoice-meta-value">-</div>
                <div className="sales-invoice-meta-label">Mode/Terms of Payment</div>
                <div className="sales-invoice-meta-value">-</div>
              </div>
              <div className="sales-invoice-meta-row">
                <div className="sales-invoice-meta-label">Reference No. & Date</div>
                <div className="sales-invoice-meta-value">-</div>
                <div className="sales-invoice-meta-label">Other References</div>
                <div className="sales-invoice-meta-value">-</div>
              </div>
              <div className="sales-invoice-meta-row">
                <div className="sales-invoice-meta-label">Dispatch Doc No.</div>
                <div className="sales-invoice-meta-value">-</div>
                <div className="sales-invoice-meta-label">Delivery Note Date</div>
                <div className="sales-invoice-meta-value">{printDate}</div>
              </div>
              <div className="sales-invoice-meta-row">
                <div className="sales-invoice-meta-label">Dispatched through</div>
                <div className="sales-invoice-meta-value sales-invoice-meta-strong">TRUCK</div>
                <div className="sales-invoice-meta-label">Destination</div>
                <div className="sales-invoice-meta-value sales-invoice-meta-strong">{buyer.address || "-"}</div>
              </div>
              <div className="sales-invoice-meta-row">
                <div className="sales-invoice-meta-label">Vessel/Flight No.</div>
                <div className="sales-invoice-meta-value">-</div>
                <div className="sales-invoice-meta-label">Place of receipt by shipper</div>
                <div className="sales-invoice-meta-value">-</div>
              </div>
            </div>
          </section>

          <table className="sales-invoice-items">
            <thead>
              <tr>
                <th>Sl No.</th>
                <th>No. & Kind of Pkgs.</th>
                <th>Description of Goods</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>per</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item, index) => (
                  <tr key={`${item.sale_id}-${index}`}>
                    <td>{index + 1}</td>
                    <td>
                      {formatNumberIN(item.bags, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}{" "}
                      BAGS
                    </td>
                    <td>{(item.description || `Sale ${index + 1}`).toUpperCase()}</td>
                    <td className="sales-invoice-num">
                      {formatNumberIN(item.net_weight, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      KG
                    </td>
                    <td className="sales-invoice-num">
                      {formatNumberIN(item.rate, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>KG</td>
                    <td className="sales-invoice-num">
                      {formatNumberIN(item.amount, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7}>No invoice items.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}></td>
                <td className="sales-invoice-num sales-invoice-foot-label">Total</td>
                <td className="sales-invoice-num">
                  {formatNumberIN(totalQuantity, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  KG
                </td>
                <td></td>
                <td className="sales-invoice-num">
                  {formatNumberIN(total, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            </tfoot>
          </table>

          <section className="sales-invoice-bottom">
            <div className="sales-invoice-amount-words">
              <div>Amount Chargeable (in words)</div>
              <strong>INR {totalInWords} Only</strong>
            </div>
            <div className="sales-invoice-signbox">
              <div className="sales-invoice-sign-company">
                for {(issuer.display_name || issuer.name || "Issuer Company").toUpperCase()}
              </div>
              <div className="sales-invoice-sign-label">Authorised Signatory</div>
            </div>
          </section>
          <div className="sales-invoice-footer-note">This is a Computer Generated Invoice</div>
        </section>
      ))}
    </main>
  );
}
