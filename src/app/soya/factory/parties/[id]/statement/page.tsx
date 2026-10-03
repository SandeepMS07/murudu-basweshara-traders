import { format } from "date-fns";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";

import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { getSoyaCompanyScopeFor } from "@/features/soya/lib/company-scope";
import { SoyaFactoryStatement } from "@/features/soya-factory/components/SoyaFactoryStatement";
import {
  getSoyaFactoryById,
  getSoyaFactoryEntries,
  getSoyaFactoryPayments,
} from "@/features/soya-factory/service/soya-factory.service";

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
  const factory = await getSoyaFactoryById(id);
  return {
    title: `${factory?.name || "Factory"} Statement ${format(new Date(), "dd-MM-yyyy")}`,
  };
}

export default async function SoyaFactoryStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ embed?: string }>;
}) {
  await requireSoyaAdminPage();

  const { id } = await params;
  const { embed } = (await searchParams) || {};

  const factory = await getSoyaFactoryById(id);
  if (!factory) {
    notFound();
  }

  // The statement follows the factory's company, whichever one the sidebar has
  // open, so a link from the dashboard's All companies view is correct.
  const scope = await getSoyaCompanyScopeFor(factory.company_id);
  const [entries, payments] = await Promise.all([
    getSoyaFactoryEntries(scope),
    getSoyaFactoryPayments(scope, id),
  ]);

  const normalized = factory.name.trim().toLowerCase();
  const factoryEntries = entries.filter(
    (entry) => entry.factory.trim().toLowerCase() === normalized,
  );

  return (
    <div className={inter.className}>
      <SoyaFactoryStatement
        factoryName={factory.name}
        entries={factoryEntries}
        payments={payments.map((payment) => ({
          id: payment.id,
          paid_on: payment.paid_on,
          bank: payment.bank,
          amount: payment.amount,
        }))}
        hideBackLink={embed === "1"}
      />
    </div>
  );
}
