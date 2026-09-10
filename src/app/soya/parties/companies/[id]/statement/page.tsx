import { format } from "date-fns";
import { Inter } from "next/font/google";
import { notFound } from "next/navigation";

import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import { SoyaPartyStatement } from "@/features/soya-parties/components/SoyaPartyStatement";
import {
  getSoyaPartyById,
  getSoyaPartyEntries,
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
  const party = await getSoyaPartyById(id);
  return {
    title: `${party?.name || "Party"} Statement ${format(new Date(), "dd-MM-yyyy")}`,
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

  const party = await getSoyaPartyById(id);
  if (!party) {
    notFound();
  }

  const [entries, payments] = await Promise.all([
    getSoyaPartyEntries(),
    getSoyaPartyPayments(id),
  ]);

  const normalized = party.name.trim().toLowerCase();
  const partyEntries = entries.filter(
    (entry) => entry.party.trim().toLowerCase() === normalized,
  );

  return (
    <div className={inter.className}>
      <SoyaPartyStatement
        partyName={party.name}
        entries={partyEntries}
        payments={payments.map((payment) => ({
          id: payment.id,
          paid_on: payment.paid_on,
          bank: payment.bank,
          amount: payment.amount,
          remarks: payment.remarks,
        }))}
        hideBackLink={embed === "1"}
      />
    </div>
  );
}
