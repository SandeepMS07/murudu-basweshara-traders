"use client";

import { format, parseISO } from "date-fns";

import {
  SoyaLedgerManager,
  type SoyaLedgerColumn,
  type SoyaLedgerCounterparty,
  type SoyaLedgerPayment,
} from "@/features/soya/components/SoyaLedgerManager";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import type { SoyaPartyEntry } from "@/features/soya-parties/schemas";
import {
  createSoyaPartyAction,
  createSoyaPartyPaymentAction,
  deleteSoyaPartyAction,
  deleteSoyaPartyPaymentAction,
  updateSoyaPartyAction,
} from "@/app/soya/parties/actions";

/**
 * Client wrapper that supplies the Parties column spec to the shared ledger.
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

// Workbook headers verbatim (PARTIES half of the SALES sheet).
const columns: SoyaLedgerColumn<SoyaPartyEntry>[] = [
  { label: "SL NO", value: (row) => String(row.sl_no ?? "-") },
  { label: "DATE", value: (row) => date(row.date) },
  { label: "BILL NO", value: (row) => row.bill_no || "-" },
  { label: "LORRY NO", value: (row) => row.lorry_no || "-" },
  { label: "BAGS", value: (row) => num(row.bags), align: "right" },
  { label: "NET WT", value: (row) => num(row.net_wt), align: "right" },
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
  { label: "2.5%CGST", value: (row) => money(row.cgst), align: "right" },
  { label: "2.5%SGST", value: (row) => money(row.sgst), align: "right" },
  { label: "TCS", value: (row) => money(row.tcs), align: "right" },
  {
    label: "AMOUNT",
    value: (row) => money(row.total_amount),
    align: "right",
  },
  { label: "FREIGHT", value: (row) => num(row.freight), align: "right" },
  { label: "FRIGHT", value: (row) => money(row.fright), align: "right" },
  { label: "FACTORY", value: (row) => row.factory || "-" },
];

export function SoyaPartyLedger({
  parties,
  entries,
  payments,
}: {
  parties: SoyaLedgerCounterparty[];
  entries: SoyaPartyEntry[];
  payments: SoyaLedgerPayment[];
}) {
  return (
    <SoyaLedgerManager
      counterpartyLabel="Party"
      counterparties={parties}
      entries={entries}
      entryOwnerName={(entry) => entry.party}
      entryTotal={(entry) => entry.total_amount}
      entryColumns={columns}
      payments={payments}
      showRemarks
      billedLabel="Total Sales"
      balanceLabel="Balance Receivable"
      statementHrefBase="/soya/parties/companies"
      exportFilePrefix="soya-party"
      createAction={createSoyaPartyAction}
      updateAction={updateSoyaPartyAction}
      deleteAction={deleteSoyaPartyAction}
      createPaymentAction={createSoyaPartyPaymentAction}
      deletePaymentAction={deleteSoyaPartyPaymentAction}
    />
  );
}
