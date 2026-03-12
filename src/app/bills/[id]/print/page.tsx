import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { requireAuth } from "@/features/auth/lib/session";
import { getBillById } from "@/features/bills/service/bill.service";
import { BillPrintAuto } from "@/features/bills/components/BillPrintAuto";
import { getPurchaseById } from "@/features/purchases/service/purchase.service";
import { Bill } from "@/features/bills/schemas";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { stripIndiaCountryCode } from "@/lib/phone-format";

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
  let bill: Bill | null = await getBillById(id);

  if (!bill && previewMode && purchase) {
    bill = {
      id,
      bill_date: purchase.date,
      net_weight: purchase.net_weight,
      rate: purchase.rate,
      freight: 0,
      payment_term_days: 0,
      source: "app",
      amount: purchase.amount,
      final_amount: purchase.final_total,
      due_date: purchase.date,
    };
  }

  if (!bill) {
    notFound();
  }

  let printDate = bill.bill_date;
  try {
    printDate = format(parseISO(bill.bill_date), "MMMM d, yyyy");
  } catch {
    printDate = bill.bill_date;
  }

  const weight = purchase?.weight ?? bill.net_weight;
  const lessWeight = purchase?.less_weight ?? 0;
  const netWeight = bill.net_weight;
  const rate = bill.rate;
  const lineAmount = bill.amount;
  const summaryAmount = purchase ? purchase.amount : bill.amount;
  const summaryLess = purchase ? purchase.bag_less : bill.freight;
  const summaryCash = purchase ? purchase.cash_paid : 0;
  const summaryExtra = purchase ? purchase.add_amount : 0;
  const summaryTotal = purchase ? purchase.final_total : bill.final_amount;
  const summaryTotalText = formatCurrencyINR(summaryTotal, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const totalValueSizeClass =
    summaryTotalText.length >= 12
      ? "bill-print-total-value-sm"
      : summaryTotalText.length >= 10
        ? "bill-print-total-value-md"
        : "";
  const billNumber = bill.id.slice(-6).toUpperCase();
  const billToPhone = stripIndiaCountryCode(purchase?.mob);
  const copies = previewMode ? [1] : [1, 2];
  const rootClassName = `bill-print-root bill-print-preview${
    previewMode ? " bill-print-inline-preview" : ""
  }`;

  return (
    <main className={rootClassName}>
      {!previewMode ? <BillPrintAuto redirectTo="/purchases" /> : null}
      {copies.map((copy) => (
        <section className="bill-print-copy" key={copy}>
          <header className="bill-print-header">
            <div className="bill-print-brand-row">
              <div className="bill-print-brand">
                <div className="bill-print-logo-mark">MB</div>
                <div className="bill-print-title">MB Groups</div>
              </div>
              <div className="bill-print-invoice-box">
                <div className="bill-print-invoice-label">ESTIMATION INVOICE</div>
                <div className="bill-print-invoice-number">{billNumber}</div>
              </div>
            </div>
          </header>

          <section className="bill-print-info">
            <div className="bill-print-info-left">
              <div className="bill-print-yard">APMC Yard</div>
              <div>Honnali</div>
              <div>Harish Putta :- 9019800731</div>
              <div>Jagadish&nbsp;&nbsp;&nbsp;&nbsp;:-&nbsp;&nbsp;7795953398</div>
            </div>
            <div className="bill-print-info-right">
              <div className="bill-print-kv"><span className="bill-print-icon">◼</span><span>DATE:</span> <strong>{printDate}</strong></div>
              <div className="bill-print-kv"><span className="bill-print-icon">◼</span><span>BILL TO:</span> <strong>{purchase?.name || "-"}</strong></div>
              <div className="bill-print-kv"><span className="bill-print-icon">◼</span><span>PHONE:</span> <strong>{billToPhone}</strong></div>
              <div className="bill-print-kv"><span className="bill-print-icon">◉</span><span>PLACE:</span> <strong>{purchase?.place || "-"}</strong></div>
            </div>
          </section>

          <table className="bill-print-table bill-print-main-table">
            <tbody>
              <tr><th>DESCRIPTION</th><th>AMOUNT</th></tr>
              <tr><td>WEIGHT</td><td>{formatNumberIN(weight, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td></tr>
              <tr><td>LESS</td><td>{formatNumberIN(lessWeight, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td></tr>
              <tr><td>NET WEIGHT</td><td>{formatNumberIN(netWeight, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td></tr>
              <tr><td>RATE</td><td>{formatCurrencyINR(rate, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td></tr>
              <tr className="bill-print-key-row"><td>AMOUNT</td><td>{formatCurrencyINR(lineAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td></tr>
            </tbody>
          </table>

          <section className="bill-print-note-row">
            <div className="bill-print-note-left">
              Make all checks payable to MB GROUPS.
              <br />
              Send this bill nd bank passbook to whastapp 9019800731/7795953398
              <span className="bill-print-note-icons">●  🏦</span>
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
                <tr><td>AMOUNT</td><td>{formatCurrencyINR(summaryAmount, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td></tr>
                <tr><td>BAG LESS</td><td>{formatCurrencyINR(summaryLess, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td></tr>
                <tr><td>CASH</td><td>{formatCurrencyINR(summaryCash, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td></tr>
                <tr><td>EXTRA</td><td>{formatCurrencyINR(summaryExtra, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td></tr>
              </tbody>
            </table>
          </section>

          <footer className="bill-print-total-row">
            <div className="bill-print-thanks">THANK YOU FOR YOUR BUSINESS!</div>
            <div className="bill-print-total-label">TOTAL</div>
            <div className={`bill-print-total-value ${totalValueSizeClass}`.trim()}>
              {summaryTotalText}
            </div>
          </footer>
        </section>
      ))}
    </main>
  );
}
