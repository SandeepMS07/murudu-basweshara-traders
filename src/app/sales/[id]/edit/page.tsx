import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { SaleForm } from "@/features/sales/components/SaleForm";
import {
  getBuyerCompaniesForSales,
  getIssuerCompaniesForSales,
  getSaleById,
} from "@/features/sales/service/sale.service";

export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    redirect("/sales");
  }

  const { id } = await params;
  const sale = await getSaleById(id);
  const [buyerCompanies, issuerCompanies] = await Promise.all([
    getBuyerCompaniesForSales(),
    getIssuerCompaniesForSales(),
  ]);
  if (!sale) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Edit Sale</h1>
        <p className="text-zinc-500">Modify an existing sales record.</p>
      </div>
      <SaleForm
        initialData={sale}
        buyerCompanies={buyerCompanies}
        issuerCompanies={issuerCompanies}
        canCreateBuyer={user.role === "admin"}
      />
    </AppShell>
  );
}
