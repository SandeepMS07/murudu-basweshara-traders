"use client";

import { useMemo, type ComponentType, type ReactNode } from "react";
import { format, parseISO } from "date-fns";
import { Banknote, Printer, Receipt, User, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { type Bilty, type BiltyPartyPayment } from "@/features/bilty/schemas";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

const formatDisplayDate = (value: string) => {
  try {
    return format(parseISO(value), "dd-MM-yyyy");
  } catch {
    return value;
  }
};

const paymentModeLabel = (payment: BiltyPartyPayment) => {
  if (payment.payment_mode === "rtgs") {
    return payment.rtgs_name ? `RTGS (${payment.rtgs_name})` : "RTGS";
  }
  if (payment.payment_mode === "cash") return "Cash";
  if (payment.payment_mode === "upi") return "UPI";
  return "-";
};

const onesWords = [
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
const tensWords = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

const twoDigitWords = (n: number): string => {
  if (n < 20) return onesWords[n];
  const tens = Math.trunc(n / 10);
  const ones = n % 10;
  return `${tensWords[tens]}${ones ? ` ${onesWords[ones]}` : ""}`;
};

const threeDigitWords = (n: number): string => {
  const hundreds = Math.trunc(n / 100);
  const rest = n % 100;
  if (!hundreds) return twoDigitWords(rest);
  return `${onesWords[hundreds]} Hundred${rest ? ` ${twoDigitWords(rest)}` : ""}`;
};

const numberToWordsIN = (value: number): string => {
  const n = Math.max(0, Math.round(value));
  if (n === 0) return "Zero";
  const crore = Math.trunc(n / 10_000_000);
  const lakh = Math.trunc((n % 10_000_000) / 100_000);
  const thousand = Math.trunc((n % 100_000) / 1_000);
  const rest = n % 1_000;
  const parts: string[] = [];
  if (crore) parts.push(`${twoDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitWords(rest));
  return parts.join(" ");
};

const SectionHeading = ({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) => (
  <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-600">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ff6a3d] text-white">
      <Icon className="h-3.5 w-3.5" />
    </span>
    {children}
  </h2>
);

interface BiltyPartyStatementViewProps {
  partyName: string;
  partyPlace?: string;
  partyMob?: string;
  biltys: Bilty[];
  payments: BiltyPartyPayment[];
  hideBackLink?: boolean;
}

export function BiltyPartyStatementView({
  partyName,
  partyPlace,
  partyMob,
  biltys,
  payments,
  hideBackLink,
}: BiltyPartyStatementViewProps) {
  const sortedBiltys = useMemo(
    () =>
      [...biltys].sort(
        (a, b) => a.date.localeCompare(b.date) || a.bill_no - b.bill_no,
      ),
    [biltys],
  );
  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => a.paid_on.localeCompare(b.paid_on)),
    [payments],
  );

  const totalAmount = biltys.reduce((sum, row) => sum + row.final_total, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balancePayable = Math.max(totalAmount - totalPaid, 0);

  return (
    <div className="min-h-screen print:min-h-0 bg-zinc-100 print:bg-white">
      <style>{`
        .statement-doc { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media print {
          html, body { height: auto !important; }
        }
      `}</style>

      <div className="mx-auto max-w-4xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
        <div className="mb-4 flex items-center justify-between print:hidden">
          {hideBackLink ? (
            <span />
          ) : (
            <a
              href="/bilty/parties"
              className="text-sm text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
            >
              ← Back to Parties
            </a>
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
                  Statement of Account
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Generated on {format(new Date(), "dd-MM-yyyy")}
                </div>
              </div>
            </header>

            <section className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2 print:grid-cols-2">
              <div className="self-start">
                <SectionHeading icon={User}>Party Details</SectionHeading>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-zinc-400">Party</dt>
                    <dd className="font-semibold text-zinc-900">
                      {partyName}
                    </dd>
                  </div>
                  {partyPlace ? (
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-zinc-400">Place</dt>
                      <dd className="text-zinc-700">{partyPlace}</dd>
                    </div>
                  ) : null}
                  {partyMob ? (
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-zinc-400">Mobile</dt>
                      <dd className="text-zinc-700">{partyMob}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <SectionHeading icon={Wallet}>Balance Summary</SectionHeading>
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex items-start gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                      <Receipt className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-zinc-600">
                        Total Purchases
                      </div>
                      <div className="text-sm font-bold tabular-nums text-zinc-900">
                        {formatCurrencyINR(totalAmount, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      <div className="text-[9px] text-zinc-400">
                        {biltys.length}{" "}
                        {biltys.length === 1 ? "bill" : "bills"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Banknote className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-emerald-700">
                        Total Paid
                      </div>
                      <div className="text-sm font-bold tabular-nums text-emerald-700">
                        {formatCurrencyINR(totalPaid, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      <div className="text-[9px] text-emerald-700/70">
                        {payments.length}{" "}
                        {payments.length === 1 ? "payment" : "payments"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-[#ff6a3d]/30 bg-[#fff4ef] px-2.5 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ff6a3d] text-white">
                      <Wallet className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-[#c2410c]">
                        Balance Payable
                      </div>
                      <div className="text-sm font-bold tabular-nums text-[#c2410c]">
                        {formatCurrencyINR(balancePayable, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {balancePayable > 0 ? (
              <div className="mt-3 text-[11px] text-zinc-500">
                <span className="font-medium text-zinc-700">
                  Amount in words:
                </span>{" "}
                Rupees {numberToWordsIN(balancePayable)} Only
              </div>
            ) : null}

            <section className="mt-5">
              <SectionHeading icon={Receipt}>Purchase Details</SectionHeading>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 print:overflow-visible">
                <table className="w-full table-fixed border-collapse text-[12px] print:min-w-0">
                  <thead>
                    <tr className="bg-zinc-900 text-white">
                      <th
                        style={{ width: "10%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        Bill No
                      </th>
                      <th
                        style={{ width: "14%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        Date
                      </th>
                      <th
                        style={{ width: "12%" }}
                        className="px-2.5 py-1.5 text-right font-medium"
                      >
                        Bags
                      </th>
                      <th
                        style={{ width: "16%" }}
                        className="px-2.5 py-1.5 text-right font-medium"
                      >
                        Net Wt
                      </th>
                      <th
                        style={{ width: "14%" }}
                        className="px-2.5 py-1.5 text-right font-medium"
                      >
                        Rate
                      </th>
                      <th
                        style={{ width: "18%" }}
                        className="px-2.5 py-1.5 text-right font-medium"
                      >
                        Amount
                      </th>
                      <th
                        style={{ width: "16%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        Payment
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedBiltys.length === 0 ? (
                      <tr>
                        <td className="px-2.5 py-3 text-zinc-400" colSpan={7}>
                          No purchase entries for this party.
                        </td>
                      </tr>
                    ) : (
                      sortedBiltys.map((row, index) => (
                        <tr
                          key={row.id}
                          className={`break-inside-avoid ${index % 2 === 1 ? "bg-zinc-50/60" : ""}`}
                        >
                          <td className="px-2.5 py-1 font-medium">
                            {row.bill_no}
                          </td>
                          <td className="px-2.5 py-1 whitespace-nowrap text-zinc-600">
                            {formatDisplayDate(row.date)}
                          </td>
                          <td className="px-2.5 py-1 text-right tabular-nums text-zinc-600">
                            {formatNumberIN(row.bags, {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td className="px-2.5 py-1 text-right tabular-nums text-zinc-600">
                            {formatNumberIN(row.net_weight, {
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-2.5 py-1 text-right tabular-nums text-zinc-600">
                            {formatCurrencyINR(row.rate)}
                          </td>
                          <td className="px-2.5 py-1 text-right tabular-nums font-semibold text-zinc-900">
                            {formatCurrencyINR(row.final_total, {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                          <td className="px-2.5 py-1 whitespace-nowrap text-zinc-600 uppercase">
                            {row.payment_through}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold">
                      <td className="px-2.5 py-1.5" colSpan={5}>
                        Total
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">
                        {formatCurrencyINR(totalAmount, {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-2.5 py-1.5" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-5">
              <SectionHeading icon={Banknote}>Payments Made</SectionHeading>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 print:overflow-visible">
                <table className="w-full table-fixed border-collapse text-[12px] print:min-w-0">
                  <thead>
                    <tr className="bg-zinc-900 text-white">
                      <th
                        style={{ width: "14%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        Date
                      </th>
                      <th
                        style={{ width: "14%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        Mode
                      </th>
                      <th
                        style={{ width: "20%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        RTGS Name
                      </th>
                      <th
                        style={{ width: "32%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        Note
                      </th>
                      <th
                        style={{ width: "20%" }}
                        className="px-2.5 py-1.5 text-right font-medium"
                      >
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedPayments.length === 0 ? (
                      <tr>
                        <td className="px-2.5 py-3 text-zinc-400" colSpan={5}>
                          No payments recorded.
                        </td>
                      </tr>
                    ) : (
                      sortedPayments.map((payment, index) => (
                        <tr
                          key={payment.id}
                          className={`break-inside-avoid ${index % 2 === 1 ? "bg-zinc-50/60" : ""}`}
                        >
                          <td className="px-2.5 py-1 whitespace-nowrap text-zinc-600">
                            {formatDisplayDate(payment.paid_on)}
                          </td>
                          <td className="px-2.5 py-1 text-zinc-600">
                            {paymentModeLabel(payment)}
                          </td>
                          <td className="px-2.5 py-1 text-zinc-600">
                            {payment.rtgs_name || "-"}
                          </td>
                          <td className="px-2.5 py-1 text-zinc-600">
                            {payment.note || "-"}
                          </td>
                          <td className="px-2.5 py-1 text-right tabular-nums font-medium text-emerald-700">
                            {formatCurrencyINR(payment.amount, {
                              maximumFractionDigits: 0,
                            })}
                          </td>
                        </tr>
                      ))
                    )}
                    <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold">
                      <td className="px-2.5 py-1.5" colSpan={4}>
                        Total Paid
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-emerald-700">
                        {formatCurrencyINR(totalPaid, {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-5 break-inside-avoid">
              <SectionHeading icon={Wallet}>Reconciliation</SectionHeading>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-400">
                    Total Purchases
                  </div>
                  <div className="text-sm font-bold tabular-nums text-zinc-900">
                    {formatCurrencyINR(totalAmount, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <span className="text-lg font-semibold text-zinc-400">−</span>
                <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-emerald-600">
                    Total Paid
                  </div>
                  <div className="text-sm font-bold tabular-nums text-emerald-700">
                    {formatCurrencyINR(totalPaid, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <span className="text-lg font-semibold text-zinc-400">=</span>
                <div className="flex-1 rounded-lg border border-[#ff6a3d]/30 bg-[#fff4ef] px-3 py-1.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-[#c2410c]">
                    Balance Payable
                  </div>
                  <div className="text-sm font-bold tabular-nums text-[#c2410c]">
                    {formatCurrencyINR(balancePayable, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-6 flex justify-end break-inside-avoid">
              <div className="w-40 text-center text-xs text-zinc-600">
                <div className="mb-6 font-medium">For MB GROUPS</div>
                <div className="border-t border-zinc-300 pt-1">
                  Authorised Signatory
                </div>
              </div>
            </div>

            <footer className="mt-5 border-t border-zinc-200 pt-3 text-[10px] text-zinc-400">
              This is a system-generated statement. Please contact us for any
              discrepancy.
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}
