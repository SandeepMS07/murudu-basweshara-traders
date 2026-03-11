import { requireAuth } from "@/features/auth/lib/session";
import { redirect } from "next/navigation";

export default async function NewBillPage() {
  await requireAuth();
  redirect("/purchases");
}
