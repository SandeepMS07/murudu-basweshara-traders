import { NextResponse } from "next/server";

import { getCurrentUser } from "@/features/auth/lib/session";
import { getCompanies } from "@/features/companies/service/company.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const companies = await getCompanies("issuer");
  const activeCompanies = companies
    .filter((company) => company.is_active)
    .map((company) => ({
      id: company.id,
      name: company.name,
      display_name: company.display_name,
      code: company.code,
    }));

  return NextResponse.json({ companies: activeCompanies }, { status: 200 });
}
