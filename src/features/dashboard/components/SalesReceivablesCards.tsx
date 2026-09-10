"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyINR } from "@/lib/number-format";

type CompanyRow = {
  company: string;
  pending: number;
  overdue: number;
  pendingBillCount: number;
  overdueBillCount: number;
};

type SalesReceivablesCardsProps = {
  rows: CompanyRow[];
  totalPending: number;
  totalOverdue: number;
};

type ActiveView = "pending" | "overdue" | null;

export function SalesReceivablesCards({
  rows,
  totalPending,
  totalOverdue,
}: SalesReceivablesCardsProps) {
  const [activeView, setActiveView] = useState<ActiveView>(null);

  const metricKey = activeView === "overdue" ? "overdue" : "pending";
  const billCountKey =
    activeView === "overdue" ? "overdueBillCount" : "pendingBillCount";
  const dialogRows = rows
    .filter((row) => row[metricKey] > 0)
    .sort((a, b) => b[metricKey] - a[metricKey]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setActiveView("pending")}
          className="text-left"
        >
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100 transition-colors hover:border-[#ff6a3d]/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Pending Amount (Sales)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatCurrencyINR(totalPending, { maximumFractionDigits: 0 })}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Amount yet to be received across all companies. Click for a
                company-wise breakdown.
              </p>
            </CardContent>
          </Card>
        </button>

        <button
          type="button"
          onClick={() => setActiveView("overdue")}
          className="text-left"
        >
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100 transition-colors hover:border-[#ff6a3d]/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Overdue Amount (Sales)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatCurrencyINR(totalOverdue, { maximumFractionDigits: 0 })}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                Pending amount already past its due date. Click for a
                company-wise breakdown.
              </p>
            </CardContent>
          </Card>
        </button>
      </div>

      <Dialog
        open={activeView !== null}
        onOpenChange={(open) => {
          if (!open) {
            setActiveView(null);
          }
        }}
      >
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {activeView === "overdue" ? "Overdue Amount" : "Pending Amount"}{" "}
              by Company
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {activeView === "overdue"
                ? "Companies with pending amounts past their due date."
                : "All companies with pending sales amounts."}
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-112 overflow-y-auto">
            <div className="grid grid-cols-[1fr_110px_170px] gap-4 rounded-md border border-[#2a2d34] bg-[#101218] px-4 py-3 text-xs uppercase tracking-[0.14em] text-zinc-500">
              <span>Company</span>
              <span className="text-right">Bills</span>
              <span className="text-right">
                {activeView === "overdue" ? "Overdue" : "Pending"}
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {dialogRows.length === 0 ? (
                <div className="rounded-md border border-[#2a2d34] bg-[#101218] p-4 text-sm text-zinc-400">
                  No companies with {activeView === "overdue" ? "overdue" : "pending"}{" "}
                  amounts.
                </div>
              ) : (
                dialogRows.map((row) => (
                  <div
                    key={row.company}
                    className="grid grid-cols-[1fr_110px_170px] gap-4 rounded-md border border-[#2a2d34] bg-[#101218] px-4 py-3 text-sm"
                  >
                    <span className="truncate text-zinc-200" title={row.company}>
                      {row.company}
                    </span>
                    <span className="text-right text-zinc-400">
                      {row[billCountKey]}
                    </span>
                    <span className="text-right font-semibold text-[#ff8f6b]">
                      {formatCurrencyINR(row[metricKey], {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
