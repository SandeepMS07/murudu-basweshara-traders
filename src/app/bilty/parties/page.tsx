export const dynamic = "force-dynamic";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { BiltyPartiesManager } from "@/features/bilty/components/BiltyPartiesManager";
import { type BiltyParty } from "@/features/bilty/schemas";
import { getBiltyParties } from "@/features/bilty/service/bilty.service";

export default async function BiltyPartiesPage() {
  const user = await requireAuth();
  if (user.role !== "admin" && user.role !== "operator") {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Access Denied
          </p>
          <h1 className="mt-2 text-2xl font-bold">Parties are restricted</h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">
            Your role does not allow party management.
          </p>
        </div>
      </AppShell>
    );
  }

  let parties: BiltyParty[] = [];
  let loadError: string | null = null;

  try {
    parties = await getBiltyParties();
  } catch (error: unknown) {
    loadError = error instanceof Error ? error.message : "Failed to load bilty parties";
  }

  if (loadError) {
    const friendlyMessage = loadError.includes("bilty_parties")
      ? "Party table is missing in Supabase. Run the updated `supabase/schema.sql` to create it."
      : loadError;

    return (
      <AppShell>
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#3b2323] bg-[#1a1111] p-6 text-red-100 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300">
            Bilty Parties Unavailable
          </p>
          <h1 className="mt-2 text-2xl font-bold">Unable to load parties</h1>
          <p className="mt-3 text-sm leading-6 text-red-200/90">
            {friendlyMessage}
          </p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-100">Bilty Parties</h1>
        <p className="text-zinc-500">Manage the party master used in bilty entries.</p>
      </div>
      <BiltyPartiesManager parties={parties} />
    </AppShell>
  );
}
