"use client";

import { format, parseISO } from "date-fns";

import {
  SoyaStatementView,
  type SoyaStatementColumn,
  type SoyaStatementPayment,
} from "@/features/soya/components/SoyaStatementView";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import type { SoyaFactoryEntry } from "@/features/soya-factory/schemas";

/**
 * Client wrapper supplying the Factory column spec to the shared statement.
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

const columns: SoyaStatementColumn<SoyaFactoryEntry>[] = [
  { label: "SL NO", value: (row) => String(row.sl_no ?? "-"), width: "6%" },
  { label: "DATE", value: (row) => date(row.date), width: "10%" },
  { label: "P B NO", value: (row) => row.pb_no || "-", width: "9%" },
  { label: "LORRY", value: (row) => row.lorry || "-", width: "14%" },
  { label: "BAGS", value: (row) => num(row.bags), align: "right", width: "7%" },
  {
    label: "WEIGHT",
    value: (row) => num(row.weight),
    align: "right",
    width: "9%",
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
    width: "11%",
  },
  {
    label: "GST 5 %",
    value: (row) => money(row.gst_amount),
    align: "right",
    width: "9%",
  },
  { label: "TCS", value: (row) => money(row.tcs), align: "right", width: "6%" },
  {
    label: "AMOUNT",
    value: (row) => money(row.total_amount),
    align: "right",
    width: "12%",
  },
];

export function SoyaFactoryStatement({
  factoryName,
  entries,
  payments,
  hideBackLink,
}: {
  factoryName: string;
  entries: SoyaFactoryEntry[];
  payments: SoyaStatementPayment[];
  hideBackLink?: boolean;
}) {
  const totalBilled = entries.reduce((sum, entry) => sum + entry.total_amount, 0);

  return (
    <SoyaStatementView
      counterpartyName={factoryName}
      counterpartyLabel="Factory"
      entries={entries}
      columns={columns}
      totalBilled={totalBilled}
      payments={payments}
      billedLabel="Total Purchases"
      balanceLabel="Balance Payable"
      backHref="/soya/factory/parties"
      hideBackLink={hideBackLink}
    />
  );
}
