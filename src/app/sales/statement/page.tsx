import { format } from "date-fns";
import { Inter } from "next/font/google";

import { requireAuth } from "@/features/auth/lib/session";
import { computeEffectiveSalePending } from "@/features/companies/lib/payment-allocation";
import {
  getCompanies,
  getCompanyPaymentAllocations,
  getCompanyPayments,
} from "@/features/companies/service/company.service";
import { SalesStatementView } from "@/features/sales/components/SalesStatementView";
import {
  filterSales,
  salesFilterFromParams,
} from "@/features/sales/lib/sales-filter";
import { getSales } from "@/features/sales/service/sale.service";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

type StatementSearchParams = {
  from?: string;
  to?: string;
  issuer?: string;
  buyer?: string;
  embed?: string;
};

export async function generateMetadata() {
  return { title: `Sales Statement ${format(new Date(), "dd-MM-yyyy")}` };
}

export default async function SalesStatementPage({
  searchParams,
}: {
  searchParams?: Promise<StatementSearchParams>;
}) {
  // Same gate as /sales itself: src/proxy.ts already resolves this path to the
  // "sales" module, so a view-only operator may read their own statement.
  await requireAuth();

  const params = (await searchParams) || {};
  const filter = salesFilterFromParams(params);

  const sales = await getSales();

  const [buyerCompaniesResult, issuerCompaniesResult, paymentsResult, allocationsResult] =
    await Promise.allSettled([
      getCompanies("buyer"),
      getCompanies("issuer"),
      getCompanyPayments(),
      getCompanyPaymentAllocations(),
    ]);

  const buyerCompanies =
    buyerCompaniesResult.status === "fulfilled" ? buyerCompaniesResult.value : [];
  const issuerCompanies =
    issuerCompaniesResult.status === "fulfilled" ? issuerCompaniesResult.value : [];
  const payments =
    paymentsResult.status === "fulfilled" ? paymentsResult.value : [];
  const allocations =
    allocationsResult.status === "fulfilled" ? allocationsResult.value : [];

  if (buyerCompaniesResult.status === "rejected") {
    console.error("Failed to load buyer companies", buyerCompaniesResult.reason);
  }
  if (issuerCompaniesResult.status === "rejected") {
    console.error("Failed to load issuer companies", issuerCompaniesResult.reason);
  }
  if (paymentsResult.status === "rejected") {
    console.error("Failed to load company payments", paymentsResult.reason);
  }
  if (allocationsResult.status === "rejected") {
    console.error("Failed to load company allocations", allocationsResult.reason);
  }

  // Across *all* sales, then filtered — identical to /sales. FIFO settles the
  // oldest bill first, so narrowing the allocator's input would move money
  // between bills and the statement would disagree with the overview.
  const pendingBySaleId =
    payments.length > 0 || allocations.length > 0
      ? computeEffectiveSalePending(sales, payments, allocations).pendingBySaleId
      : {};

  const filteredSales = filterSales(sales, filter);

  return (
    <div className={inter.className}>
      <SalesStatementView
        sales={filteredSales}
        pendingBySaleId={pendingBySaleId}
        issuerCompanies={issuerCompanies}
        buyerCompanies={buyerCompanies}
        filter={filter}
        totalSalesCount={sales.length}
        embedded={params.embed === "1"}
      />
    </div>
  );
}
