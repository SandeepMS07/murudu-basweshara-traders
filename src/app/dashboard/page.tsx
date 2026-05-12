import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { addDays, isValid, parseISO } from "date-fns";
import { requireAuth } from "@/features/auth/lib/session";
import { AppShell } from "@/components/layout/AppShell";
import { getPurchases } from "@/features/purchases/service/purchase.service";
import { getSales } from "@/features/sales/service/sale.service";
import { getBiltys } from "@/features/bilty/service/bilty.service";
import { getCompanies } from "@/features/companies/service/company.service";
import { PurchaseTrendChart } from "@/features/dashboard/components/PurchaseTrendChart";
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
    (acc, s) => acc + (s.pending_amount || 0),
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
  const rtgsAmount = scopedPurchases
    .filter((p) => p.payment_through === "RTGS")
    .reduce((acc, p) => acc + (p.final_total || 0), 0);
  const upiAmount = scopedPurchases
    .filter((p) => p.payment_through === "UPI")
    .reduce((acc, p) => acc + (p.final_total || 0), 0);
  const pendingAmount = scopedPurchases
    .filter((p) => p.payment_through === "none")
    .reduce((acc, p) => acc + (p.final_total || 0), 0);
  const byDate = new Map<string, number>();
  for (const p of scopedPurchases) {
    byDate.set(p.date, (byDate.get(p.date) || 0) + p.final_total);
  }
  const trend = [...byDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-10);

  const salesByDate = new Map<string, number>();
  for (const sale of scopedSales) {
    salesByDate.set(
      sale.sale_date,
      (salesByDate.get(sale.sale_date) || 0) + sale.amount,
    );
  }
  const salesTrend = [...salesByDate.entries()]
    .map(([date, amount]) => ({ date, amount }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7);

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
    { pending: number; overdue: number }
  >();

  for (const sale of scopedSales) {
    const companyName =
      (sale.sale_company_id
        ? buyerCompanyNameById.get(sale.sale_company_id)
        : null) ||
      sale.party ||
      "Unknown";
    const company = companyName.trim() || "Unknown";
    const pending = sale.pending_amount || 0;
    const dueDate = getDueDate(sale.sale_date, sale.payment_terms);
    const dueStart = dueDate
      ? new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate())
      : null;
    const isOverdue =
      !!dueStart && dueStart.getTime() < todayStart.getTime() && pending > 0;

    const existing = companySummary.get(company) ?? { pending: 0, overdue: 0 };
    companySummary.set(company, {
      pending: existing.pending + pending,
      overdue: existing.overdue + (isOverdue ? pending : 0),
    });
  }

  const companySummaryRows = [...companySummary.entries()]
    .map(([company, totals]) => ({ company, ...totals }))
    .sort((a, b) => b.pending - a.pending);

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

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">
                Purchase Trend (Last {trend.length || 0} Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trend.length > 0 ? (
                <PurchaseTrendChart data={trend} />
              ) : (
                <p className="text-sm text-zinc-400">No purchase data yet.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">
                Payment Through
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>RTGS</span>
                  <span className="font-medium">
                    {formatCurrencyINR(rtgsAmount, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#2a2d34]">
                  <div
                    className="h-2 rounded-full bg-[#ff6a3d]"
                    style={{
                      width: `${totalPurchasesAmount ? (rtgsAmount / totalPurchasesAmount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>UPI</span>
                  <span className="font-medium">
                    {formatCurrencyINR(upiAmount, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#2a2d34]">
                  <div
                    className="h-2 rounded-full bg-[#ff8f6b]"
                    style={{
                      width: `${totalPurchasesAmount ? (upiAmount / totalPurchasesAmount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Pending</span>
                  <span className="font-medium">
                    {formatCurrencyINR(pendingAmount, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#2a2d34]">
                  <div
                    className="h-2 rounded-full bg-[#ffb79e]"
                    style={{
                      width: `${totalPurchasesAmount ? (pendingAmount / totalPurchasesAmount) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">
                Sales Trend (Last {salesTrend.length || 0} Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesTrend.length > 0 ? (
                <PurchaseTrendChart data={salesTrend} />
              ) : (
                <p className="text-sm text-zinc-400">No sales data yet.</p>
              )}
            </CardContent>
          </Card>
          <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] text-zinc-100">
            <CardHeader>
              <CardTitle className="text-base text-zinc-100">
                Company Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="flex h-72 flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 rounded-md border border-[#2a2d34] bg-[#15171c] px-3 py-2 text-xs uppercase tracking-[0.14em] text-zinc-500">
                <span>Company</span>
                <span className="text-right">Pending</span>
                <span className="text-right">Overdue</span>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {companySummaryRows.length === 0 ? (
                  <div className="rounded-md border border-[#2a2d34] bg-[#15171c] p-3 text-sm text-zinc-400">
                    No company data yet.
                  </div>
                ) : (
                  companySummaryRows.map((row) => (
                    <div
                      key={row.company}
                      className="grid grid-cols-3 gap-2 rounded-md border border-[#2a2d34] bg-[#15171c] px-3 py-2 text-sm"
                    >
                      <span
                        className="truncate text-zinc-200"
                        title={row.company}
                      >
                        {row.company}
                      </span>
                      <span className="text-right font-semibold text-zinc-100">
                        {formatCurrencyINR(row.pending, {
                          maximumFractionDigits: 0,
                        })}
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
