import { describe, expect, it } from "vitest";

import { soyaInvoiceSchema } from "@/features/soya-invoices/schemas";

// A minimal URD invoice; each test changes one thing.
const base = {
  company_id: "co-1",
  invoice_date: "2026-10-06",
  party_name: "BHARAT MALNAD FARM",
  party_gstin: "",
  party_registration_type: "unregistered",
  party_state_code: "29",
  bill_to_address: "Hosanagara, Shivamogga",
  place_of_supply_code: "29",
  items: [{ item_name: "Soya DOC", quantity: 20, rate: 4000, gst_rate: 5 }], // ₹80,000 taxable
};

const errorPaths = (input: Record<string, unknown>) => {
  const result = soyaInvoiceSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join("."));
};

describe("soyaInvoiceSchema — CGST Rule 46(e), URD buyer at ₹50,000+", () => {
  it("accepts a URD invoice with address and state", () => {
    expect(errorPaths(base)).toEqual([]);
  });

  it("requires the address at ₹50,000 or more", () => {
    expect(errorPaths({ ...base, bill_to_address: "" })).toContain("bill_to_address");
  });

  it("requires the state at ₹50,000 or more", () => {
    expect(errorPaths({ ...base, party_state_code: "" })).toContain("party_state_code");
  });

  it("does not require them below ₹50,000", () => {
    const small = {
      ...base,
      bill_to_address: "",
      party_state_code: "",
      items: [{ item_name: "Soya DOC", quantity: 1, rate: 49999, gst_rate: 5 }],
    };
    expect(errorPaths(small)).not.toContain("bill_to_address");
    expect(errorPaths(small)).not.toContain("party_state_code");
  });
});

describe("soyaInvoiceSchema — CGST Rule 53, credit / debit notes", () => {
  it("requires the original invoice number and date on a credit note", () => {
    const paths = errorPaths({ ...base, doc_type: "CRN" });
    expect(paths).toContain("original_invoice_no");
    expect(paths).toContain("original_invoice_date");
  });

  it("accepts a debit note that quotes its invoice", () => {
    expect(
      errorPaths({
        ...base,
        doc_type: "DBN",
        original_invoice_no: "SGT/2026-27/0012",
        original_invoice_date: "2026-09-30",
      }),
    ).toEqual([]);
  });

  it("does not ask a tax invoice for one", () => {
    expect(errorPaths({ ...base, doc_type: "INV" })).toEqual([]);
  });
});
