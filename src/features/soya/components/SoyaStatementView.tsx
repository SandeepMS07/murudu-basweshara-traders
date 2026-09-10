"use client";

import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatCurrencyINR } from "@/lib/number-format";

/**
 * One printable Statement of Account for both Soya modules.
 *
 * Factory and Parties carry different columns (WEIGHT/GST 5 % vs
 * NET WT/CGST/SGST/FREIGHT), so the entry table is driven by a column spec
 * rather than duplicating the whole document twice. The maize statement views
 * are not reused here because the Soya record shapes come from the customer's
 * workbook and no longer match the maize ones.
 */
export type SoyaStatementColumn<T> = {
  label: string;
  value: (row: T) => string;
  align?: "left" | "right";
  /** Percentage width, e.g. "8%". Must sum to 100 across the spec. */
  width?: string;
};

export type SoyaStatementPayment = {
  id: string;
  paid_on: string;
  bank: string;
  amount: number;
  remarks?: string;
};

interface SoyaStatementViewProps<T extends { id: string }> {
  /** e.g. "ADM" — the factory or party the statement is for. */
  counterpartyName: string;
  /** e.g. "Factory" / "Party" — labels the counterparty block. */
  counterpartyLabel: string;
  entries: T[];
  columns: SoyaStatementColumn<T>[];
  /** Sum of the invoice totals (column 12 / column 23). */
  totalBilled: number;
  payments: SoyaStatementPayment[];
  /** Party payments carry a REMRKS column; factory payments do not. */
  showRemarks?: boolean;
  /** "Balance Payable" for a factory, "Balance Receivable" for a party. */
  balanceLabel: string;
  /** "Total Purchases" / "Total Sales". */
  billedLabel: string;
  backHref: string;
  hideBackLink?: boolean;
}

