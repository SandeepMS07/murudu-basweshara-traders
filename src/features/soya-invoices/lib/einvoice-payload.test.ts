import { describe, expect, it } from "vitest";

import {
  buildEInvoicePayload,
  checkEInvoiceReady,
  needsEwayBill,
  toPortalDate,
  type EInvoiceSeller,
} from "@/features/soya-invoices/lib/einvoice-payload";
import { computeInvoice } from "@/features/soya-invoices/lib/invoice-math";
import type { SoyaInvoice, SoyaInvoiceItem } from "@/features/soya-invoices/schemas";

/**
 * Everything here is pinned to the customer's real 12-Sep-2026 sales voucher 72
 * — SREE GURU TRADING selling soya meal to ANNAM FARM, dispatched from the mill
 * at Latur in Maharashtra. That voucher is the only ground truth available for
 * what the portal actually accepted.
 */

const SELLER: EInvoiceSeller = {
  gstin: "29CVOPS8598C1ZJ",
  legal_name: "SREE GURU TRADING CO",
  name: "SREE GURU TRADING",
  address: "MARKET ROAD",
  place: "MANGALURU",
  pincode: "575001",
  state_code: "29",
  phone: "9446864894",
  email: "",
};

const totals = computeInvoice([{ quantity: 30.43, rate: 54190, gst_rate: 5 }], "29", "29");

function line(): SoyaInvoiceItem {
  const computed = totals.lines[0];
  return {
    id: "line-1",
    invoice_id: "inv-1",
    line_no: 1,
    item_id: "item-1",
    item_name: "SOYA MEAL",
    description: "SOYA MEAL 620 BAGS",
    hsn: "2304",
    unit: "MTS",
    quantity: 30.43,
    rate: 54190,
    discount: 0,
    gst_rate: 5,
    amount: computed.amount,
    taxable_value: computed.taxable_value,
    cgst: computed.cgst,
    sgst: computed.sgst,
    igst: computed.igst,
    cess: 0,
    total_value: computed.total_value,
  };
}

function invoice(overrides: Partial<SoyaInvoice> = {}): SoyaInvoice {
  // Dated today, because the portal refuses anything over 30 days old and the
  // readiness check enforces that.
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: "inv-1",
    company_id: "co-1",
    invoice_no: "SGT/2026-27/0072",
    invoice_date: today,
    fy_start_year: 2026,
    doc_type: "INV",
    supply_type: "B2B",
    reverse_charge: false,

    party_id: "party-1",
    party_name: "ANNAM FARM",
    party_legal_name: "ANNAM FARM PVT LTD",
    party_gstin: "29AAWCA5892P1ZB",
    party_state_code: "29",
    party_registration_type: "regular",
    bill_to_address: "THAMJOOR BARVA KONAJE VILLAGE",
    bill_to_place: "MANGALURU",
    bill_to_pincode: "574199",
    party_phone: "",
    party_email: "",

    ship_to_name: "",
    ship_to_gstin: "",
    ship_to_address: "",
    ship_to_place: "",
    ship_to_pincode: "",
    ship_to_state_code: "",

    dispatch_from_name: "LATUR",
    dispatch_from_address: "MIDC LATUR",
    dispatch_from_place: "LATUR",
    dispatch_from_pincode: "413531",
    dispatch_from_state_code: "27",

    place_of_supply_code: "29",

    taxable_value: totals.taxable_value,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    cess: 0,
    other_charges: 0,
    round_off: totals.round_off,
    total_value: totals.total_value,

    transporter_name: "",
    transporter_id: "",
    transport_mode: "1",
    vehicle_no: "KA28AB3276",
    vehicle_type: "R",
    distance_km: 250,
    transport_doc_no: "",
    transport_doc_date: "",
    original_invoice_no: "",
    original_invoice_date: "",

    einvoice_status: "pending",
    irn: "",
    ack_no: "",
    ack_date: "",
    signed_qr: "",
    einvoice_error: "",
    irn_cancelled_at: "",
    irn_cancel_reason: "",

    ewb_status: "pending",
    ewb_no: "",
    ewb_date: "",
    ewb_valid_until: "",
    ewb_error: "",
    ewb_cancelled_at: "",

    notes: "",
    items: [line()],
    ...overrides,
  };
}

