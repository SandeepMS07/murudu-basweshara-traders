export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Printer } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { requireSoyaAdminPage } from "@/features/soya/lib/guard";
import {
  getSoyaInvoiceById,
  sellerForCompany,
} from "@/features/soya-invoices/service/soya-invoice.service";
import { EInvoicePanel } from "@/features/soya-invoices/components/EInvoicePanel";
import { SoyaSetupNotice } from "@/features/soya-invoices/components/SoyaSetupNotice";
import { irpStatus } from "@/features/soya-invoices/service/irp-client";
import { isInvoiceLocked } from "@/features/soya-invoices/schemas";
import { stateNameForCode } from "@/features/soya/lib/gst";
import { formatNumberIN } from "@/lib/number-format";

export default async function SoyaInvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSoyaAdminPage();
  const { id } = await params;

  let invoice;
  let seller;
  try {
    invoice = await getSoyaInvoiceById(id);
    if (!invoice) notFound();
    seller = await sellerForCompany(invoice.company_id);
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (message.includes("NEXT_NOT_FOUND")) throw error;
    return (
      <AppShell>
        <SoyaSetupNotice error={error} />
      </AppShell>
    );
  }

  const portal = irpStatus();
  const locked = isInvoiceLocked(invoice);
  const taxTotal = invoice.cgst + invoice.sgst + invoice.igst;

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/soya/invoices"
            className="inline-flex cursor-pointer items-center text-sm text-zinc-500 hover:text-zinc-300"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            All invoices
          </Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zinc-100">
            {invoice.invoice_no}
          </h1>
          <p className="text-zinc-500">
            {invoice.invoice_date} · {invoice.party_name}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/soya/invoices/${invoice.id}/print`}
            target="_blank"
            className="inline-flex cursor-pointer items-center rounded-md border border-[#2a2d34] px-3 py-2 text-sm text-zinc-300 hover:bg-[#1b1e24]"
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Link>
          {locked ? null : (
            <Link
              href={`/soya/invoices/${invoice.id}/edit`}
              className="inline-flex cursor-pointer items-center rounded-md bg-[#ff6a3d] px-3 py-2 text-sm font-medium text-white hover:bg-[#ff7f57]"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Link>
          )}
        </div>
      </div>

      {locked ? (
        <p className="mb-4 rounded-lg border border-[#3d3418] bg-[#2a2412]/40 px-4 py-3 text-sm text-[#f7e3b0]">
          This invoice has been filed with the government and can no longer be
          edited or deleted. Cancel the IRN within 24 hours of filing, or raise a
          credit note against it.
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="rounded-2xl border border-[#2a2d34] bg-[#14161b] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Parties
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Block
                title="From"
                lines={[
                  seller.legal_name || seller.name,
                  seller.gstin,
                  seller.address,
                  [seller.place, seller.pincode].filter(Boolean).join(" "),
                  stateNameForCode(seller.state_code),
                ]}
              />
              <Block
                title="Bill to"
                lines={[
                  invoice.party_legal_name || invoice.party_name,
                  invoice.party_gstin || "Unregistered",
                  invoice.bill_to_address,
                  [invoice.bill_to_place, invoice.bill_to_pincode].filter(Boolean).join(" "),
                  stateNameForCode(invoice.party_state_code),
                ]}
              />
              {invoice.ship_to_address ? (
                <Block
                  title="Ship to"
                  lines={[
                    invoice.ship_to_name,
                    invoice.ship_to_address,
                    [invoice.ship_to_place, invoice.ship_to_pincode].filter(Boolean).join(" "),
                    stateNameForCode(invoice.ship_to_state_code),
                  ]}
                />
              ) : null}
              {invoice.dispatch_from_address ? (
                <Block
                  title="Dispatch from"
                  lines={[
                    invoice.dispatch_from_name,
                    invoice.dispatch_from_address,
                    [invoice.dispatch_from_place, invoice.dispatch_from_pincode]
                      .filter(Boolean)
                      .join(" "),
                    stateNameForCode(invoice.dispatch_from_state_code),
                  ]}
                  note="e-Way Bill address only — does not affect the tax"
                />
              ) : null}
            </div>
            <p className="mt-3 border-t border-[#2a2d34] pt-3 text-sm text-zinc-400">
              Place of supply:{" "}
              <strong className="text-zinc-200">
                {stateNameForCode(invoice.place_of_supply_code) || "not set"}
              </strong>
              {" · "}
              {invoice.igst > 0 ? "IGST" : "CGST + SGST"}
            </p>
          </section>

          <section className="rounded-2xl border border-[#2a2d34] bg-[#14161b] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Items
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-[#2a2d34] text-left text-xs uppercase tracking-wider text-zinc-500">
                    <th className="py-2 pr-3 font-medium">Item</th>
                    <th className="py-2 pr-3 font-medium">HSN</th>
                    <th className="py-2 pr-3 text-right font-medium">Qty</th>
                    <th className="py-2 pr-3 text-right font-medium">Rate</th>
                    <th className="py-2 pr-3 text-right font-medium">Taxable</th>
                    <th className="py-2 pr-3 text-right font-medium">Tax</th>
                    <th className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item) => (
                    <tr key={item.id} className="border-b border-[#1d2026] last:border-0">
                      <td className="py-2 pr-3 text-zinc-200">
                        {item.item_name}
                        {item.description && item.description !== item.item_name ? (
                          <span className="block text-xs text-zinc-600">{item.description}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 font-mono text-xs text-zinc-400">{item.hsn || "—"}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-300">
                        {formatNumberIN(item.quantity, { maximumFractionDigits: 3 })} {item.unit}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-300">
                        {formatNumberIN(item.rate, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-300">
                        {formatNumberIN(item.taxable_value, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums text-zinc-400">
                        {formatNumberIN(item.cgst + item.sgst + item.igst, {
                          minimumFractionDigits: 2,
                        })}
                        <span className="ml-1 text-[10px] text-zinc-600">@{item.gst_rate}%</span>
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums text-zinc-100">
                        {formatNumberIN(item.total_value, { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <EInvoicePanel
            invoice={invoice}
            seller={seller}
            portalConfigured={portal.configured}
            portalReason={portal.reason}
          />

          <section className="rounded-2xl border border-[#2a2d34] bg-[#14161b] p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Totals
            </h2>
            <dl className="space-y-1.5 text-sm tabular-nums">
              <Row label="Taxable value" value={invoice.taxable_value} />
              {invoice.igst > 0 ? (
                <Row label="IGST" value={invoice.igst} />
              ) : (
                <>
                  <Row label="CGST" value={invoice.cgst} />
                  <Row label="SGST" value={invoice.sgst} />
                </>
              )}
              {invoice.other_charges ? (
                <Row label="Other charges" value={invoice.other_charges} />
              ) : null}
              <Row label="Round off" value={invoice.round_off} />
              <div className="mt-2 flex items-baseline justify-between border-t border-[#2a2d34] pt-2">
                <dt className="font-semibold text-zinc-200">Total</dt>
                <dd className="text-lg font-bold text-[#ff8f6b]">
                  ₹{formatNumberIN(invoice.total_value)}
                </dd>
              </div>
              <p className="pt-1 text-xs text-zinc-600">
                Tax of ₹{formatNumberIN(taxTotal, { minimumFractionDigits: 2 })} on{" "}
                ₹{formatNumberIN(invoice.taxable_value, { minimumFractionDigits: 2 })}
              </p>
            </dl>
          </section>

          {invoice.vehicle_no || invoice.transporter_name ? (
            <section className="rounded-2xl border border-[#2a2d34] bg-[#14161b] p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
                Transport
              </h2>
              <dl className="space-y-1 text-sm">
                <TextRow label="Vehicle" value={invoice.vehicle_no} />
                <TextRow label="Transporter" value={invoice.transporter_name} />
                <TextRow label="Transporter ID" value={invoice.transporter_id} />
                <TextRow
                  label="Distance"
                  value={invoice.distance_km ? `${invoice.distance_km} km` : ""}
                />
              </dl>
            </section>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

function Block({
  title,
  lines,
  note,
}: {
  title: string;
  lines: string[];
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-[#2a2d34] bg-[#111214] p-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      <div className="mt-1.5 space-y-0.5 text-sm text-zinc-300">
        {lines.filter(Boolean).map((line, index) => (
          <p key={index} className={index === 0 ? "font-medium text-zinc-100" : ""}>
            {line}
          </p>
        ))}
      </div>
      {note ? <p className="mt-2 text-[11px] text-zinc-600">{note}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-zinc-200">
        ₹{formatNumberIN(value, { minimumFractionDigits: 2 })}
      </dd>
    </div>
  );
}

function TextRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-mono text-xs text-zinc-200">{value}</dd>
    </div>
  );
}
