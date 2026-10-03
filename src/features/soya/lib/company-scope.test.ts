import { describe, expect, it, vi } from "vitest";

// The module is server-only and imports the company service; neither matters
// for the pure filter logic under test.
vi.mock("server-only", () => ({}));
vi.mock("@/features/soya-companies/service/soya-company.service", () => ({}));
vi.mock("@/features/soya/lib/active-company", () => ({}));

const { companyScopeFilter } = await import(
  "@/features/soya/lib/company-scope"
);

const defaultCo = { companyId: "co-default", includeUnassigned: true };
const otherCo = { companyId: "co-other", includeUnassigned: false };
const none = { companyId: "", includeUnassigned: true };

describe("companyScopeFilter", () => {
  it("gives the default company its own rows and the unassigned ones", () => {
    expect(companyScopeFilter(defaultCo)).toBe(
      "company_id.eq.co-default,company_id.is.null",
    );
  });

  it("gives any other company only its own rows", () => {
    expect(companyScopeFilter(otherCo)).toBe("company_id.eq.co-other");
  });

  it("matches only unassigned rows when no company exists yet", () => {
    expect(companyScopeFilter(none)).toBe("company_id.is.null");
  });
});
