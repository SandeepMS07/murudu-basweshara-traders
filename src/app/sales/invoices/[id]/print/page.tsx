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
    gstin?: string;
    bank_name?: string;
    bank_account_no?: string;
    bank_branch_ifsc?: string;
    state_name?: string;
    state_code?: string;
  };
  buyer_company?: {
    name?: string;
    display_name?: string;
    address?: string;
    phone?: string;
    email?: string;
    gstin?: string;
    state_name?: string;
    state_code?: string;
  };
  items?: Array<{
    sale_id?: string;
    description?: string;
    bags?: number;
    net_weight?: number;
    rate?: number;
    amount?: number;
    lorry_number?: string;
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

  const lorryNumber = snapshot.items?.[0]?.lorry_number || "-";

  const copies = [1];
  const rootClassName = `bill-print-root sales-invoice-print-root${
    previewMode ? " bill-print-inline-preview" : ""
  }`;
  const totalInWords = numberToWordsIN(total);
  const totalQuantity = items.reduce((sum, item) => sum + Number(item.net_weight ?? 0), 0);
  const minimumLineItems = 12;
  const emptyLineItems = Math.max(0, minimumLineItems - items.length);
  const issuerState = issuer.state_name ? `${issuer.state_name}${issuer.state_code ? `, Code: ${issuer.state_code}` : ""}` : "Karnataka, Code: 29";
  const buyerState = buyer.state_name ? `${buyer.state_name}${buyer.state_code ? `, Code: ${buyer.state_code}` : ""}` : "Karnataka, Code: 29";

  return (
    <main className={rootClassName}>
      {!previewMode ? <BillPrintAuto redirectTo="/sales" /> : null}
      {copies.map((copy) => (
        <section className="bill-print-copy bill-sales-invoice-copy" key={copy}>
          <div className="sales-invoice-title">INVOICE</div>

          <table className="sales-invoice-head">
            <tbody>
              <tr>
                <td className="sales-invoice-head-left">
                  <div className="sales-invoice-company-name">
                    {(issuer.display_name || issuer.name || "Issuer Company").toUpperCase()}
                  </div>
                  <div>{issuer.address || "-"}</div>
                  <div>Email: {issuer.email || "-"}</div>
                  <div>Phone: {issuer.phone || "-"}</div>
                  <div>GSTIN/UIN: {issuer.gstin || "-"}</div>
                  <div>State Name: {issuerState}</div>

                  <div className="sales-invoice-subhead">Consignee (Ship to)</div>
                  <div className="sales-invoice-party-name">
                    {(buyer.display_name || buyer.name || "-").toUpperCase()}
                  </div>
                  <div>{buyer.address || "-"}</div>
                  <div>GSTIN/UIN: {buyer.gstin || "-"}</div>
                  <div>State Name: {buyerState}</div>

                  <div className="sales-invoice-subhead">Buyer (Bill to)</div>
                  <div className="sales-invoice-party-name">
                    {(buyer.display_name || buyer.name || "-").toUpperCase()}
                  </div>
                  <div>{buyer.address || "-"}</div>
                  <div>GSTIN/UIN: {buyer.gstin || "-"}</div>
                  <div>State Name: {buyerState}</div>
                </td>
                <td className="sales-invoice-head-right">
                  <table className="sales-invoice-meta-table">
                    <tbody>
                      <tr>
                        <td>
                          <div>Invoice No.</div>
                          <div className="sales-invoice-strong">{invoice.invoice_no}</div>
                        </td>
                        <td>
                          <div>Dated</div>
                          <div className="sales-invoice-strong">{printDateCompact}</div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div>Delivery Note</div>
                        </td>
                        <td>
                          <div>Mode/Terms of Payment</div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div>Reference No. & Date.</div>
                        </td>
                        <td>
                          <div>Other References</div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div>Buyer&apos;s Order No.</div>
                        </td>
                        <td>
                          <div>Dated</div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div>Dispatch Doc No.</div>
                        </td>
                        <td>
                          <div>Delivery Note Date</div>
                          <div>{printDate}</div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div>Dispatched through</div>
                          <div className="sales-invoice-strong">TRUCK</div>
                        </td>
                        <td>
                          <div>Destination</div>
                          <div className="sales-invoice-strong">{buyer.address?.split(',')?.[0] || "NAGAMANGALA"}</div>
                        </td>
                      </tr>
                      <tr>
                        <td>
                          <div>Bill of Lading/LR-RR No.</div>
                        </td>
                        <td>
                          <div>Motor Vehicle No.</div>
                          <div className="sales-invoice-strong">{lorryNumber}</div>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={2}>
                          <div>Terms of Delivery</div>
                          <br />
                          <br />
                          <br />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
            </tbody>
          </table>

          <table className="sales-invoice-items">
            <thead>
              <tr>
                <th>Sl No.</th>
                <th>No. & Kind of Pkgs.</th>
                <th>Description of Goods</th>
                <th>HSN/SAC</th>
                <th>Quantity</th>
                <th>Rate</th>
                <th>per</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                <>
                  {items.map((item, index) => (
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
                      <td className="sales-invoice-num">10051000</td>
                      <td className="sales-invoice-num">
                        {formatNumberIN(item.net_weight, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
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
                  ))}
                  {Array.from({ length: emptyLineItems }).map((_, index) => (
                    <tr key={`empty-line-${index}`} className="sales-invoice-empty-row">
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                    </tr>
                  ))}
                </>
              ) : (
                <tr>
                  <td colSpan={8}>No invoice items.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="sales-invoice-num sales-invoice-foot-label" style={{ textAlign: "right", paddingRight: "12px" }}>Total</td>
                <td className="sales-invoice-num">
                  {formatNumberIN(totalQuantity, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}{" "}
                  KG
                </td>
                <td></td>
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

          <table className="sales-invoice-summary">
            <tbody>
              <tr>
                <td className="sales-invoice-amount-words">
                  <div>Amount Chargeable (in words)</div>
                  <strong>INR {totalInWords} Only</strong>
                </td>
                <td className="sales-invoice-summary-right">E. &amp; O.E</td>
              </tr>
            </tbody>
          </table>

          <table className="sales-invoice-tax">
            <thead>
              <tr>
                <th>HSN/SAC</th>
                <th className="sales-invoice-num">Taxable Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>10051000</td>
                <td className="sales-invoice-num">
                  {formatNumberIN(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td className="sales-invoice-num sales-invoice-foot-label">Total</td>
                <td className="sales-invoice-num">
                  {formatNumberIN(total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tbody>
          </table>

          <table className="sales-invoice-footer">
            <tbody>
              <tr>
                <td className="sales-invoice-footer-left">
                  <div>Tax Amount (in words) : NIL</div>
                  <div className="sales-invoice-declaration">
                    <div>Declaration</div>
                    <div>
                      We declare that this invoice shows the actual price of the goods described and that all
                      particulars are true and correct.
                    </div>
                  </div>
                </td>
                <td className="sales-invoice-footer-right">
                  <div className="sales-invoice-bank-title">Company&apos;s Bank Details</div>
                  <div className="sales-invoice-bank-grid">
                    <div>Bank Name</div><div>: <strong>{issuer.bank_name || "-"}</strong></div>
                    <div>A/c No.</div><div>: <strong>{issuer.bank_account_no || "-"}</strong></div>
                    <div>Branch &amp; IFS Code</div><div>: <strong>{issuer.bank_branch_ifsc || "-"}</strong></div>
                  </div>
                  <div className="sales-invoice-sign-company">
                    for {(issuer.display_name || issuer.name || "Issuer Company").toUpperCase()}
                  </div>
                  <div className="sales-invoice-sign-label">Authorised Signatory</div>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="sales-invoice-footer-lines">
            <div className="sales-invoice-jurisdiction">SUBJECT TO HONNALLI JURISDICTION</div>
            <div className="sales-invoice-footer-note">This is a Computer Generated Invoice</div>
          </div>
        </section>
      ))}
    </main>
  );
}
