"use client";

import { format, parseISO } from "date-fns";

import {
  SoyaLedgerManager,
  type SoyaLedgerColumn,
  type SoyaLedgerCounterparty,
  type SoyaLedgerPayment,
} from "@/features/soya/components/SoyaLedgerManager";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import type { SoyaFactoryEntry } from "@/features/soya-factory/schemas";
import {
  createSoyaFactoryAction,
  createSoyaFactoryPaymentAction,
  deleteSoyaFactoryAction,
  deleteSoyaFactoryPaymentAction,
  updateSoyaFactoryAction,
} from "@/app/soya/factory/actions";

/**
 * Client wrapper that supplies the Factory column spec to the shared ledger.
 * The spec is made of functions, which cannot be passed from a server
 * component, so it is defined here rather than on the page.
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

// Workbook headers verbatim (FACTORY half of the SALES sheet).
const columns: SoyaLedgerColumn<SoyaFactoryEntry>[] = [
  { label: "SL NO", value: (row) => String(row.sl_no ?? "-") },
  { label: "DATE", value: (row) => date(row.date) },
  { label: "P B NO", value: (row) => row.pb_no || "-" },
  { label: "LORRY", value: (row) => row.lorry || "-" },
  { label: "BAGS", value: (row) => num(row.bags), align: "right" },
  { label: "WEIGHT", value: (row) => num(row.weight), align: "right" },
  {
    label: "RATE",
    value: (row) =>
      formatNumberIN(row.rate, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
      }),
    align: "right",
  },
  { label: "AMOUNT", value: (row) => money(row.amount), align: "right" },
  { label: "GST 5 %", value: (row) => money(row.gst_amount), align: "right" },
  { label: "TCS", value: (row) => money(row.tcs), align: "right" },
  {
    label: "AMOUNT",
    value: (row) => money(row.total_amount),
    align: "right",
  },
  { label: "PARTY", value: (row) => row.party || "-" },
];

export function SoyaFactoryLedger({
  factories,
  entries,
  payments,
}: {
  factories: SoyaLedgerCounterparty[];
  entries: SoyaFactoryEntry[];
  payments: SoyaLedgerPayment[];
}) {
  return (
    <SoyaLedgerManager
      counterpartyLabel="Factory"
      counterparties={factories}
      entries={entries}
      entryOwnerName={(entry) => entry.factory}
      entryTotal={(entry) => entry.total_amount}
      entryColumns={columns}
      payments={payments}
      billedLabel="Total Purchases"
      balanceLabel="Balance Payable"
      statementHrefBase="/soya/factory/parties"
      exportFilePrefix="soya-factory"
      createAction={createSoyaFactoryAction}
      updateAction={updateSoyaFactoryAction}
      deleteAction={deleteSoyaFactoryAction}
      createPaymentAction={createSoyaFactoryPaymentAction}
      deletePaymentAction={deleteSoyaFactoryPaymentAction}
    />
  );
}
