"use client";

import { useMemo, type ComponentType, type ReactNode } from "react";
import { addDays, format, isValid, parseISO } from "date-fns";
import {
  AlertTriangle,
  Banknote,
  Calculator,
  Landmark,
  Printer,
  Receipt,
  User,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Company, CompanyPayment } from "@/features/companies/schemas";
import { Sale } from "@/features/sales/schemas";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";

const parseTermDays = (terms: string | null | undefined) => {
  const parsed = Number.parseInt(String(terms ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const formatBillNumber = (billNumber: string) => {
  const trimmed = billNumber.trim();
  return /^\d+$/.test(trimmed) ? String(Number(trimmed)) : trimmed;
};

const formatDisplayDate = (value: string) => {
  try {
    return format(parseISO(value), "dd-MM-yyyy");
  } catch {
    return value;
  }
};

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

const shortLabel = (company: Company | undefined) => {
  if (!company) return "-";
  const code = company.code?.trim();
  if (code) return code.toUpperCase();
  const name = company.display_name || company.name;
  return initials(name) || name;
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

const paymentReference = (payment: CompanyPayment) => {
  const mode =
    payment.payment_mode === "rtgs"
      ? payment.rtgs_name
        ? `RTGS (${payment.rtgs_name})`
        : "RTGS"
      : payment.payment_mode === "cash"
        ? "Cash"
        : null;
  const parts = [mode, payment.note?.trim() || null].filter(Boolean);
  return parts.length > 0 ? parts.join(" • ") : "-";
};

type BillStatusTone = "overdue" | "due-today" | "upcoming" | "paid" | "unknown";

type BillStatus = {
  label: string;
  tone: BillStatusTone;
};

const statusStyles: Record<BillStatusTone, string> = {
  overdue: "bg-red-100 text-red-700",
  "due-today": "bg-amber-100 text-amber-700",
  upcoming: "bg-zinc-100 text-zinc-600",
  paid: "bg-emerald-100 text-emerald-700",
  unknown: "bg-zinc-100 text-zinc-500",
};

const balanceStyles: Record<BillStatusTone, string> = {
  overdue: "text-red-600",
  "due-today": "text-amber-700",
  upcoming: "text-amber-700",
  paid: "text-zinc-400",
  unknown: "text-zinc-600",
};

type IssuerSummary = {
  issuerId: string;
  issuerName: string;
  issuerShort: string;
  billCount: number;
  pendingBillCount: number;
  pending: number;
};

interface CompanyStatementViewProps {
  companyName: string;
  companyAddress?: string;
  companyPhone?: string;
  companyGstin?: string;
  sales: Sale[];
  payments: CompanyPayment[];
  pendingBySaleId: Record<string, number>;
  saleIdsByPaymentId: Record<string, string[]>;
  companies: Company[];
  hideBackLink?: boolean;
}

export function CompanyStatementView({
  companyName,
  companyAddress,
  companyPhone,
  companyGstin,
  sales,
  payments,
  pendingBySaleId,
  saleIdsByPaymentId,
  companies,
  hideBackLink,
}: CompanyStatementViewProps) {
  const companyById = useMemo(
    () => new Map(companies.map((c) => [c.id, c])),
    [companies],
  );
  const companyNameById = useMemo(
    () => new Map(companies.map((c) => [c.id, c.display_name || c.name])),
    [companies],
  );
  const saleById = useMemo(
    () => new Map(sales.map((sale) => [sale.id, sale])),
    [sales],
  );

  const today = new Date();
  const todayStart = startOfDay(today);

  const getDueDate = (sale: Sale) => {
    const saleDate = parseISO(sale.sale_date);
    if (!isValid(saleDate)) return null;
    return addDays(saleDate, parseTermDays(sale.payment_terms));
  };

  const getBillStatus = (sale: Sale, pending: number): BillStatus => {
    if (pending <= 0) return { label: "Paid", tone: "paid" };
    const dueDate = getDueDate(sale);
    if (!dueDate) return { label: "Pending", tone: "unknown" };
    const diffDays = Math.round(
      (todayStart.getTime() - startOfDay(dueDate).getTime()) / 86_400_000,
    );
    if (diffDays > 0) return { label: `${diffDays}d overdue`, tone: "overdue" };
    if (diffDays === 0) return { label: "Due today", tone: "due-today" };
    return { label: `Due in ${-diffDays}d`, tone: "upcoming" };
  };

  const sortedSales = useMemo(
    () =>
      [...sales].sort(
        (a, b) =>
          a.sale_date.localeCompare(b.sale_date) ||
          a.bill_number.localeCompare(b.bill_number),
      ),
    [sales],
  );

  const totalAmount = sales.reduce((sum, sale) => sum + sale.amount, 0);
  const totalPending = sales.reduce(
    (sum, sale) => sum + (pendingBySaleId[sale.id] ?? sale.pending_amount),
    0,
  );
  const pendingBillCount = sales.filter(
    (sale) => (pendingBySaleId[sale.id] ?? sale.pending_amount) > 0,
  ).length;
  const totalReceivedAmount = payments.reduce(
    (sum, payment) => sum + payment.amount,
    0,
  );

  const { totalOverdue, overdueBillCount } = useMemo(() => {
    let amount = 0;
    let count = 0;
    for (const sale of sales) {
      const pending = pendingBySaleId[sale.id] ?? sale.pending_amount;
      if (pending <= 0) continue;
      if (getBillStatus(sale, pending).tone === "overdue") {
        amount += pending;
        count += 1;
      }
    }
    return { totalOverdue: amount, overdueBillCount: count };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, pendingBySaleId]);

  const issuerSummaries = useMemo(() => {
    const map = new Map<string, IssuerSummary>();
    for (const sale of sales) {
      const issuerId = sale.issuer_company_id ?? "unknown";
      const issuerCompany = sale.issuer_company_id
        ? companyById.get(sale.issuer_company_id)
        : undefined;
      const issuerName = issuerCompany
        ? issuerCompany.display_name || issuerCompany.name
        : "Unknown";
      const pending = pendingBySaleId[sale.id] ?? sale.pending_amount;
      const current = map.get(issuerId) ?? {
        issuerId,
        issuerName,
        issuerShort: shortLabel(issuerCompany),
        billCount: 0,
        pendingBillCount: 0,
        pending: 0,
      };
      current.billCount += 1;
      if (pending > 0) {
        current.pendingBillCount += 1;
        current.pending += pending;
      }
      map.set(issuerId, current);
    }
    return [...map.values()].sort((a, b) => b.pending - a.pending);
  }, [sales, pendingBySaleId, companyById]);

  const paymentInstructions = useMemo(
    () =>
      issuerSummaries
        .filter((row) => row.pendingBillCount > 0)
        .map((row) => ({
          ...row,
          bankCompany: companyById.get(row.issuerId),
        }))
        .filter(
          (row) =>
            row.bankCompany?.bank_name?.trim() ||
            row.bankCompany?.bank_account_no?.trim() ||
            row.bankCompany?.bank_branch_ifsc?.trim(),
        ),
    [issuerSummaries, companyById],
  );

  const sortedPayments = useMemo(
    () => [...payments].sort((a, b) => a.paid_on.localeCompare(b.paid_on)),
    [payments],
  );

  const paymentIssuerLabel = (payment: CompanyPayment) => {
    const saleIds = saleIdsByPaymentId[payment.id] ?? [];
    const issuerIds = new Set<string>();
    for (const saleId of saleIds) {
      const sale = saleById.get(saleId);
      if (sale?.issuer_company_id) issuerIds.add(sale.issuer_company_id);
    }
    if (issuerIds.size === 0) return "-";
    return [...issuerIds]
      .map((id) => shortLabel(companyById.get(id)))
      .join(", ");
  };

  const paymentBillNumbers = (payment: CompanyPayment) => {
    const saleIds = saleIdsByPaymentId[payment.id] ?? [];
    const billNumbers = saleIds
      .map((saleId) => saleById.get(saleId)?.bill_number)
      .filter((billNumber): billNumber is string => Boolean(billNumber))
      .map(formatBillNumber)
      .sort();
    return billNumbers.length > 0 ? billNumbers.join(", ") : "-";
  };

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
              href="/companies"
              className="text-sm text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline"
            >
              ← Back to Companies
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
                <SectionHeading icon={User}>Customer Details</SectionHeading>
                <dl className="space-y-1.5 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-zinc-400">Customer</dt>
                    <dd className="font-semibold text-zinc-900">
                      {companyName}
                    </dd>
                  </div>
                  {companyAddress ? (
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-zinc-400">Address</dt>
                      <dd className="text-zinc-700">{companyAddress}</dd>
                    </div>
                  ) : null}
                  {companyPhone ? (
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-zinc-400">Phone</dt>
                      <dd className="text-zinc-700">{companyPhone}</dd>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-zinc-400">GSTIN</dt>
                    <dd className="text-zinc-700">{companyGstin || "-"}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <SectionHeading icon={Wallet}>Balance Summary</SectionHeading>
                <div className="grid grid-cols-2 gap-2">
                  {issuerSummaries.map((row) => (
                    <div
                      key={row.issuerId}
                      className="flex items-start gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-2"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                        <Receipt className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div
                          className="truncate text-[10px] font-semibold text-zinc-600"
                          title={row.issuerName}
                        >
                          {row.issuerShort}
                        </div>
                        <div className="text-sm font-bold tabular-nums text-zinc-900">
                          {formatCurrencyINR(row.pending, {
                            maximumFractionDigits: 0,
                          })}
                        </div>
                        <div className="text-[9px] text-zinc-400">
                          {row.pendingBillCount}{" "}
                          {row.pendingBillCount === 1 ? "bill" : "bills"}{" "}
                          pending
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-2 rounded-md border border-[#ff6a3d]/30 bg-[#fff4ef] px-2.5 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#ff6a3d] text-white">
                      <Wallet className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-[#c2410c]">
                        Balance Due
                      </div>
                      <div className="text-sm font-bold tabular-nums text-[#c2410c]">
                        {formatCurrencyINR(totalPending, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      <div className="text-[9px] text-[#c2410c]/70">
                        {pendingBillCount}{" "}
                        {pendingBillCount === 1 ? "bill" : "bills"} pending
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-white">
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-[10px] font-semibold text-red-700">
                        Total Overdue
                      </div>
                      <div className="text-sm font-bold tabular-nums text-red-700">
                        {formatCurrencyINR(totalOverdue, {
                          maximumFractionDigits: 0,
                        })}
                      </div>
                      <div className="text-[9px] text-red-700/70">
                        {overdueBillCount}{" "}
                        {overdueBillCount === 1 ? "bill" : "bills"} overdue
                      </div>
                    </div>
                  </div>
                </div>
                {issuerSummaries.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-zinc-500">
                    {issuerSummaries.map((row) => (
                      <span key={row.issuerId}>
                        <span className="font-semibold text-zinc-700">
                          {row.issuerShort}
                        </span>{" "}
                        = {row.issuerName}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            {totalPending > 0 ? (
              <div className="mt-2 text-[11px] text-zinc-500">
                <span className="font-medium text-zinc-700">
                  Amount in words:
                </span>{" "}
                Rupees {numberToWordsIN(totalPending)} Only
              </div>
            ) : null}

            <section className="mt-5">
              <SectionHeading icon={Receipt}>Bills</SectionHeading>
              <div className="overflow-x-auto rounded-lg border border-zinc-200 print:overflow-visible">
                <table className="w-full min-w-180 table-fixed border-collapse text-[12px] print:min-w-0">
                  <thead>
                    <tr className="bg-zinc-900 text-white">
                      <th
                        style={{ width: "7%" }}
                        className="px-2.5 py-1.5 text-left font-medium whitespace-nowrap"
                      >
                        Bill No
                      </th>
                      <th
                        style={{ width: "6%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        Issuer
                      </th>
                      <th
                        style={{ width: "13%" }}
                        className="px-2.5 py-1.5 text-left font-medium whitespace-nowrap"
                      >
                        Date
                      </th>
                      <th
                        style={{ width: "15%" }}
                        className="px-2.5 py-1.5 text-left font-medium whitespace-nowrap"
                      >
                        Vehicle
                      </th>
                      <th
                        style={{ width: "12%" }}
                        className="px-2.5 py-1.5 text-right font-medium whitespace-nowrap"
                      >
                        Net Wt
                      </th>
                      <th
                        style={{ width: "8%" }}
                        className="px-2.5 py-1.5 text-right font-medium"
                      >
                        Rate
                      </th>
                      <th
                        style={{ width: "13%" }}
                        className="px-2.5 py-1.5 text-right font-medium"
                      >
                        Amount
                      </th>
                      <th
                        style={{ width: "13%" }}
                        className="px-2.5 py-1.5 text-right font-medium"
                      >
                        Balance
                      </th>
                      <th
                        style={{ width: "13%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {sortedSales.length === 0 ? (
                      <tr>
                        <td className="px-2.5 py-3 text-zinc-400" colSpan={9}>
                          No bills found.
                        </td>
                      </tr>
                    ) : (
                      sortedSales.map((sale, index) => {
                        const pending =
                          pendingBySaleId[sale.id] ?? sale.pending_amount;
                        const status = getBillStatus(sale, pending);
                        const issuerCompany = sale.issuer_company_id
                          ? companyById.get(sale.issuer_company_id)
                          : undefined;
                        return (
                          <tr
                            key={sale.id}
                            className={`break-inside-avoid ${index % 2 === 1 ? "bg-zinc-50/60" : ""}`}
                          >
                            <td className="px-2.5 py-1 font-medium">
                              {formatBillNumber(sale.bill_number)}
                            </td>
                            <td
                              className="px-2.5 py-1 text-zinc-600"
                              title={
                                sale.issuer_company_id
                                  ? (companyNameById.get(
                                      sale.issuer_company_id,
                                    ) ?? undefined)
                                  : undefined
                              }
                            >
                              {issuerCompany ? shortLabel(issuerCompany) : "-"}
                            </td>
                            <td className="px-2.5 py-1 whitespace-nowrap text-zinc-600">
                              {formatDisplayDate(sale.sale_date)}
                            </td>
                            <td className="px-2.5 py-1 whitespace-nowrap text-zinc-600">
                              {sale.lorry_number || "-"}
                            </td>
                            <td className="px-2.5 py-1 text-right tabular-nums whitespace-nowrap text-zinc-600">
                              {formatNumberIN(sale.net_weight, {
                                maximumFractionDigits: 2,
                              })}
                            </td>
                            <td className="px-2.5 py-1 text-right tabular-nums text-zinc-600">
                              {formatCurrencyINR(sale.rate)}
                            </td>
                            <td className="px-2.5 py-1 text-right tabular-nums text-zinc-600">
                              {formatCurrencyINR(sale.amount, {
                                maximumFractionDigits: 0,
                              })}
                            </td>
                            <td
                              className={`px-2.5 py-1 text-right tabular-nums font-semibold ${balanceStyles[status.tone]}`}
                            >
                              {formatCurrencyINR(pending, {
                                maximumFractionDigits: 0,
                              })}
                            </td>
                            <td className="px-2.5 py-1">
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${statusStyles[status.tone]}`}
                              >
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold">
                      <td className="px-2.5 py-2" colSpan={6}>
                        Total
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">
                        {formatCurrencyINR(totalAmount, {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-red-600">
                        {formatCurrencyINR(totalPending, {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="px-2.5 py-2" />
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-5">
              <SectionHeading icon={Banknote}>Payments Received</SectionHeading>
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
                        style={{ width: "12%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        Issuer
                      </th>
                      <th
                        style={{ width: "12%" }}
                        className="px-2.5 py-1.5 text-left font-medium whitespace-nowrap"
                      >
                        Bill No
                      </th>
                      <th
                        style={{ width: "40%" }}
                        className="px-2.5 py-1.5 text-left font-medium"
                      >
                        Reference
                      </th>
                      <th
                        style={{ width: "22%" }}
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
                            {paymentIssuerLabel(payment)}
                          </td>
                          <td className="px-2.5 py-1 text-zinc-600">
                            {paymentBillNumbers(payment)}
                          </td>
                          <td className="px-2.5 py-1 text-zinc-600">
                            {paymentReference(payment)}
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
                      <td className="px-2.5 py-2" colSpan={4}>
                        Total Received
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-emerald-700">
                        {formatCurrencyINR(totalReceivedAmount, {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {paymentInstructions.length > 0 ? (
              <section className="mt-5 break-inside-avoid">
                <SectionHeading icon={Landmark}>
                  Payment Instructions
                </SectionHeading>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {paymentInstructions.map((row) => (
                    <div
                      key={row.issuerId}
                      className="flex items-start gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-white">
                        <Landmark className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-zinc-700">
                          {row.issuerShort} — {row.issuerName}
                        </div>
                        <div className="mt-1 space-y-0.5 text-zinc-600">
                          {row.bankCompany?.bank_name?.trim() ? (
                            <div>
                              <span className="text-zinc-400">Bank:</span>{" "}
                              {row.bankCompany.bank_name}
                            </div>
                          ) : null}
                          {row.bankCompany?.bank_account_no?.trim() ? (
                            <div>
                              <span className="text-zinc-400">A/c No:</span>{" "}
                              <span className="font-mono">
                                {row.bankCompany.bank_account_no}
                              </span>
                            </div>
                          ) : null}
                          {row.bankCompany?.bank_branch_ifsc?.trim() ? (
                            <div>
                              <span className="text-zinc-400">
                                Branch &amp; IFSC:
                              </span>{" "}
                              <span className="font-mono">
                                {row.bankCompany.bank_branch_ifsc}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-5 break-inside-avoid">
              <SectionHeading icon={Calculator}>Reconciliation</SectionHeading>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-400">
                    Total Bills
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
                    Payments Received
                  </div>
                  <div className="text-sm font-bold tabular-nums text-emerald-700">
                    {formatCurrencyINR(totalReceivedAmount, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <span className="text-lg font-semibold text-zinc-400">=</span>
                <div className="flex-1 rounded-lg border border-[#ff6a3d]/30 bg-[#fff4ef] px-3 py-1.5 text-center">
                  <div className="text-[10px] uppercase tracking-wide text-[#c2410c]">
                    Total Balance Due
                  </div>
                  <div className="text-sm font-bold tabular-nums text-[#c2410c]">
                    {formatCurrencyINR(totalPending, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
              </div>
            </section>

            <div className="mt-5 flex justify-end break-inside-avoid">
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
