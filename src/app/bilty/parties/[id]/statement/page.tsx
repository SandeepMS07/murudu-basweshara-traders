import { format } from "date-fns";
import { Inter } from "next/font/google";
import { notFound, redirect } from "next/navigation";

import { requireAuth } from "@/features/auth/lib/session";
import { BiltyPartyStatementView } from "@/features/bilty/components/BiltyPartyStatementView";
import {
  getBiltyPartyById,
  getBiltyPartyPayments,
  getBiltys,
} from "@/features/bilty/service/bilty.service";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const party = await getBiltyPartyById(id);
  const dateStr = format(new Date(), "dd-MM-yyyy");
  const name = party?.name || "Party";
  return {
    title: `${name} Statement ${dateStr}`,
  };
}

export default async function BiltyPartyStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ embed?: string }>;
}) {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const { embed } = (await searchParams) || {};

  const party = await getBiltyPartyById(id);
  if (!party) {
    notFound();
  }

  const [biltys, payments] = await Promise.all([
    getBiltys(),
    getBiltyPartyPayments(id),
  ]);

  const normalized = party.name.trim().toLowerCase();
  const partyBiltys = biltys.filter(
    (bilty) => bilty.party.trim().toLowerCase() === normalized,
  );

  return (
    <div className={inter.className}>
      <BiltyPartyStatementView
        partyName={party.name}
        partyPlace={party.place || undefined}
        partyMob={party.mob || undefined}
        biltys={partyBiltys}
        payments={payments}
        hideBackLink={embed === "1"}
      />
    </div>
  );
}
