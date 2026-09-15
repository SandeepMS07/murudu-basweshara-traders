export const dynamic = "force-dynamic";

import Link from "next/link";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getActiveSoyaCompany } from "@/features/soya/lib/active-company";
import { getSoyaItems } from "@/features/soya-invoices/service/soya-item.service";
import { getSoyaPartiesForInvoicing } from "@/features/soya/service/counterparty-gst.service";
import { SoyaInvoiceForm } from "@/features/soya-invoices/components/SoyaInvoiceForm";
import { SoyaSetupNotice } from "@/features/soya-invoices/components/SoyaSetupNotice";

export default async function NewSoyaInvoicePage() {
  await requireSoyaAdminPage();

  // Loading is kept out of the JSX entirely: constructing JSX inside a
  // try/catch would not actually catch a render error, only a fetch one.
  let loaded:
    | { ok: true; company: NonNullable<Awaited<ReturnType<typeof getActiveSoyaCompany>>>; items: Awaited<ReturnType<typeof getSoyaItems>>; parties: Awaited<ReturnType<typeof getSoyaPartiesForInvoicing>> }
    | { ok: false; error: unknown }
    | { ok: "no-company" };
  try {
    const company = await getActiveSoyaCompany();
    if (!company) {
      loaded = { ok: "no-company" };
    } else {
      const [items, parties] = await Promise.all([
        getSoyaItems(company.id),
        getSoyaPartiesForInvoicing(company.id),
      ]);
      loaded = { ok: true, company, items, parties };
    }
  } catch (error) {
    loaded = { ok: false, error };
  }

  if (loaded.ok === false) {
    return (
      <AppShell>
        <SoyaSetupNotice error={loaded.error} />
      </AppShell>
    );
  }

  if (loaded.ok === "no-company") {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#2a2d34] bg-[#14161b] p-8 text-center">
          <h1 className="text-xl font-semibold text-zinc-100">No company yet</h1>
          <p className="mt-2 text-sm text-zinc-500">
            An invoice is raised by a trading firm. Add one first.
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

  const { company, items, parties } = loaded;

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">New invoice</h1>
        <p className="text-zinc-500">Raised by {company.name}.</p>
      </div>

      {items.length === 0 ? (
        <div className="mb-4 rounded-lg border border-[#3d3418] bg-[#2a2412]/40 px-4 py-3 text-sm text-[#f7e3b0]">
          No items yet. You can still type a line by hand, but{" "}
          <Link href="/soya/items" className="cursor-pointer underline">
            adding items
          </Link>{" "}
          first fills in the HSN and GST rate for you.
        </div>
      ) : null}

      <SoyaInvoiceForm
        company={company}
        today={new Date().toISOString().slice(0, 10)}
        items={items}
        parties={parties.map((party) => ({
          id: party.id,
          name: party.name,
          gstin: party.gstin,
          state_code: party.state_code,
          address: party.address,
          place: party.place,
          pincode: party.pincode,
          phone: party.phone,
          registration_type: party.registration_type,
        }))}
        invoice={null}
      />
    </AppShell>
  );
}
