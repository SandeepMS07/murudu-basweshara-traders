"use client";

import { format, parseISO } from "date-fns";

import {
  SoyaStatementView,
  type SoyaStatementColumn,
  type SoyaStatementPayment,
} from "@/features/soya/components/SoyaStatementView";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import type { SoyaPartyEntry } from "@/features/soya-parties/schemas";

/**
 * Client wrapper supplying the Parties column spec to the shared statement.
 * The spec is made of functions, which cannot cross the server boundary.
 * Widths sum to 100.
 */
const whole = { minimumFractionDigits: 0, maximumFractionDigits: 0 } as const;
const num = (value: number) => formatNumberIN(value, whole);
const money = (value: number) => formatCurrencyINR(value, whole);

function date(value: string) {
  try {
    return format(parseISO(value), "dd-MM-yyyy");
  } catch {
    return value;
  }
}

const columns: SoyaStatementColumn<SoyaPartyEntry>[] = [
  { label: "SL NO", value: (row) => String(row.sl_no ?? "-"), width: "5%" },
  { label: "DATE", value: (row) => date(row.date), width: "9%" },
  { label: "BILL NO", value: (row) => row.bill_no || "-", width: "7%" },
  { label: "LORRY NO", value: (row) => row.lorry_no || "-", width: "13%" },
  { label: "BAGS", value: (row) => num(row.bags), align: "right", width: "6%" },
  {
    label: "NET WT",
    value: (row) => num(row.net_wt),
    align: "right",
    width: "8%",
  },
  {
    label: "RATE",
    value: (row) =>
      formatNumberIN(row.rate, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }),
    align: "right",
    width: "7%",
  },
  {
    label: "AMOUNT",
    value: (row) => money(row.amount),
    align: "right",
    width: "10%",
  },
  {
    label: "2.5%CGST",
    value: (row) => money(row.cgst),
    align: "right",
    width: "8%",
  },
  {
    label: "2.5%SGST",
    value: (row) => money(row.sgst),
    align: "right",
    width: "8%",
  },
  { label: "TCS", value: (row) => money(row.tcs), align: "right", width: "5%" },
  {
    label: "AMOUNT",
    value: (row) => money(row.total_amount),
    align: "right",
    width: "10%",
  },
  { label: "FACTORY", value: (row) => row.factory || "-", width: "4%" },
];

export function SoyaPartyStatement({
  partyName,
  entries,
  payments,
  hideBackLink,
}: {
  partyName: string;
  entries: SoyaPartyEntry[];
  payments: SoyaStatementPayment[];
  hideBackLink?: boolean;
}) {
  const totalBilled = entries.reduce((sum, entry) => sum + entry.total_amount, 0);

  return (
    <SoyaStatementView
      counterpartyName={partyName}
      counterpartyLabel="Party"
      entries={entries}
      columns={columns}
      totalBilled={totalBilled}
      payments={payments}
      showRemarks
      billedLabel="Total Sales"
      balanceLabel="Balance Receivable"
      backHref="/soya/parties/companies"
      hideBackLink={hideBackLink}
    />
  );
}
