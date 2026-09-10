import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, isValid, parseISO } from "date-fns";
import { requireAuth } from "@/features/auth/lib/session";
import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { getSales } from "@/features/sales/service/sale.service";
import { getBiltys } from "@/features/bilty/service/bilty.service";
import {
  getCompanies,
  getCompanyPaymentAllocations,
  getCompanyPayments,
} from "@/features/companies/service/company.service";
import { computeEffectiveSalePending } from "@/features/companies/lib/payment-allocation";
import { SalesReceivablesCards } from "@/features/dashboard/components/SalesReceivablesCards";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { getFinancialYearBounds } from "@/lib/financial-year";

export default async function DashboardPage() {
  const user = await requireAuth();
  const [purchases, sales, biltys, buyerCompanies] = await Promise.all([
    getPurchases(),
    getSales(),
    getBiltys(),
    getCompanies("buyer"),
  ]);
  const [companyPaymentsResult, allocationsResult] = await Promise.allSettled([
    getCompanyPayments(),
    getCompanyPaymentAllocations(),
  ]);
  const companyPayments =
    companyPaymentsResult.status === "fulfilled" ? companyPaymentsResult.value : [];
  const allocations =
    allocationsResult.status === "fulfilled" ? allocationsResult.value : [];
  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const { start: fyStart, end: fyEnd } = getFinancialYearBounds(nowIst);
  const scopedPurchases = purchases.filter(
    (p) => p.date >= fyStart && p.date <= fyEnd,
  );
  const scopedSales = sales.filter(
    (s) => s.sale_date >= fyStart && s.sale_date <= fyEnd,
  );
  const scopedBiltys = biltys.filter(
    (b) => b.date >= fyStart && b.date <= fyEnd,
  );

  // Payments are allocated FIFO across a company's entire sale history (see
  // computeEffectiveSalePending), so this must run over ALL sales, not just
  // the FY-scoped subset — otherwise payments meant for older sales spill
  // onto this year's sales and understate what's actually still pending.
  const pendingBySaleId =
    companyPayments.length > 0 || allocations.length > 0
      ? computeEffectiveSalePending(sales, companyPayments, allocations)
          .pendingBySaleId
      : {};
  const effectivePending = (sale: (typeof scopedSales)[number]) =>
    pendingBySaleId[sale.id] ?? sale.pending_amount ?? 0;

  const purchaseAmountFromPurchases = scopedPurchases.reduce(
    (acc, p) => acc + (p.final_total || 0),
    0,
  );
  const purchaseAmountFromBilty = scopedBiltys.reduce(
    (acc, b) => acc + (b.final_total || 0),
    0,
  );
  const totalPurchasesAmount =
    purchaseAmountFromPurchases + purchaseAmountFromBilty;
  const totalSalesAmount = scopedSales.reduce(
    (acc, s) => acc + (s.amount || 0),
    0,
  );
  const totalSalesPending = scopedSales.reduce(
    (acc, s) => acc + effectivePending(s),
    0,
  );
  const purchasedBagsFromPurchases = scopedPurchases.reduce(
    (acc, p) => acc + Number(p.bags || 0),
    0,
  );
  const purchasedBagsFromBilty = scopedBiltys.reduce(
    (acc, b) => acc + Number(b.bags || 0),
    0,
  );
  const totalPurchasedBags =
    purchasedBagsFromPurchases + purchasedBagsFromBilty;
  const totalSoldBags = scopedSales.reduce(
    (acc, s) => acc + Number(s.bags || 0),
    0,
  );
  const openingStockRowsFromFy2025 = purchases.filter(
    (p) =>
      p.date >= "2025-04-01" &&
      p.date <= "2026-03-31" &&
      [1, 2].includes(Number(p.bill_no)),
  );
  const openingStockBagsFromFy2025 = openingStockRowsFromFy2025.reduce(
    (acc, p) => acc + Number(p.bags || 0),
    0,
  );
  const stockBags =
    totalPurchasedBags - totalSoldBags + openingStockBagsFromFy2025;
  const purchasedWeightFromPurchases = scopedPurchases.reduce(
    (acc, p) => acc + Number(p.net_weight || 0),
    0,
  );
  const purchasedWeightFromBilty = scopedBiltys.reduce(
    (acc, b) => acc + Number(b.net_weight || 0),
    0,
  );
  const totalPurchasedNetWeight =
    purchasedWeightFromPurchases + purchasedWeightFromBilty;
  const totalSoldNetWeight = scopedSales.reduce(
    (acc, s) => acc + Number(s.net_weight || 0),
    0,
  );
  const openingStockWeightFromFy2025 = openingStockRowsFromFy2025.reduce(
    (acc, p) => acc + Number(p.net_weight || 0),
    0,
  );
  const stockWeight =
    totalPurchasedNetWeight - totalSoldNetWeight + openingStockWeightFromFy2025;
  const parseTermDays = (terms: string | null | undefined) => {
    const parsed = Number.parseInt(String(terms ?? "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  };

  const getDueDate = (saleDate: string, terms: string | null | undefined) => {
    const parsed = parseISO(saleDate);
    if (!isValid(parsed)) return null;
    return addDays(parsed, parseTermDays(terms));
  };

  const today = nowIst;
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const buyerCompanyNameById = new Map(
    buyerCompanies.map((company) => [company.id, company.name]),
  );
  const companySummary = new Map<
    string,
    {
      pending: number;
      overdue: number;
      pendingBillCount: number;
      overdueBillCount: number;
    }
  >();

  for (const sale of scopedSales) {
    const companyName =
      (sale.sale_company_id
        ? buyerCompanyNameById.get(sale.sale_company_id)
        : null) ||
      sale.party ||
      "Unknown";
    const company = companyName.trim() || "Unknown";
    const pending = effectivePending(sale);
    const dueDate = getDueDate(sale.sale_date, sale.payment_terms);
    const dueStart = dueDate
      ? new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
      : null;
    const isOverdue =
      !!dueStart && dueStart.getTime() < todayStart.getTime() && pending > 0;

    const existing = companySummary.get(company) ?? {
      pending: 0,
      overdue: 0,
      pendingBillCount: 0,
      overdueBillCount: 0,
    };
    companySummary.set(company, {
      pending: existing.pending + pending,
      overdue: existing.overdue + (isOverdue ? pending : 0),
      pendingBillCount: existing.pendingBillCount + (pending > 0 ? 1 : 0),
      overdueBillCount: existing.overdueBillCount + (isOverdue ? 1 : 0),
    });
  }

  const companySummaryRows = [...companySummary.entries()]
    .map(([company, totals]) => ({ company, ...totals }))
    .filter((row) => row.pending > 0 || row.overdue > 0)
    .sort((a, b) => b.pending - a.pending);

  const totalOverdueAmount = companySummaryRows.reduce(
    (acc, row) => acc + row.overdue,
    0,
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-6 text-zinc-100">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Purchase Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatCurrencyINR(totalPurchasesAmount, {
                  maximumFractionDigits: 0,
                })}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                purchases{" "}
                {formatCurrencyINR(purchaseAmountFromPurchases, {
                  maximumFractionDigits: 0,
                })}{" "}
                | bilty{" "}
                {formatCurrencyINR(purchaseAmountFromBilty, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Total Sales Amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatCurrencyINR(totalSalesAmount, {
                  maximumFractionDigits: 0,
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Stock Bags
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(stockBags, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                purchases:{" "}
                {formatNumberIN(purchasedBagsFromPurchases, {
                  maximumFractionDigits: 0,
                })}{" "}
                | bilty :{" "}
                {formatNumberIN(purchasedBagsFromBilty, {
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                + last FY (2025-26):{" "}
                {formatNumberIN(openingStockBagsFromFy2025, {
                  maximumFractionDigits: 0,
                })}
              </p>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Stock Weight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(stockWeight, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}{" "}
                kg
              </div>
              <p className="mt-2 text-xs text-zinc-500">
                purchases{" "}
                {formatNumberIN(purchasedWeightFromPurchases, {
                  maximumFractionDigits: 0,
                })}{" "}
                kg | bilty{" "}
                {formatNumberIN(purchasedWeightFromBilty, {
                  maximumFractionDigits: 0,
                })}{" "}
                kg
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                + last FY (2025-26):{" "}
                {formatNumberIN(openingStockWeightFromFy2025, {
                  maximumFractionDigits: 0,
                })}{" "}
                kg
              </p>
            </CardContent>
          </Card>
        </div>

        <SalesReceivablesCards
          rows={companySummaryRows}
          totalPending={totalSalesPending}
          totalOverdue={totalOverdueAmount}
        />

        <div className="grid gap-4">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">
                Company Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex h-72 flex-col gap-3">
              <div className="overflow-x-auto">
                <div className="grid min-w-160 grid-cols-[1fr_100px_140px_100px_140px] gap-3 rounded-md border border-[#2a2d34] bg-[#15171c] px-3 py-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                  <span>Company</span>
                  <span className="text-right">Bills</span>
                  <span className="text-right">Pending</span>
                  <span className="text-right">Bills</span>
                  <span className="text-right">Overdue</span>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1">
                {companySummaryRows.length === 0 ? (
                  <div className="rounded-md border border-[#2a2d34] bg-[#15171c] p-3 text-sm text-zinc-400">
                    No company data yet.
                  </div>
                ) : (
                  companySummaryRows.map((row) => (
                    <div
                      key={row.company}
                      className="grid min-w-160 grid-cols-[1fr_100px_140px_100px_140px] gap-3 rounded-md border border-[#2a2d34] bg-[#15171c] px-3 py-2 text-sm"
                    >
                      <span
                        className="truncate text-zinc-200"
                        title={row.company}
                      >
                        {row.company}
                      </span>
                      <span className="text-right text-zinc-400">
                        {row.pendingBillCount}
                      </span>
                      <span className="text-right font-semibold text-zinc-100">
                        {formatCurrencyINR(row.pending, {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                      <span className="text-right text-zinc-400">
                        {row.overdueBillCount}
                      </span>
                      <span className="text-right font-semibold text-[#ff8f6b]">
                        {formatCurrencyINR(row.overdue, {
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Average Bags / Purchase
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(
                  scopedPurchases.reduce((acc, p) => acc + p.bags, 0) /
                    Math.max(scopedPurchases.length, 1),
                  { minimumFractionDigits: 0, maximumFractionDigits: 0 },
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Average Net Weight
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatNumberIN(
                  scopedPurchases.reduce((acc, p) => acc + p.net_weight, 0) /
                    Math.max(scopedPurchases.length, 1),
                  { minimumFractionDigits: 0, maximumFractionDigits: 0 },
                )}
              </div>
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-400">
                Average Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-[#ff8f6b]">
                {formatCurrencyINR(
                  scopedPurchases.reduce((acc, p) => acc + p.rate, 0) /
                    Math.max(scopedPurchases.length, 1),
                  { maximumFractionDigits: 0 },
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
