import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { getCompanies } from "@/features/companies/service/company.service";
import { OurCompaniesManager } from "@/features/companies/components/OurCompaniesManager";

export default async function OurCompaniesPage() {
  const user = await requireAuth();
  if (user.role !== "admin") {
    redirect("/dashboard");
  }
  const companies = await getCompanies("issuer");

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Our Companies</h1>
        <p className="text-zinc-500">Manage issuer companies.</p>
      </div>
      <OurCompaniesManager companies={companies} />
    </AppShell>
  );
}
