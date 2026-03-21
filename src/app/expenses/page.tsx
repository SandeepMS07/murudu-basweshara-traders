import { AppShell } from "@/components/layout/AppShell";
import { requireAuth } from "@/features/auth/lib/session";
import { redirect } from "next/navigation";

export default async function ExpensesPage() {
  await requireAuth();
  redirect("/expenses/overview");
}
