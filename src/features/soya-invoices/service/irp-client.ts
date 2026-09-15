import "server-only";

/**
 * Talks to the e-Invoice Registration Portal (IRP).
 *
 * SCOPE, STATED PLAINLY: this module is complete and tested up to the network
 * boundary, but it has never exchanged a byte with the real portal, because
 * reaching the IRP needs credentials the business has not given us yet. Until
 * they arrive `readIrpConfig()` returns null and every call comes back as a
 * PREVIEW — the exact payload we would have sent, and nothing is filed. That is
 * deliberate: a preview is testable today, and a half-working live call that
 * silently fails is not.
 *
 * WHICH ROUTE, AND WHY IT MATTERS
 *   The customer's Tally reaches the portal through Tally's own GSP. Their
 *   notepad shows two logins: a web portal user, and a second one suffixed
 *   `_API_...` created under the API Registration section. That second one is
 *   the credential a program uses.
 *
 *   There are two ways for us to use it:
 *     a) through a GSP (Masters India, ClearTax, Cygnet and others), which is
 *        how almost everyone integrates. The GSP exposes a plain JSON API and
 *        handles NIC's encryption. This module implements that shape.
 *     b) direct to NIC, which additionally requires RSA-encrypting the password
 *        with NIC's public key and decrypting an AES session key from the auth
 *        response, and is only opened to filers above a turnover threshold.
 *
 *   The two differ ONLY inside `authenticate()` and `post()`. Everything else —
 *   the payload, the readiness checks, the response mapping — is identical, so
 *   switching route later is a change to this file alone.
 */

import type {
  EInvoiceSeller,
  EInvoicePayload,
} from "@/features/soya-invoices/lib/einvoice-payload";

export interface IrpCredential {
  username: string;
  password: string;
}

export interface IrpConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  /** Keyed by GSTIN — each company files under its own registration. */
  credentials: Record<string, IrpCredential>;
}

/**
 * Config comes from the environment, never the database.
 *
 * A portal password can raise invoices under the company's GSTIN. Putting it in
 * a table means it is in every backup, readable by anything with the service
 * key, and one query away from a log. The username is not a secret and could
 * live on the company row, but keeping the pair together is simpler to reason
 * about than splitting it.
 *
 *   SOYA_IRP_BASE_URL      https://<gsp-host>/einvoice
 *   SOYA_IRP_CLIENT_ID     issued by the GSP
 *   SOYA_IRP_CLIENT_SECRET issued by the GSP
 *   SOYA_IRP_CREDENTIALS   {"29CVOPS8598C1ZJ":{"username":"…_API_…","password":"…"}}
 */
