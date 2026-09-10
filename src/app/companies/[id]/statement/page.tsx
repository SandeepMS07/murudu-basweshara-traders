import { format } from "date-fns";
import { Inter } from "next/font/google";
import { notFound, redirect } from "next/navigation";

import { requireAuth } from "@/features/auth/lib/session";
import { CompanyStatementView } from "@/features/companies/components/CompanyStatementView";
import { computeEffectiveSalePending } from "@/features/companies/lib/payment-allocation";
import {
  getCompanies,
  getCompanyPaymentAllocations,
  getCompanyPayments,
} from "@/features/companies/service/company.service";
import { getSales } from "@/features/sales/service/sale.service";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const companies = await getCompanies();
  const buyer = companies.find(
    (company) => company.id === id && company.type === "buyer",
  );
  const dateStr = format(new Date(), "dd-MM-yyyy");
  const name = buyer?.display_name || buyer?.name || "Company";
  return {
    title: `${name} Statement ${dateStr}`,
  };
}

export default async function CompanyStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ embed?: string }>;
}) {
  const user = await requireAuth();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const { embed } = (await searchParams) || {};

  const [companies, sales, payments, allocations] = await Promise.all([
    getCompanies(),
    getSales(),
    getCompanyPayments(),
    getCompanyPaymentAllocations(),
  ]);

  const buyer = companies.find(
    (company) => company.id === id && company.type === "buyer",
  );
  if (!buyer) {
    notFound();
  }

  const buyerSales = sales.filter((sale) => sale.sale_company_id === id);
  const buyerPayments = payments.filter(
    (payment) => payment.company_id === id,
  );
  const buyerSaleIds = new Set(buyerSales.map((sale) => sale.id));
  const buyerAllocations = allocations.filter((allocation) =>
    buyerSaleIds.has(allocation.sale_id),
  );

  const { pendingBySaleId, saleIdsByPaymentId } = computeEffectiveSalePending(
    buyerSales,
    buyerPayments,
    buyerAllocations,
  );

  return (
    <div className={inter.className}>
      <CompanyStatementView
        companyName={buyer.display_name || buyer.name}
        companyAddress={buyer.address || undefined}
        companyPhone={buyer.phone || undefined}
        companyGstin={buyer.gstin || undefined}
        sales={buyerSales}
        payments={buyerPayments}
        pendingBySaleId={pendingBySaleId}
        saleIdsByPaymentId={saleIdsByPaymentId}
        companies={companies}
        hideBackLink={embed === "1"}
      />
    </div>
  );
}
