export const dynamic = "force-dynamic";

import { format } from "date-fns";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { BiltyOverviewClient } from "@/features/bilty/components/BiltyOverviewClient";
import { type Bilty } from "@/features/bilty/schemas";
import { getBiltys } from "@/features/bilty/service/bilty.service";
import { getFinancialYearBounds } from "@/lib/financial-year";

export default async function BiltyPage() {
  await requireAuth();
  let data: Bilty[] = [];
  let loadError: string | null = null;

  try {
    data = await getBiltys();
  } catch (error: unknown) {
    loadError =
      error instanceof Error ? error.message : "Failed to load bilty records";
  }

  if (loadError) {
    const friendlyMessage = loadError.includes("public.bilty")
      ? "Bilty table is missing in Supabase. Run the updated `supabase/schema.sql` to create it."
      : loadError;

    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Bilty Unavailable
          </p>
          <h1 className="mt-2 text-2xl font-bold">
            Unable to load bilty records
          </h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">
            {friendlyMessage}
          </p>
        </div>
      </AppShell>
    );
  }

  const nowIst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );
  const { start: fyStart, end: fyEnd } = getFinancialYearBounds(nowIst);

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
          Bilty Overview
        </h1>
        <p className="text-zinc-500">
          Track bilty totals, recent activity, and the full record list.
        </p>
      </div>

      <BiltyOverviewClient
        biltys={data}
        initialRange={{ from: fyStart, to: fyEnd }}
        todayIso={format(nowIst, "yyyy-MM-dd")}
        addHref="/bilty/add"
      />
    </AppShell>
  );
}
