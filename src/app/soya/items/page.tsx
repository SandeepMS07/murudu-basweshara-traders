export const dynamic = "force-dynamic";

import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getActiveSoyaCompany } from "@/features/soya/lib/active-company";
import { getSoyaItems } from "@/features/soya-invoices/service/soya-item.service";
import { SoyaItemsManager } from "@/features/soya-invoices/components/SoyaItemsManager";
import { SoyaSetupNotice } from "@/features/soya-invoices/components/SoyaSetupNotice";

export default async function SoyaItemsPage() {
  await requireSoyaAdminPage();

  let company;
  try {
    company = await getActiveSoyaCompany();
  } catch (error) {
    return (
      <AppShell>
        <SoyaSetupNotice error={error} />
      </AppShell>
    );
  }

  if (!company) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#2a2d34] bg-[#14161b] p-8 text-center">
          <h1 className="text-xl font-semibold text-zinc-100">No company yet</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Items belong to a trading firm. Add one first.
          </p>
          <Link
            href="/soya/companies"
            className="mt-4 inline-block cursor-pointer rounded-md bg-[#ff6a3d] px-4 py-2 text-sm font-medium text-white hover:bg-[#ff7f57]"
          >
            Go to Companies
          </Link>
        </div>
      </AppShell>
    );
  }

  let items;
  try {
    items = await getSoyaItems(company.id);
  } catch (error) {
    return (
      <AppShell>
        <SoyaSetupNotice error={error} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Items</h1>
        <p className="text-zinc-500">
          What {company.name} sells, with the HSN code and unit every invoice line
          needs.
        </p>
      </div>

      <SoyaItemsManager
        items={items}
        companyId={company.id}
        companyName={company.name}
      />
    </AppShell>
  );
}
