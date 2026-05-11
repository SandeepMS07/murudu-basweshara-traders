import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { requireAuth } from "@/features/auth/lib/session";
import { getBillById } from "@/features/bills/service/bill.service";
import { BillPrintAuto } from "@/features/bills/components/BillPrintAuto";
import { getPurchaseById } from "@/features/purchases/service/purchase.service";
import { getBiltyById, getBiltyParties } from "@/features/bilty/service/bilty.service";
import { Bill } from "@/features/bills/schemas";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { stripIndiaCountryCode } from "@/lib/phone-format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BillPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ pid?: string; preview?: string }>;
}) {
  await requireAuth();
  const { id } = await params;
  const { pid, preview } = (await searchParams) || {};
  const previewMode = preview === "1";
  const purchase = pid ? await getPurchaseById(pid) : null;
  const bilty = !purchase && pid ? await getBiltyById(pid) : null;
  const biltyParty =
    !purchase && bilty
      ? (await getBiltyParties()).find(
          (party) =>
            party.name.trim().toLowerCase() ===
            (bilty.party || bilty.name || "").trim().toLowerCase(),
        ) ?? null
      : null;
  const sourceRecord = purchase ?? bilty;
  let bill: Bill | null = await getBillById(id);

  if (!bill && previewMode && sourceRecord) {
    bill = {
      id,
      bill_no: 0,
      bill_date: sourceRecord.date,
      net_weight: sourceRecord.net_weight,
      rate: sourceRecord.rate,
      freight: 0,
      payment_term_days: 0,
      source: "app",
      amount: sourceRecord.amount,
      final_amount: sourceRecord.final_total,
      due_date: sourceRecord.date,
    };
  }

  if (!bill) {
    notFound();
  }

  let printDate = bill.bill_date;
  try {
    printDate = format(parseISO(bill.bill_date), "dd-MM-yyyy");
  } catch {
    printDate = bill.bill_date;
  }

  const weight = sourceRecord?.weight ?? bill.net_weight;
  const lessWeight = sourceRecord?.less_weight ?? 0;
  const netWeight = bill.net_weight;
  const rate = bill.rate;
  const displayRate = rate;
  const lineAmount = bill.amount;
  const summaryAmount = sourceRecord ? sourceRecord.amount : bill.amount;
  const summaryLess =
    sourceRecord && "bag_less" in sourceRecord
      ? sourceRecord.bag_less
      : bill.freight;
  const summaryCash = sourceRecord ? sourceRecord.cash_paid : 0;
  const summaryExtra = sourceRecord ? sourceRecord.add_amount : 0;
  const summaryTotal = sourceRecord ? sourceRecord.final_total : bill.final_amount;
  const summaryTotalText = formatCurrencyINR(summaryTotal, {
    maximumFractionDigits: 0,
  });
  const totalValueSizeClass =
    summaryTotalText.length >= 12
      ? "bill-print-total-value-sm"
      : summaryTotalText.length >= 10
        ? "bill-print-total-value-md"
        : "";
  const billNumber =
    sourceRecord?.bill_no && sourceRecord.bill_no > 0
      ? String(sourceRecord.bill_no)
      : bill.bill_no > 0
        ? String(bill.bill_no)
        : "AUTO";
  const sourceParty = (sourceRecord as { party?: string } | null)?.party;
  const billToName = sourceParty || sourceRecord?.name || "-";
  const billToPhoneRaw =
    sourceRecord?.mob || (biltyParty?.mob ?? "");
  const billToPlace =
    sourceRecord?.place || (biltyParty?.place ?? "");
  const billToPhone = stripIndiaCountryCode(billToPhoneRaw);
  const redirectTo = purchase ? "/purchases" : "/bilty";
  const documentLabel = "ESTIMATION INVOICE";
  const sourceTypeLabel = purchase ? "PURCHASE" : "BILTY";
  const copies = previewMode ? [1] : [1, 2];
  const rootClassName = `bill-print-root bill-print-preview${
    previewMode ? " bill-print-inline-preview" : ""
  }`;

  return (
    <main className={rootClassName}>
      {!previewMode ? <BillPrintAuto redirectTo={redirectTo} /> : null}
      {copies.map((copy) => (
        <section className="bill-print-copy" key={copy}>
          <header className="bill-print-header">
            <div className="bill-print-brand-row">
              <div className="bill-print-brand">
                <img
                  src="/brand/mb-logo-bill.png"
                  alt="MB Groups logo"
                  className="bill-print-logo-image"
                />
              </div>
                    <div className="bill-print-invoice-box">
                      <div className="bill-print-invoice-label">
                        {documentLabel}
                      </div>
                      <div className="bill-print-invoice-number">{billNumber}</div>
                    </div>
            </div>
          </header>

          <section className="bill-print-info">
            <div className="bill-print-info-left">
              <div className="bill-print-yard">APMC Yard</div>
              <div>Honnali</div>

              <div className="bill-print-info-phone mt-2">
                <span>Bags</span>{" "}
                <strong>
                  :{" "}
                  {formatNumberIN(sourceRecord?.bags ?? 0, {
                    maximumFractionDigits: 0,
                  })}
                </strong>
              </div>
            </div>
            <div className="bill-print-info-right">
              <div className="bill-print-kv">
                <span className="bill-print-icon">◼</span>
                <span>DATE:</span> <strong>{printDate}</strong>
              </div>
              <div className="bill-print-kv">
                <span className="bill-print-icon">◼</span>
                <span>TYPE:</span> <strong>{sourceTypeLabel}</strong>
              </div>
              <div className="bill-print-kv">
                <span className="bill-print-icon">◼</span>
                <span>BILL TO:</span>{" "}
                <strong>{billToName}</strong>
              </div>
              <div className="bill-print-kv">
                <span className="bill-print-icon">◼</span>
                <span>PHONE:</span>{" "}
                <strong>{billToPhone || "-"}</strong>
              </div>
              <div className="bill-print-kv">
                <span className="bill-print-icon">◉</span>
                <span>PLACE:</span>{" "}
                <strong>{billToPlace || "-"}</strong>
              </div>
            </div>
          </section>

          <table className="bill-print-table bill-print-main-table">
            <tbody>
              <tr>
                <th>DESCRIPTION</th>
                <th>AMOUNT</th>
              </tr>
              <tr>
                <td>WEIGHT</td>
                <td>
                  {formatNumberIN(weight, {
                    maximumFractionDigits: 0,
                  })}
                </td>
              </tr>
              <tr>
                <td>LESS</td>
                <td>
                  {formatNumberIN(lessWeight, {
                    maximumFractionDigits: 0,
                  })}
                </td>
              </tr>
              <tr>
                <td>NET WEIGHT</td>
                <td>
                  {formatNumberIN(netWeight, {
                    maximumFractionDigits: 0,
                  })}
                </td>
              </tr>
              <tr>
                <td>RATE</td>
                <td>
                  {formatCurrencyINR(displayRate, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
              <tr className="bill-print-key-row">
                <td>AMOUNT</td>
                <td>
                  {formatCurrencyINR(lineAmount, {
                    maximumFractionDigits: 0,
                  })}
                </td>
              </tr>
            </tbody>
          </table>

          <section className="bill-print-note-row">
            <div className="bill-print-note-left">
              Make all checks payable to MB GROUPS.
              <br />
              Send this bill nd bank passbook to whastapp 9019800731/7795953398
              <span className="bill-print-note-icons">● 🏦</span>
            </div>
            <div className="bill-print-note-right" />
          </section>

          <section className="bill-print-sign-row">
            <div className="bill-print-sign">
              <div className="bill-print-sign-title">Farmer Signature</div>
              <div className="bill-print-sign-line" />
              <div className="bill-print-sign-caption">Farmer Signature</div>
            </div>
            <table className="bill-print-table bill-print-summary-table">
              <tbody>
                <tr>
                  <td>AMOUNT</td>
                  <td>
                    {formatCurrencyINR(summaryAmount, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
                <tr>
                  <td>BAG LESS</td>
                  <td>
                    {formatCurrencyINR(summaryLess, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
                <tr>
                  <td>CASH</td>
                  <td>
                    {formatCurrencyINR(summaryCash, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
                <tr>
                  <td>EXTRA</td>
                  <td>
                    {formatCurrencyINR(summaryExtra, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <footer className="bill-print-total-row">
            <div className="bill-print-thanks">
              THANK YOU FOR YOUR BUSINESS!
            </div>
            <div className="bill-print-total-label">TOTAL</div>
            <div
              className={`bill-print-total-value ${totalValueSizeClass}`.trim()}
            >
              {summaryTotalText}
            </div>
          </footer>
        </section>
      ))}
    </main>
  );
}
