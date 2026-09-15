"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  FileWarning,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cancelSoyaInvoiceIrnAction,
  fileSoyaInvoiceAction,
} from "@/app/soya/invoices/actions";
import {
  buildEInvoicePayload,
  checkEInvoiceReady,
  needsEwayBill,
  type EInvoiceSeller,
} from "@/features/soya-invoices/lib/einvoice-payload";
import type { SoyaInvoice } from "@/features/soya-invoices/schemas";
import { IRN_CANCEL_REASONS } from "@/features/soya/lib/einvoice-codes";
import { cn } from "@/lib/utils";

interface EInvoicePanelProps {
  invoice: SoyaInvoice;
  seller: EInvoiceSeller;
  /** Whether portal credentials exist. False means filing shows a preview. */
  portalConfigured: boolean;
  portalReason: string;
}

/**
 * Filing an invoice with the government, and showing exactly why it cannot be
 * filed when it cannot.
 *
 * The portal returns one terse numbered error at a time and each attempt is a
 * round trip, so every problem it would raise is listed here first. Without
 * credentials the same button produces the payload instead of sending it —
 * which is the only honest thing to do, and is testable.
 */
export function EInvoicePanel({
  invoice,
  seller,
  portalConfigured,
  portalReason,
}: EInvoicePanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [payloadOpen, setPayloadOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("1");
  const [cancelRemark, setCancelRemark] = useState("");
  const [lastPayload, setLastPayload] = useState<unknown>(null);

  const problems = useMemo(
    () => checkEInvoiceReady(invoice, seller),
    [invoice, seller],
  );
  const blocking = problems.filter((problem) => problem.severity === "blocking");
  const warnings = problems.filter((problem) => problem.severity === "warning");

  const payload = useMemo(
    () => buildEInvoicePayload(invoice, seller),
    [invoice, seller],
  );
  const willProduceEwb = needsEwayBill(invoice);
  const filed = invoice.einvoice_status === "generated";
  const cancelled = invoice.einvoice_status === "cancelled";

  // The portal only allows cancellation for 24 hours after acknowledgement.
  //
  // The clock is held as state fed by a timer rather than read during render:
  // Date.now() in render is impure, and the server's instant is not the
  // client's, so the button could hydrate into the opposite state. It stays 0
  // until the first tick, which reads as "window still open" — the safe default,
  // since a needless attempt is refused by the portal while a needlessly
  // disabled button would strip a real option away.
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    // Deferred rather than called inline: a synchronous setState inside an
    // effect triggers a second render pass.
    const first = window.setTimeout(tick, 0);
    // Re-checked each minute so a window that closes while the page is open
    // disables the button rather than failing at the portal.
    const timer = window.setInterval(tick, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, []);

  const cancelWindowClosed = useMemo(() => {
    if (!invoice.ack_date || now === 0) return false;
    const filedAt = Date.parse(invoice.ack_date);
    return Number.isFinite(filedAt) && now - filedAt > 24 * 60 * 60 * 1000;
  }, [invoice.ack_date, now]);

  const file = () => {
    startTransition(async () => {
      try {
        const result = await fileSoyaInvoiceAction(invoice.id);
        setLastPayload(result.payload);
        if (result.preview) {
          toast.info("Preview only — nothing was filed");
          setPayloadOpen(true);
        } else if (result.ok) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not file the invoice");
      }
    });
  };

  const cancel = () => {
    startTransition(async () => {
      try {
        const result = await cancelSoyaInvoiceIrnAction(invoice.id, cancelReason, cancelRemark);
        if (result.ok) toast.success(result.message);
        else toast.error(result.message);
        setCancelOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not cancel");
      }
    });
  };

  return (
    <section className="rounded-2xl border border-[#2a2d34] bg-[#14161b] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[#ff8f6b]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
            e-Invoice &amp; e-Way Bill
          </h2>
        </div>
        <StatusPill status={invoice.einvoice_status} />
      </div>

      {/* ---------------------------------------------- already filed */}
      {filed ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3">
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
              <CheckCircle2 className="h-4 w-4" />
              Filed with the portal
            </p>
            <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
              <Detail label="IRN" value={invoice.irn} mono wrap />
              <Detail label="Ack No" value={invoice.ack_no} mono />
              <Detail label="Ack Date" value={formatStamp(invoice.ack_date)} />
              {invoice.ewb_no ? (
                <>
                  <Detail label="e-Way Bill No" value={invoice.ewb_no} mono />
                  <Detail label="Valid until" value={formatStamp(invoice.ewb_valid_until)} />
                </>
              ) : (
                <Detail label="e-Way Bill" value="Not generated" />
              )}
            </dl>
          </div>

          {invoice.signed_qr ? (
            <p className="text-xs text-zinc-500">
              A signed QR code was returned and is printed on the invoice.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setPayloadOpen(true)}
              className="cursor-pointer border-[#2a2d34] bg-transparent text-zinc-300 hover:bg-[#1b1e24]"
            >
              <Code2 className="mr-2 h-4 w-4" />
              View filed payload
            </Button>
            <Button
              variant="outline"
              onClick={() => setCancelOpen(true)}
              disabled={isPending || cancelWindowClosed}
              title={
                cancelWindowClosed
                  ? "The portal's 24-hour cancellation window has closed"
                  : undefined
              }
              className="cursor-pointer border-red-900/50 bg-transparent text-red-300 hover:bg-[#2a1616] disabled:opacity-40"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel IRN
            </Button>
          </div>

          {cancelWindowClosed ? (
            <p className="rounded-md border border-[#3d3418] bg-[#2a2412]/40 px-3 py-2 text-xs text-[#f7e3b0]">
              The 24-hour cancellation window has closed. To correct this invoice
              now, raise a credit note against it.
            </p>
          ) : null}
        </div>
      ) : cancelled ? (
        <div className="rounded-lg border border-[#3d3418] bg-[#2a2412]/40 p-3 text-sm text-[#f7e3b0]">
          <p className="font-medium">IRN cancelled on the portal</p>
          <p className="mt-1 text-xs">
            {invoice.irn_cancel_reason || "No reason recorded"}
            {invoice.irn_cancelled_at ? ` · ${formatStamp(invoice.irn_cancelled_at)}` : ""}
          </p>
        </div>
      ) : (
        /* --------------------------------------------- not yet filed */
        <div className="space-y-3">
          {!portalConfigured ? (
            <div className="rounded-lg border border-[#2a3a44] bg-[#0f1a1f] p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-sky-200">
                <FileWarning className="h-4 w-4" />
                Portal not connected
              </p>
              <p className="mt-1 text-xs leading-5 text-sky-200/70">{portalReason}</p>
            </div>
          ) : null}

          {blocking.length > 0 ? (
            <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-red-200">
                <AlertTriangle className="h-4 w-4" />
                {blocking.length} thing{blocking.length === 1 ? "" : "s"} the portal
                would reject
              </p>
              <ul className="mt-2 space-y-1">
                {blocking.map((problem) => (
                  <li key={problem.field} className="flex gap-2 text-xs text-red-200/85">
                    <span aria-hidden className="select-none">•</span>
                    <span>{problem.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                Ready to file
                {willProduceEwb ? " — an e-Way Bill will be generated with it" : ""}
              </p>
            </div>
          )}

          {warnings.length > 0 ? (
            <ul className="space-y-1">
              {warnings.map((problem) => (
                <li key={problem.field} className="text-xs text-amber-300/80">
                  ⚠ {problem.message}
                </li>
              ))}
            </ul>
          ) : null}

          {invoice.einvoice_error ? (
            <div className="rounded-lg border border-red-900/40 bg-red-950/20 p-3">
              <p className="text-xs font-medium text-red-200">The portal rejected this:</p>
              <p className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-red-200/80">
                {invoice.einvoice_error}
              </p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={file}
              disabled={isPending || blocking.length > 0}
              className="cursor-pointer bg-[#ff6a3d] text-white hover:bg-[#ff7f57] disabled:opacity-40"
            >
              <Send className="mr-2 h-4 w-4" />
              {isPending
                ? "Working…"
                : portalConfigured
                  ? willProduceEwb
                    ? "Generate e-Invoice & e-Way Bill"
                    : "Generate e-Invoice"
                  : "Preview the payload"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setPayloadOpen(true)}
              className="cursor-pointer border-[#2a2d34] bg-transparent text-zinc-300 hover:bg-[#1b1e24]"
            >
              <Code2 className="mr-2 h-4 w-4" />
              View payload
            </Button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------ payload dialog */}
      <Dialog open={payloadOpen} onOpenChange={setPayloadOpen}>
        <DialogContent className="max-h-[85vh] overflow-hidden border-[#2a2d34] bg-[#14161b] text-zinc-100 sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>e-Invoice payload</DialogTitle>
            <DialogDescription className="text-zinc-500">
              The exact JSON sent to the portal, in the NIC 1.1 schema. Field names
              are the portal&apos;s own abbreviations.
            </DialogDescription>
          </DialogHeader>
          <pre className="max-h-[60vh] overflow-auto rounded-lg border border-[#2a2d34] bg-[#0d0e11] p-3 font-mono text-[11px] leading-5 text-zinc-300">
            {JSON.stringify(lastPayload ?? payload, null, 2)}
          </pre>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(JSON.stringify(lastPayload ?? payload, null, 2))
                  .then(() => toast.success("Copied"))
                  .catch(() => toast.error("Could not copy"));
              }}
              className="cursor-pointer text-zinc-400"
            >
              Copy
            </Button>
            <Button
              onClick={() => setPayloadOpen(false)}
              className="cursor-pointer bg-[#ff6a3d] text-white hover:bg-[#ff7f57]"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------- cancel dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="border-[#2a2d34] bg-[#14161b] text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this IRN?</DialogTitle>
            <DialogDescription className="text-zinc-500">
              This tells the government the invoice is void. It works only within
              24 hours of filing, and the number cannot be reused afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <label className="grid gap-1.5 text-xs text-zinc-400">
              Reason
              <select
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                className="h-9 cursor-pointer rounded-md border border-[#2a2d34] bg-[#111214] px-2 text-sm text-zinc-100"
              >
                {IRN_CANCEL_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs text-zinc-400">
              Remark
              <input
                value={cancelRemark}
                onChange={(event) => setCancelRemark(event.target.value)}
                maxLength={100}
                className="h-9 rounded-md border border-[#2a2d34] bg-[#111214] px-2 text-sm text-zinc-100"
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setCancelOpen(false)}
              disabled={isPending}
              className="cursor-pointer text-zinc-400"
            >
              Keep it
            </Button>
            <Button
              onClick={cancel}
              disabled={isPending}
              className="cursor-pointer bg-red-600 text-white hover:bg-red-500"
            >
              {isPending ? "Cancelling…" : "Cancel IRN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function StatusPill({ status }: { status: SoyaInvoice["einvoice_status"] }) {
  const label: Record<string, string> = {
    pending: "Not filed",
    generated: "Filed",
    cancelled: "Cancelled",
    failed: "Rejected",
    not_applicable: "Not applicable",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        status === "generated" && "border-emerald-700/50 bg-emerald-950/40 text-emerald-300",
        status === "failed" && "border-red-800/50 bg-red-950/40 text-red-300",
        status === "cancelled" && "border-[#3d3418] bg-[#2a2412]/50 text-[#f7e3b0]",
        (status === "pending" || status === "not_applicable") &&
          "border-[#2a2d34] bg-[#1b1e24] text-zinc-400",
      )}
    >
      {label[status] ?? status}
    </span>
  );
}

function Detail({
  label,
  value,
  mono,
  wrap,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className={cn(wrap && "sm:col-span-2")}>
      <dt className="text-zinc-500">{label}</dt>
      <dd
        className={cn(
          "text-zinc-200",
          mono && "font-mono",
          wrap && "break-all text-[10px] leading-4",
        )}
      >
        {value || "—"}
      </dd>
    </div>
  );
}

function formatStamp(value: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