export function readIrpConfig(): IrpConfig | null {
  const baseUrl = (process.env.SOYA_IRP_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const clientId = (process.env.SOYA_IRP_CLIENT_ID ?? "").trim();
  const clientSecret = (process.env.SOYA_IRP_CLIENT_SECRET ?? "").trim();
  const rawCredentials = (process.env.SOYA_IRP_CREDENTIALS ?? "").trim();

  if (!baseUrl || !clientId || !clientSecret || !rawCredentials) return null;

  let credentials: Record<string, IrpCredential>;
  try {
    credentials = JSON.parse(rawCredentials);
  } catch {
    // Misconfigured is not the same as unconfigured, and silently behaving as
    // unconfigured would hide a typo in production for weeks.
    throw new Error(
      "SOYA_IRP_CREDENTIALS is not valid JSON. Expected {\"<GSTIN>\":{\"username\":\"…\",\"password\":\"…\"}}",
    );
  }
  return { baseUrl, clientId, clientSecret, credentials };
}

export interface IrpStatus {
  configured: boolean;
  /** GSTINs we hold credentials for. */
  gstins: string[];
  reason: string;
}

/** What the UI shows so the user knows whether filing is live or a preview. */
export function irpStatus(): IrpStatus {
  let config: IrpConfig | null = null;
  try {
    config = readIrpConfig();
  } catch (error) {
    return {
      configured: false,
      gstins: [],
      reason: error instanceof Error ? error.message : "Bad IRP configuration",
    };
  }
  if (!config) {
    return {
      configured: false,
      gstins: [],
      reason:
        "No portal credentials configured. Invoices can be created and printed; filing shows a preview of the exact payload instead of sending it.",
    };
  }
  return {
    configured: true,
    gstins: Object.keys(config.credentials),
    reason: "",
  };
}

export type IrpResult =
  | {
      ok: true;
      /** True when nothing was sent because no credentials exist. */
      preview: boolean;
      irn: string;
      ackNo: string;
      ackDate: string;
      signedQr: string;
      ewbNo: string;
      ewbDate: string;
      ewbValidUntil: string;
      payload: EInvoicePayload;
      raw?: unknown;
    }
  | {
      ok: false;
      code: string;
      message: string;
      payload: EInvoicePayload;
      raw?: unknown;
    };

/** Tokens are valid for six hours; re-authenticating per call wastes a round
 *  trip and counts against the portal's rate limit. Cached per GSTIN. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function authenticate(config: IrpConfig, gstin: string): Promise<string> {
  const cached = tokenCache.get(gstin);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const credential = config.credentials[gstin];
  if (!credential) {
    throw new Error(
      `No portal credentials for GSTIN ${gstin}. Add it to SOYA_IRP_CREDENTIALS.`,
    );
  }

  const response = await fetch(`${config.baseUrl}/auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      gstin,
    },
    body: JSON.stringify({
      UserName: credential.username,
      Password: credential.password,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | { Status?: string; Data?: { AuthToken?: string; TokenExpiry?: string }; ErrorDetails?: unknown }
    | null;

  const token = body?.Data?.AuthToken;
  if (!response.ok || !token) {
    throw new Error(
      `Portal authentication failed for ${gstin}: ${describeError(body) || response.status}`,
    );
  }

  const expiry = body?.Data?.TokenExpiry ? Date.parse(body.Data.TokenExpiry) : NaN;
  tokenCache.set(gstin, {
    token,
    expiresAt: Number.isFinite(expiry) ? expiry : Date.now() + 5 * 60 * 60 * 1000,
  });
  return token;
}

/** The portal returns errors as a list of {ErrorCode, ErrorMessage}, sometimes
 *  as a JSON string rather than an array. Both shapes flattened to one line. */
function describeError(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const details = (body as { ErrorDetails?: unknown }).ErrorDetails;
  const list =
    typeof details === "string"
      ? (() => {
          try {
            return JSON.parse(details);
          } catch {
            return details;
          }
        })()
      : details;

  if (Array.isArray(list)) {
    return list
      .map((entry: { ErrorCode?: string; ErrorMessage?: string }) =>
        [entry.ErrorCode, entry.ErrorMessage].filter(Boolean).join(": "),
      )
      .filter(Boolean)
      .join("; ");
  }
  if (typeof list === "string") return list;
  const message = (body as { message?: string; Message?: string });
  return message.message ?? message.Message ?? "";
}

function errorCodeOf(body: unknown): string {
  if (!body || typeof body !== "object") return "unknown";
  const details = (body as { ErrorDetails?: unknown }).ErrorDetails;
  if (Array.isArray(details) && details[0]?.ErrorCode) return String(details[0].ErrorCode);
  return "unknown";
}

/**
 * Files one invoice and, when the payload carries an EwbDtls block, gets the
 * e-Way Bill back in the same response.
 *
 * That single-call behaviour is not an optimisation we chose — it is how the
 * portal works, confirmed by the customer's own recording, which ends with
 * "e-Invoice and e-Way Bill generated successfully" after one action.
 */
export async function generateIrn(
  payload: EInvoicePayload,
  seller: EInvoiceSeller,
): Promise<IrpResult> {
  let config: IrpConfig | null = null;
  try {
    config = readIrpConfig();
  } catch (error) {
    return {
      ok: false,
      code: "config",
      message: error instanceof Error ? error.message : "Bad IRP configuration",
      payload,
    };
  }

  if (!config) {
    return {
      ok: true,
      preview: true,
      irn: "",
      ackNo: "",
      ackDate: "",
      signedQr: "",
      ewbNo: "",
      ewbDate: "",
      ewbValidUntil: "",
      payload,
    };
  }

  try {
    const token = await authenticate(config, seller.gstin);
    const response = await fetch(`${config.baseUrl}/invoice`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        gstin: seller.gstin,
        "auth-token": token,
      },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as {
      Status?: string;
      Data?: Record<string, string>;
    } | null;

    // Status "1" is the portal's success flag; HTTP 200 alone is not enough,
    // because a rejected document also comes back 200 with Status "0".
    if (!response.ok || body?.Status !== "1" || !body?.Data) {
      return {
        ok: false,
        code: errorCodeOf(body),
        message: describeError(body) || `Portal returned ${response.status}`,
        payload,
        raw: body,
      };
    }

    const data = body.Data;
    return {
      ok: true,
      preview: false,
      irn: data.Irn ?? "",
      ackNo: String(data.AckNo ?? ""),
      ackDate: data.AckDt ?? "",
      signedQr: data.SignedQRCode ?? "",
      ewbNo: String(data.EwbNo ?? ""),
      ewbDate: data.EwbDt ?? "",
      ewbValidUntil: data.EwbValidTill ?? "",
      payload,
      raw: body,
    };
  } catch (error) {
    return {
      ok: false,
      code: "network",
      message: error instanceof Error ? error.message : "Could not reach the portal",
      payload,
    };
  }
}

/**
 * Cancels an IRN. The portal allows this for 24 hours after generation and
 * refuses afterwards — past that window the only correction is a credit note,
 * which is why doc_type carries CRN.
 */
export async function cancelIrn(
  irn: string,
  reasonCode: string,
  remark: string,
  seller: EInvoiceSeller,
): Promise<{ ok: true; preview: boolean } | { ok: false; message: string }> {
  let config: IrpConfig | null = null;
  try {
    config = readIrpConfig();
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Bad configuration" };
  }
  if (!config) return { ok: true, preview: true };

  try {
    const token = await authenticate(config, seller.gstin);
    const response = await fetch(`${config.baseUrl}/invoice/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        gstin: seller.gstin,
        "auth-token": token,
      },
      body: JSON.stringify({ Irn: irn, CnlRsn: reasonCode, CnlRem: remark.slice(0, 100) }),
    });
    const body = (await response.json().catch(() => null)) as { Status?: string } | null;
    if (!response.ok || body?.Status !== "1") {
      return { ok: false, message: describeError(body) || `Portal returned ${response.status}` };
    }
    return { ok: true, preview: false };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not reach the portal",
    };
  }
}

/** Clears cached auth tokens. Exists for tests and for recovering from a
 *  password change without a restart. */
export function resetIrpTokenCache(): void {
  tokenCache.clear();
}
