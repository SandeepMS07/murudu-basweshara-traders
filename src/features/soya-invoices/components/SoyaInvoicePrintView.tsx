"use client";

import { useEffect } from "react";

import type { EInvoiceSeller } from "@/features/soya-invoices/lib/einvoice-payload";
import type { SoyaInvoice } from "@/features/soya-invoices/schemas";
import { stateNameForCode } from "@/features/soya/lib/gst";
import { formatNumberIN } from "@/lib/number-format";
import {
  PrintOrientationToggle,
  usePrintOrientation,
} from "@/components/print/PrintOrientationToggle";

/**
 * The printed tax invoice — A4, portrait by default, on plain white.
 *
 * Every element here is required by Rule 46 of the CGST Rules: the words "Tax
 * Invoice", both GSTINs, the HSN per line, the tax broken out by head, the
 * place of supply, the total in words, and a signature block. The layout is
 * conventional on purpose — this is a document a buyer's accounts department
 * has to recognise at a glance, not a place to be inventive.
 *
 * Print CSS mirrors the Sales statement: headers repeated via
 * table-header-group, and `tfoot` forced to table-row-group so the totals print
 * once rather than on every page. The paper orientation is the user's choice
 * (see usePrintOrientation); landscape widens the sheet accordingly.
 */

function amountInWords(value: number): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  const twoDigit = (num: number): string =>
    num < 20 ? ones[num] : `${tens[Math.floor(num / 10)]}${num % 10 ? ` ${ones[num % 10]}` : ""}`;

  const threeDigit = (num: number): string =>
    num >= 100
      ? `${ones[Math.floor(num / 100)]} Hundred${num % 100 ? ` ${twoDigit(num % 100)}` : ""}`
      : twoDigit(num);

  const rupees = Math.floor(Math.abs(value));
  const paise = Math.round((Math.abs(value) - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  // Indian grouping: crore, lakh, thousand, then the last three digits.
  const parts: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const rest = rupees % 1000;

  if (crore) parts.push(`${threeDigit(crore)} Crore`);
  if (lakh) parts.push(`${threeDigit(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigit(thousand)} Thousand`);
  if (rest) parts.push(threeDigit(rest));

  const rupeeWords = parts.join(" ");
  const paiseWords = paise ? ` and ${twoDigit(paise)} Paise` : "";
  return `${value < 0 ? "Minus " : ""}${rupeeWords} Rupees${paiseWords} Only`;
}

function money(value: number): string {
  return formatNumberIN(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface SoyaInvoicePrintViewProps {
  invoice: SoyaInvoice;
  seller: EInvoiceSeller;
  /** Opens the print dialog on load, for the "Print" link. */
  autoPrint?: boolean;
}

export function SoyaInvoicePrintView({
  invoice,
  seller,
  autoPrint = false,
}: SoyaInvoicePrintViewProps) {
  useEffect(() => {
    if (!autoPrint) return;
    // One frame so fonts and layout settle before the dialog freezes the page.
    const timer = window.setTimeout(() => window.print(), 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  const { orientation, setOrientation } = usePrintOrientation({
    storageKey: "soya-invoice",
  });

  const isIntra = invoice.igst <= 0;
  const taxTotal = invoice.cgst + invoice.sgst + invoice.igst;

  // The rate-wise summary a buyer's accountant reconciles against.
  const byRate = new Map<number, { taxable: number; cgst: number; sgst: number; igst: number }>();
  for (const item of invoice.items) {
    const bucket = byRate.get(item.gst_rate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    bucket.taxable += item.taxable_value;
    bucket.cgst += item.cgst;
    bucket.sgst += item.sgst;
    bucket.igst += item.igst;
    byRate.set(item.gst_rate, bucket);
  }

  return (
    <>
      <style>{`
        /* Page size/orientation comes from usePrintOrientation. */
        .inv-root {
          background: #fff;
          color: #111;
          font-family: ui-sans-serif, system-ui, "Segoe UI", Arial, sans-serif;
          font-size: 11px;
          line-height: 1.35;
          max-width: 190mm;
          margin: 0 auto;
          padding: 8mm;
        }
        .inv-root * { box-sizing: border-box; }
        .inv-title { text-align: center; font-size: 15px; font-weight: 700; letter-spacing: 0.08em; }
        .inv-sub { text-align: center; font-size: 10px; color: #555; margin-top: 1px; }
        .inv-box { border: 1px solid #111; }
        .inv-grid2 { display: grid; grid-template-columns: 1fr 1fr; }
        .inv-grid2 > div + div { border-left: 1px solid #111; }
        .inv-cell { padding: 5px 7px; }
        .inv-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.07em; color: #555; }
        .inv-name { font-weight: 700; font-size: 12px; }
        .inv-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        .inv-table th, .inv-table td { border: 1px solid #111; padding: 3px 5px; }
        .inv-table th { background: #f2f2f2; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; vertical-align: bottom; }
        .inv-table td { vertical-align: top; overflow-wrap: anywhere; }
        .num { text-align: right; white-space: nowrap; overflow-wrap: normal; font-variant-numeric: tabular-nums; }
        .inv-words { padding: 5px 7px; border: 1px solid #111; border-top: 0; }
        .inv-foot { display: grid; grid-template-columns: 1fr auto; gap: 10px; margin-top: 8px; }
        .inv-sign { text-align: right; padding-top: 34px; font-size: 10px; }
        .inv-irn { border: 1px solid #111; border-top: 0; padding: 5px 7px; font-size: 9px; }
        .inv-irn code { font-family: ui-monospace, Menlo, Consolas, monospace; word-break: break-all; }
        .no-print { margin: 12px auto; max-width: 190mm; }
        @media print {
          .no-print { display: none !important; }
          .inv-root { padding: 0; max-width: none; }
          thead { display: table-header-group; }
          /* tfoot repeats on every page by default; totals must print once. */
          tfoot { display: table-row-group; }
          .inv-table { font-size: 9px; }
          .inv-table th, .inv-table td { padding: 2px 4px; }
        }
        /* Landscape A4 has ~277mm of usable width; let the sheet use it. */
        html[data-print-orientation="landscape"] .inv-root {
          max-width: 277mm;
        }
      `}</style>

      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <PrintOrientationToggle
          orientation={orientation}
          onChange={setOrientation}
        />
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            cursor: "pointer",
            border: "1px solid #ccc",
            borderRadius: 6,
            padding: "8px 14px",
            background: "#fff",
            fontSize: 13,
          }}
        >
          Print this invoice
        </button>
      </div>

      <div className="inv-root">
        <div className="inv-title">TAX INVOICE</div>
        <div className="inv-sub">
          {invoice.doc_type === "CRN"
            ? "Credit Note"
            : invoice.doc_type === "DBN"
              ? "Debit Note"
              : "Original for Recipient"}
        </div>

        <div style={{ height: 6 }} />

        {/* ------------------------------------------------- seller + meta */}
        <div className="inv-box inv-grid2">
          <div className="inv-cell">
            <div className="inv-name">{seller.legal_name || seller.name}</div>
            {seller.address ? <div>{seller.address}</div> : null}
            <div>
              {[seller.place, seller.pincode].filter(Boolean).join(" - ")}
              {seller.state_code ? `, ${stateNameForCode(seller.state_code)}` : ""}
            </div>
            {seller.gstin ? (
              <div style={{ marginTop: 3 }}>
                <span className="inv-label">GSTIN </span>
                <strong>{seller.gstin}</strong>
              </div>
            ) : null}
            {seller.phone ? <div>Phone: {seller.phone}</div> : null}
          </div>
          <div className="inv-cell">
            <table style={{ width: "100%", fontSize: 11 }}>
              <tbody>
                <tr>
                  <td className="inv-label">Invoice No</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{invoice.invoice_no}</td>
                </tr>
                <tr>
                  <td className="inv-label">Date</td>
                  <td style={{ textAlign: "right" }}>{invoice.invoice_date}</td>
                </tr>
                <tr>
                  <td className="inv-label">Place of Supply</td>
                  <td style={{ textAlign: "right" }}>
                    {stateNameForCode(invoice.place_of_supply_code)} (
                    {invoice.place_of_supply_code})
                  </td>
                </tr>
                <tr>
                  <td className="inv-label">Reverse Charge</td>
                  <td style={{ textAlign: "right" }}>{invoice.reverse_charge ? "Yes" : "No"}</td>
                </tr>
                {invoice.vehicle_no ? (
                  <tr>
                    <td className="inv-label">Vehicle No</td>
                    <td style={{ textAlign: "right" }}>{invoice.vehicle_no}</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        {/* -------------------------------------------------- buyer blocks */}
        <div className="inv-box inv-grid2" style={{ borderTop: 0 }}>
          <div className="inv-cell">
            <div className="inv-label">Bill To</div>
            <div className="inv-name">{invoice.party_legal_name || invoice.party_name}</div>
            {invoice.bill_to_address ? <div>{invoice.bill_to_address}</div> : null}
            <div>
              {[invoice.bill_to_place, invoice.bill_to_pincode].filter(Boolean).join(" - ")}
              {invoice.party_state_code
                ? `, ${stateNameForCode(invoice.party_state_code)}`
                : ""}
            </div>
            <div style={{ marginTop: 3 }}>
              <span className="inv-label">GSTIN </span>
              <strong>{invoice.party_gstin || "Unregistered"}</strong>
            </div>
          </div>
          <div className="inv-cell">
            <div className="inv-label">Ship To</div>
            {invoice.ship_to_address ? (
              <>
                <div className="inv-name">{invoice.ship_to_name || invoice.party_name}</div>
                <div>{invoice.ship_to_address}</div>
                <div>
                  {[invoice.ship_to_place, invoice.ship_to_pincode].filter(Boolean).join(" - ")}
                  {invoice.ship_to_state_code
                    ? `, ${stateNameForCode(invoice.ship_to_state_code)}`
                    : ""}
                </div>
              </>
            ) : (
              <div style={{ color: "#555" }}>Same as billing address</div>
            )}

            {invoice.dispatch_from_address ? (
              <div style={{ marginTop: 6, paddingTop: 5, borderTop: "1px dashed #999" }}>
                <div className="inv-label">Dispatched From</div>
                <div>{invoice.dispatch_from_name}</div>
                <div>{invoice.dispatch_from_address}</div>
                <div>
                  {[invoice.dispatch_from_place, invoice.dispatch_from_pincode]
                    .filter(Boolean)
                    .join(" - ")}
                  {invoice.dispatch_from_state_code
                    ? `, ${stateNameForCode(invoice.dispatch_from_state_code)}`
                    : ""}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* --------------------------------------------------------- lines */}
        <table className="inv-table" style={{ marginTop: 8 }}>
          <colgroup>
            <col style={{ width: "4%" }} />
            <col style={{ width: "30%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "7%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th style={{ textAlign: "left" }}>Description of Goods</th>
              <th>HSN</th>
              <th className="num">Qty</th>
              <th className="num">Rate</th>
              <th className="num">Taxable</th>
              <th className="num">GST %</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, index) => (
              <tr key={item.id}>
                <td className="num">{index + 1}</td>
                <td>{item.description || item.item_name}</td>
                <td style={{ textAlign: "center" }}>{item.hsn}</td>
                <td className="num">
                  {formatNumberIN(item.quantity, { maximumFractionDigits: 3 })} {item.unit}
                </td>
                <td className="num">{money(item.rate)}</td>
                <td className="num">{money(item.taxable_value)}</td>
                <td className="num">{item.gst_rate}%</td>
                <td className="num">{money(item.total_value)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ textAlign: "right", fontWeight: 700 }}>
                Taxable Value
              </td>
              <td className="num" style={{ fontWeight: 700 }}>
                {money(invoice.taxable_value)}
              </td>
              <td colSpan={2} />
            </tr>
            {isIntra ? (
              <>
                <tr>
                  <td colSpan={6} style={{ textAlign: "right" }}>
                    CGST
                  </td>
                  <td colSpan={2} className="num">
                    {money(invoice.cgst)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={6} style={{ textAlign: "right" }}>
                    SGST
                  </td>
                  <td colSpan={2} className="num">
                    {money(invoice.sgst)}
                  </td>
                </tr>
              </>
            ) : (
              <tr>
                <td colSpan={6} style={{ textAlign: "right" }}>
                  IGST
                </td>
                <td colSpan={2} className="num">
                  {money(invoice.igst)}
                </td>
              </tr>
            )}
            {invoice.other_charges ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "right" }}>
                  Other Charges
                </td>
                <td colSpan={2} className="num">
                  {money(invoice.other_charges)}
                </td>
              </tr>
            ) : null}
            <tr>
              <td colSpan={6} style={{ textAlign: "right" }}>
                Round Off
              </td>
              <td colSpan={2} className="num">
                {money(invoice.round_off)}
              </td>
            </tr>
            <tr>
              <td colSpan={6} style={{ textAlign: "right", fontWeight: 700, fontSize: 12 }}>
                TOTAL
              </td>
              <td colSpan={2} className="num" style={{ fontWeight: 700, fontSize: 12 }}>
                ₹{formatNumberIN(invoice.total_value)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="inv-words">
          <span className="inv-label">Amount in words: </span>
          <strong>{amountInWords(invoice.total_value)}</strong>
        </div>

        {/* --------------------------------------------- rate-wise summary */}
        <table className="inv-table" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Tax Rate</th>
              <th className="num">Taxable Value</th>
              {isIntra ? (
                <>
                  <th className="num">CGST</th>
                  <th className="num">SGST</th>
                </>
              ) : (
                <th className="num">IGST</th>
              )}
              <th className="num">Total Tax</th>
            </tr>
          </thead>
          <tbody>
            {[...byRate.entries()].map(([rate, bucket]) => (
              <tr key={rate}>
                <td>{rate}%</td>
                <td className="num">{money(bucket.taxable)}</td>
                {isIntra ? (
                  <>
                    <td className="num">{money(bucket.cgst)}</td>
                    <td className="num">{money(bucket.sgst)}</td>
                  </>
                ) : (
                  <td className="num">{money(bucket.igst)}</td>
                )}
                <td className="num">{money(bucket.cgst + bucket.sgst + bucket.igst)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td>Total</td>
              <td className="num">{money(invoice.taxable_value)}</td>
              {isIntra ? (
                <>
                  <td className="num">{money(invoice.cgst)}</td>
                  <td className="num">{money(invoice.sgst)}</td>
                </>
              ) : (
                <td className="num">{money(invoice.igst)}</td>
              )}
              <td className="num">{money(taxTotal)}</td>
            </tr>
          </tfoot>
        </table>

        {/* ------------------------------------------------------ e-invoice */}
        {invoice.irn ? (
          <div className="inv-irn" style={{ borderTop: "1px solid #111", marginTop: 8 }}>
            <div>
              <span className="inv-label">IRN </span>
              <code>{invoice.irn}</code>
            </div>
            <div style={{ marginTop: 2 }}>
              <span className="inv-label">Ack No </span>
              <code>{invoice.ack_no}</code>
              {invoice.ack_date ? (
                <>
                  <span className="inv-label"> · Ack Date </span>
                  {new Date(invoice.ack_date).toLocaleString("en-IN")}
                </>
              ) : null}
            </div>
            {invoice.ewb_no ? (
              <div style={{ marginTop: 2 }}>
                <span className="inv-label">e-Way Bill </span>
                <code>{invoice.ewb_no}</code>
                {invoice.ewb_valid_until ? (
                  <>
                    <span className="inv-label"> · valid until </span>
                    {new Date(invoice.ewb_valid_until).toLocaleString("en-IN")}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* ---------------------------------------------------------- foot */}
        <div className="inv-foot">
          <div style={{ fontSize: 9.5, color: "#333" }}>
            {invoice.notes ? (
              <p style={{ margin: "0 0 4px" }}>
                <strong>Notes:</strong> {invoice.notes}
              </p>
            ) : null}
            <p style={{ margin: 0 }}>
              <strong>Declaration:</strong> We declare that this invoice shows the
              actual price of the goods described and that all particulars are true
              and correct.
            </p>
          </div>
          <div className="inv-sign">
            <div>For {seller.legal_name || seller.name}</div>
            <div style={{ marginTop: 28 }}>Authorised Signatory</div>
          </div>
        </div>
      </div>
    </>
  );
}
