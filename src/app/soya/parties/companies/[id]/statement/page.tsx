import { format } from "date-fns";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";

import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { CompanyStatementView } from "@/features/companies/components/CompanyStatementView";
import { computeEffectiveSalePending } from "@/features/companies/lib/payment-allocation";
import { getSoyaCompanies } from "@/features/soya-companies/service/soya-company.service";
import {
  getSoyaPartyEntries,
  getSoyaPartyPaymentAllocations,
  getSoyaPartyPayments,
} from "@/features/soya-parties/service/soya-party.service";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

// Chrome uses the *parent* tab's title for the Save-As filename when printing
// an iframe, so the statement page sets it here too. See src/lib/print-iframe.ts.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const companies = await getSoyaCompanies();
  const party = companies.find(
    (company) => company.id === id && company.type === "buyer",
  );
  const dateStr = format(new Date(), "dd-MM-yyyy");
  const name = party?.display_name || party?.name || "Party";
  return {
    title: `${name} Statement ${dateStr}`,
  };
}

export default async function SoyaPartyStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ embed?: string }>;
}) {
  await requireSoyaAdminPage();

  const { id } = await params;
  const { embed } = (await searchParams) || {};

  const [companies, entries, payments, allocations] = await Promise.all([
    getSoyaCompanies(),
    getSoyaPartyEntries(),
    getSoyaPartyPayments(),
    getSoyaPartyPaymentAllocations(),
  ]);

  const party = companies.find(
    (company) => company.id === id && company.type === "buyer",
  );
  if (!party) {
    notFound();
  }

  const partyEntries = entries.filter((entry) => entry.sale_company_id === id);
  const partyPayments = payments.filter((payment) => payment.company_id === id);
  const partyEntryIds = new Set(partyEntries.map((entry) => entry.id));
  const partyAllocations = allocations.filter((allocation) =>
    partyEntryIds.has(allocation.sale_id),
  );

  const { pendingBySaleId, saleIdsByPaymentId } = computeEffectiveSalePending(
    partyEntries,
    partyPayments,
    partyAllocations,
  );

  return (
    <div className={inter.className}>
      {/* Reused verbatim from the maize side — it is fully prop-driven. */}
      <CompanyStatementView
        companyName={party.display_name || party.name}
        companyAddress={party.address || undefined}
        companyPhone={party.phone || undefined}
        companyGstin={party.gstin || undefined}
        sales={partyEntries}
        payments={partyPayments}
        pendingBySaleId={pendingBySaleId}
        saleIdsByPaymentId={saleIdsByPaymentId}
        companies={companies}
        hideBackLink={embed === "1"}
      />
    </div>
  );
}
