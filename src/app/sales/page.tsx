import { AppShell } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAuth } from "@/features/auth/lib/session";
import { getSales } from "@/features/sales/service/sale.service";
import { SalesTableClient } from "@/features/sales/components/SalesTableClient";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import {
  getCompanies,
  getCompanyPaymentAllocations,
  getCompanyPayments,
} from "@/features/companies/service/company.service";
import { computeEffectiveSalePending } from "@/features/companies/lib/payment-allocation";

export default async function SalesPage() {
  await requireAuth();
  const sales = await getSales();
  const [
    buyerCompaniesResult,
    issuerCompaniesResult,
    companyPaymentsResult,
    allocationsResult,
  ] = await Promise.allSettled([
    getCompanies("buyer"),
    getCompanies("issuer"),
    getCompanyPayments(),
    getCompanyPaymentAllocations(),
  ]);

  const buyerCompanies =
    buyerCompaniesResult.status === "fulfilled" ? buyerCompaniesResult.value : [];
  const issuerCompanies =
    issuerCompaniesResult.status === "fulfilled" ? issuerCompaniesResult.value : [];
  const companyPayments =
    companyPaymentsResult.status === "fulfilled" ? companyPaymentsResult.value : [];
  const allocations =
    allocationsResult.status === "fulfilled" ? allocationsResult.value : [];

  if (buyerCompaniesResult.status === "rejected") {
    console.error("Failed to load buyer companies", buyerCompaniesResult.reason);
  }
  if (issuerCompaniesResult.status === "rejected") {
    console.error("Failed to load issuer companies", issuerCompaniesResult.reason);
  }
  if (companyPaymentsResult.status === "rejected") {
    console.error("Failed to load company payments", companyPaymentsResult.reason);
  }
  if (allocationsResult.status === "rejected") {
    console.error("Failed to load company allocations", allocationsResult.reason);
  }

  const activeIssuerCompanies = issuerCompanies.filter((company) => company.is_active);

  let totalNetWeight = 0;
  let totalAmount = 0;
  let totalReceived = 0;

  for (const sale of sales) {
    totalNetWeight += sale.net_weight;
    totalAmount += sale.amount;
  }

  for (const payment of companyPayments) {
    totalReceived += payment.amount;
  }

  const pendingBySaleId =
    companyPayments.length > 0 || allocations.length > 0
      ? computeEffectiveSalePending(sales, companyPayments, allocations).pendingBySaleId
      : {};
  let effectivePendingTotal = 0;
  for (const sale of sales) {
    effectivePendingTotal += pendingBySaleId[sale.id] ?? sale.pending_amount;
  }

  const totals = {
    netWeight: totalNetWeight,
    amount: totalAmount,
    received: totalReceived,
    pending: effectivePendingTotal,
  };

  return (
    <AppShell>
      <div className="mb-3 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total Sales</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
              {formatNumberIN(sales.length, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total Net Weight</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
              {formatNumberIN(totals.netWeight)} kg
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total Amount</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
              {formatCurrencyINR(totals.amount)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total Pending</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
              {formatCurrencyINR(totals.pending)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#1f2229] bg-gradient-to-b from-[#17191f] to-[#14161b] shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-400">Total Received</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[#ff8f6b] sm:text-3xl">
              {formatCurrencyINR(totals.received)}
            </p>
          </CardContent>
        </Card>
      </div>

      <SalesTableClient
        data={sales}
        buyerCompanies={buyerCompanies}
        issuerCompanies={activeIssuerCompanies}
        pendingBySaleId={pendingBySaleId}
        addSaleHref="/sales/new"
      />
    </AppShell>
  );
}
