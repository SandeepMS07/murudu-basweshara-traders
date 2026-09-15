import { z } from "zod";

import { checkGstin, stateCodeFromGstin } from "@/features/soya/lib/gst";

/**
 * A trading firm we raise invoices from — SREE GURU TRADING Co., OM SAI RAM
 * ENTERPRISES and so on. One per GST registration: the GSTIN, the invoice
 * series and the e-invoice portal login are all per company, never shared.
 */
export const soyaCompanySchema = z
  .object({
    id: z.string().optional(),
    /** Short name, shown in the company switcher. */
    name: z.string().trim().min(1, "Company name is required"),
    /** Full legal name, as it must print on a tax invoice. */
    legal_name: z.string().trim().default(""),
    gstin: z
      .string()
      .trim()
      .default("")
      .transform((value) => value.toUpperCase()),
    state_code: z.string().trim().default(""),
    address: z.string().trim().default(""),
    place: z.string().trim().default(""),
    pincode: z.string().trim().default(""),
    phone: z.string().trim().default(""),
    email: z.string().trim().default(""),
    invoice_prefix: z.string().trim().default(""),
    is_active: z.boolean().default(true),
    is_default: z.boolean().default(false),
    /** Turnover >= Rs 10 crore: binds the IRP 30-day reporting window. */
    aato_over_10cr: z.boolean().default(false),
  })
  .superRefine((company, ctx) => {
    // Empty is allowed while setting up; anything present must be a real GSTIN,
    // because the tax split is derived from its first two digits.
    if (company.gstin) {
      const result = checkGstin(company.gstin);
      if (!result.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: result.reason,
          path: ["gstin"],
        });
      } else if (company.state_code && company.state_code !== result.stateCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `GSTIN says state ${result.stateCode} (${result.stateName}), not ${company.state_code}`,
          path: ["state_code"],
        });
      }
    }
    if (company.pincode && !/^\d{6}$/.test(company.pincode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pincode must be 6 digits",
        path: ["pincode"],
      });
    }
  });

export type SoyaCompanyInput = z.infer<typeof soyaCompanySchema>;

export interface SoyaCompany extends SoyaCompanyInput {
  id: string;
  created_at?: string;
  updated_at?: string;
}

/** Fills state_code from the GSTIN when the caller left it blank. */
export function withDerivedStateCode<
  T extends { gstin?: string; state_code?: string },
>(input: T): T {
  if (input.state_code) return input;
  const derived = stateCodeFromGstin(input.gstin ?? "");
  return derived ? { ...input, state_code: derived } : input;
}

/**
 * GST identity carried by both counterparty masters — factories we buy from
 * and parties we sell to. Identical shape on purpose: a firm can be both.
 */
export const soyaCounterpartyGstFields = {
  gstin: z
    .string()
    .trim()
    .default("")
    .transform((value) => value.toUpperCase()),
  state_code: z.string().trim().default(""),
  registration_type: z
    .enum(["regular", "composition", "unregistered", "consumer"])
    .default("regular"),
  address: z.string().trim().default(""),
  place: z.string().trim().default(""),
  pincode: z.string().trim().default(""),
  phone: z.string().trim().default(""),
};

/** Shared superRefine body for counterparty GST fields. */
export function validateCounterpartyGst(
  value: {
    gstin?: string;
    state_code?: string;
    registration_type?: string;
    pincode?: string;
  },
  ctx: z.RefinementCtx,
) {
  const registered =
    value.registration_type === "regular" ||
    value.registration_type === "composition";

  if (value.gstin) {
    const result = checkGstin(value.gstin);
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.reason,
        path: ["gstin"],
      });
    }
  } else if (registered) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "A regular or composition dealer must have a GSTIN",
      path: ["gstin"],
    });
  }

  // Unregistered counterparties have no GSTIN to derive a state from, so the
  // state has to be chosen by hand or the tax split cannot be decided.
  if (!value.gstin && !value.state_code) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose a state — without a GSTIN it cannot be derived",
      path: ["state_code"],
    });
  }

  if (value.pincode && !/^\d{6}$/.test(value.pincode)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Pincode must be 6 digits",
      path: ["pincode"],
    });
  }
}