describe("toPortalDate", () => {
  it("converts ISO to the portal's dd/mm/yyyy", () => {
    expect(toPortalDate("2026-09-12")).toBe("12/09/2026");
  });

  it("returns empty rather than a wrong date", () => {
    expect(toPortalDate("")).toBe("");
    expect(toPortalDate("12-09-2026")).toBe("");
  });
});

describe("buildEInvoicePayload", () => {
  it("carries voucher 72's money through unchanged", () => {
    const payload = buildEInvoicePayload(invoice(), SELLER);
    expect(payload.ValDtls.AssVal).toBe(1649001.7);
    expect(payload.ValDtls.CgstVal).toBe(41225.04);
    expect(payload.ValDtls.SgstVal).toBe(41225.04);
    expect(payload.ValDtls.IgstVal).toBe(0);
    expect(payload.ValDtls.RndOffAmt).toBe(0.22);
    expect(payload.ValDtls.TotInvVal).toBe(1731452);
  });

  it("reconciles line tax against document tax, which the portal checks", () => {
    const payload = buildEInvoicePayload(invoice(), SELLER);
    const sum = (key: "CgstAmt" | "SgstAmt" | "IgstAmt") =>
      Number(
        payload.ItemList.reduce((running, item) => running + Number(item[key]), 0).toFixed(2),
      );
    expect(sum("CgstAmt")).toBe(payload.ValDtls.CgstVal);
    expect(sum("SgstAmt")).toBe(payload.ValDtls.SgstVal);
    expect(sum("IgstAmt")).toBe(payload.ValDtls.IgstVal);
  });

  it("reconciles the invoice total against its parts", () => {
    const payload = buildEInvoicePayload(invoice(), SELLER);
    const { AssVal, CgstVal, SgstVal, IgstVal, OthChrg, RndOffAmt, TotInvVal } = payload.ValDtls;
    expect(Number((AssVal + CgstVal + SgstVal + IgstVal + OthChrg + RndOffAmt).toFixed(2))).toBe(
      TotInvVal,
    );
  });

  it("sends the dispatch-from block when goods leave a third address", () => {
    const payload = buildEInvoicePayload(invoice(), SELLER);
    expect(payload.DispDtls).toBeDefined();
    expect(payload.DispDtls?.Stcd).toBe("27");
    expect(payload.DispDtls?.Pin).toBe("413531");
    // ...and the tax is still Karnataka's, decided by the two registrations.
    expect(payload.ValDtls.CgstVal).toBeGreaterThan(0);
    expect(payload.ValDtls.IgstVal).toBe(0);
  });

  it("omits dispatch-from entirely when goods leave our own premises", () => {
    const payload = buildEInvoicePayload(
      invoice({ dispatch_from_name: "", dispatch_from_address: "" }),
      SELLER,
    );
    // Present-but-empty is treated by the portal as a claim it then validates.
    expect(payload.DispDtls).toBeUndefined();
  });

  it("omits ship-to when it is the same as bill-to", () => {
    expect(buildEInvoicePayload(invoice(), SELLER).ShipDtls).toBeUndefined();
  });

  it("sends ship-to when the goods go somewhere else", () => {
    const payload = buildEInvoicePayload(
      invoice({
        ship_to_name: "ANNAM FARM GODOWN",
        ship_to_address: "NH66 SURATKAL",
        ship_to_place: "MANGALURU",
        ship_to_pincode: "575014",
        ship_to_state_code: "29",
      }),
      SELLER,
    );
    expect(payload.ShipDtls?.Pin).toBe("575014");
    // Falls back to the buyer's GSTIN, which is what the portal expects when
    // the consignee is the same legal person at a different address.
    expect(payload.ShipDtls?.Gstin).toBe("29AAWCA5892P1ZB");
  });

  it("includes the e-Way Bill block with the vehicle from the voucher", () => {
    const payload = buildEInvoicePayload(invoice(), SELLER);
    expect(payload.EwbDtls?.VehNo).toBe("KA28AB3276");
    expect(payload.EwbDtls?.TransMode).toBe("1");
    expect(payload.EwbDtls?.Distance).toBe(250);
  });

  it("marks an export buyer without a GSTIN as URP", () => {
    const payload = buildEInvoicePayload(
      invoice({ party_gstin: "", party_registration_type: "unregistered", supply_type: "EXPWP" }),
      SELLER,
    );
    expect(payload.BuyerDtls.Gstin).toBe("URP");
  });

  it("sends a credit note's original invoice as PrecDocDtls", () => {
    const payload = buildEInvoicePayload(
      invoice({
        doc_type: "CRN",
        original_invoice_no: "SGT/2026-27/0012",
        original_invoice_date: "2026-09-30",
      }),
      SELLER,
    );
    expect(payload.DocDtls.Typ).toBe("CRN");
    expect(payload.RefDtls?.PrecDocDtls).toEqual([
      { InvNo: "SGT/2026-27/0012", InvDt: "30/09/2026" },
    ]);
  });

  it("sends no RefDtls on a tax invoice", () => {
    expect(buildEInvoicePayload(invoice(), SELLER).RefDtls).toBeUndefined();
  });

  it("sets Pos from place of supply, not from the buyer's address", () => {
    const payload = buildEInvoicePayload(
      invoice({ place_of_supply_code: "27", party_state_code: "29" }),
      SELLER,
    );
    expect(payload.BuyerDtls.Pos).toBe("27");
  });

  it("never emits an empty Addr1, which the portal rejects", () => {
    const payload = buildEInvoicePayload(invoice({ bill_to_address: "" }), SELLER);
    expect(payload.BuyerDtls.Addr1).toBe("NA");
  });
});