const money = (value: number) =>
  formatCurrencyINR(value, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

function formatDate(value: string) {
  try {
    return format(parseISO(value), "dd-MM-yyyy");
  } catch {
    return value;
  }
}

export function SoyaStatementView<T extends { id: string }>({
  counterpartyName,
  counterpartyLabel,
  entries,
  columns,
  totalBilled,
  payments,
  showRemarks = false,
  balanceLabel,
  billedLabel,
  backHref,
  hideBackLink = false,
}: SoyaStatementViewProps<T>) {
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = totalBilled - totalPaid;

  return (
    <div className="min-h-screen bg-zinc-100 print:min-h-0 print:bg-white">
      <style>{`
        .statement-doc { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          html, body { height: auto !important; }
        }
      `}</style>

      <div className="mx-auto max-w-6xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          {hideBackLink ? (
            <span />
          ) : (
            <Link href={backHref}>
              <Button
                variant="outline"
                className="border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </Link>
          )}
          <Button
            type="button"
            onClick={() => window.print()}
            className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>

        <div className="statement-doc rounded-xl border border-zinc-200 bg-white text-zinc-900 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="h-2 rounded-t-xl bg-linear-to-r from-[#ff6a3d] to-[#ff8f6b] print:rounded-none" />

          <div className="p-6">
            <header className="flex flex-wrap items-start justify-between gap-4 border-b border-zinc-200 pb-4">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/mb-logo-bill.png"
                  alt="MB Groups"
                  className="h-12 w-auto object-contain"
                />
                <div>
                  <div className="text-lg font-bold tracking-tight text-zinc-900">
                    MB GROUPS
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    APMC Yard, Honnali
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c2410c]">
                  Soya Statement of Account
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Generated on {format(new Date(), "dd-MM-yyyy")}
                </div>
              </div>
            </header>

            <section className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  {counterpartyLabel}
                </div>
                <div className="mt-1 text-base font-bold text-zinc-900">
                  {counterpartyName}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-right">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                    {billedLabel}
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-zinc-900">
                    {money(totalBilled)}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
                    Total Paid
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-zinc-900">
                    {money(totalPaid)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#ff6a3d]/40 bg-[#fff3ee] p-2">
                  <div className="text-[9px] font-semibold uppercase tracking-wider text-[#c2410c]">
                    {balanceLabel}
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-[#c2410c]">
                    {money(balance)}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                Entries
              </h2>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 print:overflow-visible">
                <table className="w-full table-fixed border-collapse text-[11px] print:min-w-0">
                  <thead>
                    <tr className="bg-zinc-100 text-zinc-700">
                      {columns.map((column) => (
                        <th
                          key={column.label}
                          style={{ width: column.width }}
                          className={`border-b border-zinc-200 px-2 py-2 font-semibold uppercase tracking-wide ${
                            column.align === "right"
                              ? "text-right"
                              : "text-left"
                          }`}
                        >
                          {column.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {entries.length === 0 ? (
                      <tr>
                        <td
                          colSpan={columns.length}
                          className="px-2 py-6 text-center text-zinc-500"
                        >
                          No entries recorded.
                        </td>
                      </tr>
                    ) : (
                      entries.map((entry) => (
                        <tr key={entry.id} className="even:bg-zinc-50/60">
                          {columns.map((column) => (
                            <td
                              key={column.label}
                              className={`border-b border-zinc-100 px-2 py-1.5 align-top ${
                                column.align === "right"
                                  ? "whitespace-nowrap text-right"
                                  : "break-words"
                              }`}
                            >
                              {column.value(entry)}
                            </td>
                          ))}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-5">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                Payments
              </h2>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 print:overflow-visible">
                <table className="w-full table-fixed border-collapse text-[11px] print:min-w-0">
                  <thead>
                    <tr className="bg-zinc-100 text-zinc-700">
                      <th className="w-[8%] border-b border-zinc-200 px-2 py-2 text-left font-semibold uppercase tracking-wide">
                        SL NO
                      </th>
                      <th className="w-[18%] border-b border-zinc-200 px-2 py-2 text-left font-semibold uppercase tracking-wide">
                        DATE
                      </th>
                      <th className="w-[22%] border-b border-zinc-200 px-2 py-2 text-left font-semibold uppercase tracking-wide">
                        BANK
                      </th>
                      <th
                        className={`${showRemarks ? "w-[22%]" : "w-[52%]"} border-b border-zinc-200 px-2 py-2 text-right font-semibold uppercase tracking-wide`}
                      >
                        AMOUNT
                      </th>
                      {showRemarks ? (
                        <th className="w-[30%] border-b border-zinc-200 px-2 py-2 text-left font-semibold uppercase tracking-wide">
                          REMRKS
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td
                          colSpan={showRemarks ? 5 : 4}
                          className="px-2 py-6 text-center text-zinc-500"
                        >
                          No payments recorded.
                        </td>
                      </tr>
                    ) : (
                      payments.map((payment, index) => (
                        <tr key={payment.id} className="even:bg-zinc-50/60">
                          <td className="border-b border-zinc-100 px-2 py-1.5">
                            {index + 1}
                          </td>
                          <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1.5">
                            {formatDate(payment.paid_on)}
                          </td>
                          <td className="break-words border-b border-zinc-100 px-2 py-1.5">
                            {payment.bank || "-"}
                          </td>
                          <td className="whitespace-nowrap border-b border-zinc-100 px-2 py-1.5 text-right">
                            {money(payment.amount)}
                          </td>
                          {showRemarks ? (
                            <td className="break-words border-b border-zinc-100 px-2 py-1.5">
                              {payment.remarks || "-"}
                            </td>
                          ) : null}
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-zinc-100 font-semibold text-zinc-800">
                      <td
                        colSpan={3}
                        className="px-2 py-2 text-right uppercase tracking-wide"
                      >
                        Total Paid
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        {money(totalPaid)}
                      </td>
                      {showRemarks ? <td /> : null}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="mt-5 flex justify-end">
              <div className="w-full max-w-xs rounded-lg border border-[#ff6a3d]/40 bg-[#fff3ee] p-3">
                <div className="flex items-center justify-between text-[11px] text-zinc-600">
                  <span className="uppercase tracking-wide">{billedLabel}</span>
                  <span className="font-semibold text-zinc-900">
                    {money(totalBilled)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-600">
                  <span className="uppercase tracking-wide">Total Paid</span>
                  <span className="font-semibold text-zinc-900">
                    {money(totalPaid)}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-[#ff6a3d]/30 pt-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#c2410c]">
                    {balanceLabel}
                  </span>
                  <span className="text-base font-bold text-[#c2410c]">
                    {money(balance)}
                  </span>
                </div>
              </div>
            </section>

            <footer className="mt-6 border-t border-zinc-200 pt-3 text-center text-[10px] text-zinc-400">
              This is a computer-generated statement.
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
