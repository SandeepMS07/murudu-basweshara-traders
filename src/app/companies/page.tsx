import { format } from "date-fns";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import {
  getCompanies,
  getCompanyPaymentAllocations,
  getCompanyPayments,
} from "@/features/companies/service/company.service";
import { CompaniesManager } from "@/features/companies/components/CompaniesManager";
import { getSales } from "@/features/sales/service/sale.service";

export default async function CompaniesPage() {
  const user = await requireAuth();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const [companies, sales, payments, allocations] = await Promise.all([
    getCompanies(),
    getSales(),
    getCompanyPayments(),
    getCompanyPaymentAllocations(),
  ]);

  // "Today" in IST so the date presets match what the server considers today.
  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  return (
    <AppShell>
      <CompaniesManager
        companies={companies}
        sales={sales}
        payments={payments}
        allocations={allocations}
        todayIso={format(nowIst, "yyyy-MM-dd")}
      />
    </AppShell>
  );
}