describe("checkEInvoiceReady", () => {
  const blocking = (inv: SoyaInvoice, seller = SELLER) =>
    checkEInvoiceReady(inv, seller)
      .filter((problem) => problem.severity === "blocking")
      .map((problem) => problem.field);

  it("passes a complete invoice", () => {
    expect(blocking(invoice())).toEqual([]);
  });

  it("blocks a line with no HSN", () => {
    const withoutHsn = invoice();
    withoutHsn.items = [{ ...line(), hsn: "" }];
    expect(blocking(withoutHsn)).toContain("items.0.hsn");
  });

  it("blocks a 2-digit HSN, which is a typo rather than a shorter code", () => {
    const short = invoice();
    short.items = [{ ...line(), hsn: "23" }];
    expect(blocking(short)).toContain("items.0.hsn");
  });

  it("blocks a missing place of supply", () => {
    expect(blocking(invoice({ place_of_supply_code: "" }))).toContain("place_of_supply_code");
  });

  it("blocks a registered buyer with no GSTIN", () => {
    expect(blocking(invoice({ party_gstin: "" }))).toContain("party_gstin");
  });

  it("does not ask a URD buyer for a GSTIN", () => {
    expect(
      blocking(invoice({ party_gstin: "", party_registration_type: "unregistered" })),
    ).not.toContain("party_gstin");
  });

  it("blocks e-invoicing a domestic sale to a URD or consumer buyer (B2C)", () => {
    for (const type of ["unregistered", "consumer"]) {
      expect(
        blocking(invoice({ party_gstin: "", party_registration_type: type })),
      ).toContain("party_registration_type");
    }
  });

  it("allows e-invoicing an export to a buyer with no GSTIN", () => {
    expect(
      blocking(
        invoice({ party_gstin: "", party_registration_type: "unregistered", supply_type: "EXPWOP" }),
      ),
    ).not.toContain("party_registration_type");
  });

  it("blocks a credit note that does not quote its invoice", () => {
    const paths = blocking(invoice({ doc_type: "CRN" }));
    expect(paths).toContain("original_invoice_no");
    expect(paths).toContain("original_invoice_date");
  });

  it("blocks an invoice dated in the future", () => {
    const future = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
    expect(blocking(invoice({ invoice_date: future }))).toContain("invoice_date");
  });

  describe("the 30-day reporting window", () => {
    // It binds only filers at or above Rs 10 crore turnover, and only since
    // 1 April 2025. Applying it to everyone would refuse to file a perfectly
    // legal invoice for a smaller business.
    const old = new Date(Date.now() - 86400000 * 45).toISOString().slice(0, 10);

    it("blocks an old invoice when the company is over ₹10 crore", () => {
      expect(
        blocking(invoice({ invoice_date: old }), { ...SELLER, aato_over_10cr: true }),
      ).toContain("invoice_date");
    });

    it("only warns when the company is below ₹10 crore", () => {
      expect(blocking(invoice({ invoice_date: old }))).not.toContain("invoice_date");
      const problems = checkEInvoiceReady(invoice({ invoice_date: old }), SELLER);
      expect(problems.find((p) => p.field === "invoice_date")?.severity).toBe("warning");
    });

    it("blocks a future date for everyone, regardless of turnover", () => {
      const future = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10);
      expect(blocking(invoice({ invoice_date: future }))).toContain("invoice_date");
    });
  });

  it("blocks an invoice number over 16 characters", () => {
    expect(blocking(invoice({ invoice_no: "SGT/2026-27/000072" }))).toContain("invoice_no");
  });

  it("blocks an invoice number with a character the portal rejects", () => {
    expect(blocking(invoice({ invoice_no: "SGT#0072" }))).toContain("invoice_no");
  });

  it("blocks a seller with no pincode", () => {
    expect(blocking(invoice(), { ...SELLER, pincode: "" })).toContain("seller.pincode");
  });

  it("blocks an invalid vehicle number", () => {
    expect(blocking(invoice({ vehicle_no: "KA28" }))).toContain("vehicle_no");
  });

  it("demands a vehicle or transporter above the e-Way Bill threshold", () => {
    const noVehicle = invoice({ vehicle_no: "", transporter_id: "", transport_mode: "1" });
    expect(blocking(noVehicle)).toContain("vehicle_no");
  });

  it("does not demand transport on a small invoice", () => {
    const small = invoice({
      vehicle_no: "",
      transporter_id: "",
      transport_mode: "",
      total_value: 4000,
    });
    expect(blocking(small)).toEqual([]);
  });

  it("warns, but does not block, when distance is zero", () => {
    const problems = checkEInvoiceReady(invoice({ distance_km: 0 }), SELLER);
    const distance = problems.find((problem) => problem.field === "distance_km");
    expect(distance?.severity).toBe("warning");
  });

  it("blocks re-filing an invoice that already has an IRN", () => {
    expect(
      blocking(invoice({ einvoice_status: "generated", irn: "a".repeat(64) })),
    ).toContain("irn");
  });
});

describe("needsEwayBill", () => {
  it("is required above fifty thousand", () => {
    expect(needsEwayBill({ total_value: 50000, vehicle_no: "", transporter_id: "" })).toBe(true);
    expect(needsEwayBill({ total_value: 49999, vehicle_no: "", transporter_id: "" })).toBe(false);
  });

  it("is produced below the threshold when a vehicle is given anyway", () => {
    expect(needsEwayBill({ total_value: 100, vehicle_no: "KA28AB3276", transporter_id: "" })).toBe(
      true,
    );
  });
});
