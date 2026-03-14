import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { getCompanies } from "@/features/companies/service/company.service";
import { CompaniesManager } from "@/features/companies/components/CompaniesManager";
import { getSales } from "@/features/sales/service/sale.service";

export default async function CompaniesPage() {
  const user = await requireAuth();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const [companies, sales] = await Promise.all([getCompanies(), getSales()]);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Companies</h1>
        <p className="text-zinc-500">
          Manage issuer companies and sale buyer companies.
        </p>
      </div>
      <CompaniesManager companies={companies} sales={sales} />
    </AppShell>
  );
}
