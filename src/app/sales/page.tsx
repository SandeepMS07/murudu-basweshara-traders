import { format } from "date-fns";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { getSales } from "@/features/sales/service/sale.service";
import { SalesOverviewClient } from "@/features/sales/components/SalesOverviewClient";
import { getFinancialYearBounds } from "@/lib/financial-year";
import {
  getCompanies,
  getCompanyPaymentAllocations,
  getCompanyPayments,
} from "@/features/companies/service/company.service";
import { computeEffectiveSalePending } from "@/features/companies/lib/payment-allocation";

export default async function SalesPage() {
  await requireAuth();
  const sales = await getSales();
  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const { start: fyStart, end: fyEnd } = getFinancialYearBounds(nowIst);

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

  // Computed across *all* sales, not just the ones on screen: the FIFO
  // allocator settles the oldest bill first, so narrowing its input would
  // mis-assign payments once the date filter is moved. This matches what the
  // Companies statement already does.
  const pendingBySaleId =
    companyPayments.length > 0 || allocations.length > 0
      ? computeEffectiveSalePending(sales, companyPayments, allocations)
          .pendingBySaleId
      : {};

  return (
    <AppShell>
      <SalesOverviewClient
        sales={sales}
        buyerCompanies={buyerCompanies}
        issuerCompanies={activeIssuerCompanies}
        pendingBySaleId={pendingBySaleId}
        initialRange={{ from: fyStart, to: fyEnd }}
        todayIso={format(nowIst, "yyyy-MM-dd")}
        addSaleHref="/sales/new"
      />
    </AppShell>
  );
}
