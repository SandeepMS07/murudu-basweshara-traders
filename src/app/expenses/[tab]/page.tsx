import { notFound } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { ExpensesPageContent } from "@/features/expenses/components/ExpensesPageContent";
import { TabKey } from "@/features/expenses/components/ExpensesManager";

const allowedTabs: TabKey[] = ["overview", "salary", "vehicle", "hamali", "other"];

export default async function ExpensesTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  await requireAuth();
  const { tab } = await params;
  if (!allowedTabs.includes(tab as TabKey)) {
    notFound();
  }

  return (
    <AppShell>
      <ExpensesPageContent initialTab={tab as TabKey} />
    </AppShell>
  );
}
