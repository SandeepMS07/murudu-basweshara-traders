import { format } from "date-fns";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";

import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { BiltyPartyStatementView } from "@/features/bilty/components/BiltyPartyStatementView";
import {
  getSoyaFactoryPartyById,
  getSoyaFactoryPartyPayments,
  getSoyaFactoryRecords,
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
  const party = await getSoyaFactoryPartyById(id);
  const dateStr = format(new Date(), "dd-MM-yyyy");
  const name = party?.name || "Party";
  return {
    title: `${name} Statement ${dateStr}`,
  };
}

export default async function SoyaFactoryPartyStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ embed?: string }>;
}) {
  await requireSoyaAdminPage();

  const { id } = await params;
  const { embed } = (await searchParams) || {};

  const party = await getSoyaFactoryPartyById(id);
  if (!party) {
    notFound();
  }

  const [records, payments] = await Promise.all([
    getSoyaFactoryRecords(),
    getSoyaFactoryPartyPayments(id),
  ]);

  const normalized = party.name.trim().toLowerCase();
  const partyRecords = records.filter(
    (record) => record.party.trim().toLowerCase() === normalized,
  );

  return (
    <div className={inter.className}>
      {/* Reused verbatim from the maize side — it is fully prop-driven. */}
      <BiltyPartyStatementView
        partyName={party.name}
        partyPlace={party.place || undefined}
        partyMob={party.mob || undefined}
        biltys={partyRecords}
        payments={payments}
        hideBackLink={embed === "1"}
      />
    </div>
  );
}
