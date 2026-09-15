"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createSoyaInvoiceAction,
  suggestInvoiceNumberAction,
  updateSoyaInvoiceAction,
} from "@/app/soya/invoices/actions";
import type { SoyaCompany } from "@/features/soya-companies/schemas";
import type { SoyaInvoice, SoyaItem } from "@/features/soya-invoices/schemas";
import { computeInvoice } from "@/features/soya-invoices/lib/invoice-math";
import {
  EWB_THRESHOLD_RUPEES,
  isValidVehicleNo,
  TRANSPORT_MODE_OPTIONS,
  UQC_OPTIONS,
  VEHICLE_TYPE_OPTIONS,
} from "@/features/soya/lib/einvoice-codes";
import {
  checkGstin,
  GST_STATE_OPTIONS,
  stateCodeFromGstin,
  stateNameForCode,
} from "@/features/soya/lib/gst";
import { formatNumberIN } from "@/lib/number-format";
import { cn } from "@/lib/utils";

const fieldClass =
  "border-[#2a2d34] bg-[#111214] text-zinc-100 placeholder:text-zinc-600";
const selectClass = cn(
  "h-9 w-full cursor-pointer rounded-md border px-2 text-sm",
  fieldClass,
);

interface LineState {
  key: string;
  item_id: string;
  item_name: string;
  description: string;
  hsn: string;
  unit: string;
  quantity: string;
  rate: string;
  discount: string;
  gst_rate: string;
}

/**
 * Line keys come from a module-level counter rather than Math.random(), which
 * is impure during render and would differ between server and client.
 */
let lineKeySeq = 0;

function emptyLine(): LineState {
  lineKeySeq += 1;
  return {
    key: `new-${lineKeySeq}`,
    item_id: "",
    item_name: "",
    description: "",
    hsn: "",
    unit: "MTS",
    quantity: "",
    rate: "",
    discount: "",
    gst_rate: "5",
  };
}

interface SoyaInvoiceFormProps {
  company: SoyaCompany;
  /** Today's date, from the server — a new Date() here is impure in render. */
  today: string;
  items: SoyaItem[];
  parties: { id: string; name: string; gstin: string; state_code: string; address: string; place: string; pincode: string; phone: string; registration_type: string }[];
  invoice: SoyaInvoice | null;
}

/**
 * Create or edit a tax invoice.
 *
 * The totals shown here are computed with the SAME function the server uses to
 * store them (computeInvoice), so what the user sees before saving is what gets
 * saved. The server recomputes rather than trusting these numbers — this is a
 * preview, not the source of truth.
 */
export function SoyaInvoiceForm({
  company,
  today,
  items,
  parties,
  invoice,
}: SoyaInvoiceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [invoiceNo, setInvoiceNo] = useState(invoice?.invoice_no ?? "");
  const [invoiceDate, setInvoiceDate] = useState(invoice?.invoice_date ?? today);
  const [docType, setDocType] = useState(invoice?.doc_type ?? "INV");

  const [partyId, setPartyId] = useState(invoice?.party_id ?? "");
  const [partyName, setPartyName] = useState(invoice?.party_name ?? "");
  const [partyLegalName, setPartyLegalName] = useState(invoice?.party_legal_name ?? "");
  const [partyGstin, setPartyGstin] = useState(invoice?.party_gstin ?? "");
  const [partyStateCode, setPartyStateCode] = useState(invoice?.party_state_code ?? "");
  const [registrationType, setRegistrationType] = useState(
    invoice?.party_registration_type ?? "regular",
  );
  const [billToAddress, setBillToAddress] = useState(invoice?.bill_to_address ?? "");
  const [billToPlace, setBillToPlace] = useState(invoice?.bill_to_place ?? "");
  const [billToPincode, setBillToPincode] = useState(invoice?.bill_to_pincode ?? "");
  const [partyPhone, setPartyPhone] = useState(invoice?.party_phone ?? "");

  const [placeOfSupply, setPlaceOfSupply] = useState(invoice?.place_of_supply_code ?? "");

  const [showShipTo, setShowShipTo] = useState(Boolean(invoice?.ship_to_address));
  const [shipToName, setShipToName] = useState(invoice?.ship_to_name ?? "");
  const [shipToAddress, setShipToAddress] = useState(invoice?.ship_to_address ?? "");
  const [shipToPlace, setShipToPlace] = useState(invoice?.ship_to_place ?? "");
  const [shipToPincode, setShipToPincode] = useState(invoice?.ship_to_pincode ?? "");
  const [shipToStateCode, setShipToStateCode] = useState(invoice?.ship_to_state_code ?? "");

  const [showDispatch, setShowDispatch] = useState(Boolean(invoice?.dispatch_from_address));
  const [dispatchName, setDispatchName] = useState(invoice?.dispatch_from_name ?? "");
  const [dispatchAddress, setDispatchAddress] = useState(invoice?.dispatch_from_address ?? "");
  const [dispatchPlace, setDispatchPlace] = useState(invoice?.dispatch_from_place ?? "");
  const [dispatchPincode, setDispatchPincode] = useState(invoice?.dispatch_from_pincode ?? "");
  const [dispatchStateCode, setDispatchStateCode] = useState(
    invoice?.dispatch_from_state_code ?? "",
  );

  const [transportMode, setTransportMode] = useState(invoice?.transport_mode ?? "1");
  const [vehicleNo, setVehicleNo] = useState(invoice?.vehicle_no ?? "");
  const [vehicleType, setVehicleType] = useState(invoice?.vehicle_type ?? "R");
  const [transporterName, setTransporterName] = useState(invoice?.transporter_name ?? "");
  const [transporterId, setTransporterId] = useState(invoice?.transporter_id ?? "");
  const [distanceKm, setDistanceKm] = useState(
    invoice?.distance_km ? String(invoice.distance_km) : "",
  );

  const [otherCharges, setOtherCharges] = useState(
    invoice?.other_charges ? String(invoice.other_charges) : "",
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");

  const [lines, setLines] = useState<LineState[]>(() =>
    invoice && invoice.items.length > 0
      ? invoice.items.map((line) => ({
          key: line.id,
          item_id: line.item_id,
          item_name: line.item_name,
          description: line.description,
          hsn: line.hsn,
          unit: line.unit,
          quantity: String(line.quantity),
          rate: String(line.rate),
          discount: line.discount ? String(line.discount) : "",
          gst_rate: String(line.gst_rate),
        }))
      : [emptyLine()],
  );

  // Suggest the next number in the company's series for a NEW invoice. An
  // existing one keeps the number it was issued under — reissuing it under a
  // different number would break the unbroken series GST requires.
  useEffect(() => {
    if (invoice || !invoiceDate) return;
    let cancelled = false;
    suggestInvoiceNumberAction(company.id, invoiceDate)
      .then((next) => {
        if (!cancelled) setInvoiceNo(next);
      })
      .catch(() => {
        /* leave it blank; the server allocates one on save */
      });
    return () => {
      cancelled = true;
    };
  }, [company.id, invoiceDate, invoice]);

  const gstinCheck = useMemo(
    () => (partyGstin.trim() ? checkGstin(partyGstin) : null),
    [partyGstin],
  );

  // Place of supply follows the buyer's state, set at the moment the party or
  // GSTIN is chosen rather than in an effect — an effect that calls setState
  // from derived state causes a cascading re-render, and the value stays
  // editable afterwards because a ship-to in a third state overrides it.

  const totals = useMemo(
    () =>
      computeInvoice(
        lines.map((line) => ({
          quantity: Number(line.quantity || 0),
          rate: Number(line.rate || 0),
          discount: Number(line.discount || 0),
          gst_rate: Number(line.gst_rate || 0),
        })),
        company.state_code,
        placeOfSupply,
        Number(otherCharges || 0),
      ),
    [lines, company.state_code, placeOfSupply, otherCharges],
  );

  const ewbRequired = totals.total_value >= EWB_THRESHOLD_RUPEES;
  const vehicleProblem =
    vehicleNo.trim() && !isValidVehicleNo(vehicleNo) ? "Not a valid vehicle number" : "";

  const choosePartyFromMaster = (id: string) => {
    setPartyId(id);
    const party = parties.find((candidate) => candidate.id === id);
    if (!party) return;
    setPartyName(party.name);
    setPartyGstin(party.gstin);
    setPartyStateCode(party.state_code || stateCodeFromGstin(party.gstin));
    setBillToAddress(party.address);
    setBillToPlace(party.place);
    setBillToPincode(party.pincode);
    setPartyPhone(party.phone);
    setRegistrationType(party.registration_type || "regular");
    setPlaceOfSupply(party.state_code || stateCodeFromGstin(party.gstin));
  };

  const setLine = (key: string, patch: Partial<LineState>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );

  const chooseItem = (key: string, itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) {
      setLine(key, { item_id: "" });
      return;
    }
    setLine(key, {
      item_id: item.id,
      item_name: item.name,
      description: item.description,
      hsn: item.hsn,
      unit: item.unit,
      gst_rate: String(item.gst_rate),
      rate: item.default_rate ? String(item.default_rate) : "",
    });
  };

  const save = () => {
    if (!partyName.trim()) {
      toast.error("Choose or name a party");
      return;
    }
    if (!placeOfSupply) {
      toast.error("Place of supply is required — it decides CGST+SGST versus IGST");
      return;
    }
    if (lines.every((line) => !line.item_name.trim())) {
      toast.error("Add at least one item");
      return;
    }
    if (vehicleProblem) {
      toast.error(vehicleProblem);
      return;
    }

    const payload = {
      company_id: company.id,
      invoice_no: invoiceNo.trim(),
      invoice_date: invoiceDate,
      doc_type: docType,
      supply_type: "B2B",
      reverse_charge: false,

      party_id: partyId,
      party_name: partyName,
      party_legal_name: partyLegalName,
      party_gstin: partyGstin,
      party_state_code: partyStateCode,
      party_registration_type: registrationType,
      bill_to_address: billToAddress,
      bill_to_place: billToPlace,
      bill_to_pincode: billToPincode,
      party_phone: partyPhone,
      party_email: "",

      ship_to_name: showShipTo ? shipToName : "",
      ship_to_gstin: "",
      ship_to_address: showShipTo ? shipToAddress : "",
      ship_to_place: showShipTo ? shipToPlace : "",
      ship_to_pincode: showShipTo ? shipToPincode : "",
      ship_to_state_code: showShipTo ? shipToStateCode : "",

      dispatch_from_name: showDispatch ? dispatchName : "",
      dispatch_from_address: showDispatch ? dispatchAddress : "",
      dispatch_from_place: showDispatch ? dispatchPlace : "",
      dispatch_from_pincode: showDispatch ? dispatchPincode : "",
      dispatch_from_state_code: showDispatch ? dispatchStateCode : "",

      place_of_supply_code: placeOfSupply,
      other_charges: Number(otherCharges || 0),

      transporter_name: transporterName,
      transporter_id: transporterId,
      transport_mode: transportMode,
      vehicle_no: vehicleNo,
      vehicle_type: vehicleType,
      distance_km: Number(distanceKm || 0),
      transport_doc_no: "",
      transport_doc_date: "",

      notes,

      items: lines
        .filter((line) => line.item_name.trim())
        .map((line, index) => ({
          line_no: index + 1,
          item_id: line.item_id,
          item_name: line.item_name,
          description: line.description,
          hsn: line.hsn,
          unit: line.unit,
          quantity: Number(line.quantity || 0),
          rate: Number(line.rate || 0),
          discount: Number(line.discount || 0),
          gst_rate: Number(line.gst_rate || 0),
        })),
    };

    startTransition(async () => {
      try {
        const saved = invoice
          ? await updateSoyaInvoiceAction(invoice.id, payload)
          : await createSoyaInvoiceAction(payload);
        toast.success(`Invoice ${saved.invoice_no} saved`);
        router.push(`/soya/invoices/${saved.id}`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not save the invoice");
      }
    });
  };

  return (
    <div className="space-y-5 pb-24">
      {/* ---------------------------------------------------- document */}
      <Section title="Invoice">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Invoice number" htmlFor="inv-no">
            <Input
              id="inv-no"
              value={invoiceNo}
              onChange={(event) => setInvoiceNo(event.target.value)}
              className={fieldClass}
            />
            {invoiceNo.length > 16 ? (
              <Hint tone="bad">
                The portal allows at most 16 characters ({invoiceNo.length} now)
              </Hint>
            ) : null}
          </Field>
          <Field label="Date" htmlFor="inv-date">
            <Input
              id="inv-date"
              type="date"
              value={invoiceDate}
              onChange={(event) => setInvoiceDate(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Document type" htmlFor="inv-type">
            <select
              id="inv-type"
              value={docType}
              onChange={(event) => setDocType(event.target.value as typeof docType)}
              className={selectClass}
            >
              <option value="INV">Tax Invoice</option>
              <option value="CRN">Credit Note</option>
              <option value="DBN">Debit Note</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* ------------------------------------------------------- buyer */}
      <Section title="Bill to">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Party" htmlFor="inv-party">
            <select
              id="inv-party"
              value={partyId}
              onChange={(event) => choosePartyFromMaster(event.target.value)}
              className={selectClass}
            >
              <option value="">— choose from master —</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name on the invoice" htmlFor="inv-party-name">
            <Input
              id="inv-party-name"
              value={partyName}
              onChange={(event) => setPartyName(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Legal name" htmlFor="inv-party-legal">
            <Input
              id="inv-party-legal"
              value={partyLegalName}
              onChange={(event) => setPartyLegalName(event.target.value)}
              placeholder="Leave blank to use the name above"
              className={fieldClass}
            />
          </Field>
          <Field label="GSTIN" htmlFor="inv-party-gstin">
            <Input
              id="inv-party-gstin"
              value={partyGstin}
              onChange={(event) => {
                const next = event.target.value.toUpperCase();
                setPartyGstin(next);
                const derived = stateCodeFromGstin(next);
                if (derived) {
                  setPartyStateCode(derived);
                  setPlaceOfSupply(derived);
                }
              }}
              className={cn(
                fieldClass,
                "font-mono",
                gstinCheck && !gstinCheck.valid && "border-red-500/60",
              )}
            />
            {gstinCheck ? (
              gstinCheck.valid ? (
                <Hint tone="good">{gstinCheck.stateName}</Hint>
              ) : (
                <Hint tone="bad">{gstinCheck.reason}</Hint>
              )
            ) : null}
          </Field>
          <Field label="Registration" htmlFor="inv-party-reg">
            <select
              id="inv-party-reg"
              value={registrationType}
              onChange={(event) => setRegistrationType(event.target.value)}
              className={selectClass}
            >
              <option value="regular">Regular</option>
              <option value="composition">Composition</option>
              <option value="unregistered">Unregistered</option>
              <option value="consumer">Consumer</option>
            </select>
          </Field>
          <Field label="Phone" htmlFor="inv-party-phone">
            <Input
              id="inv-party-phone"
              value={partyPhone}
              onChange={(event) => setPartyPhone(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address" htmlFor="inv-bill-addr">
              <Input
                id="inv-bill-addr"
                value={billToAddress}
                onChange={(event) => setBillToAddress(event.target.value)}
                className={fieldClass}
              />
            </Field>
          </div>
          <Field label="Place" htmlFor="inv-bill-place">
            <Input
              id="inv-bill-place"
              value={billToPlace}
              onChange={(event) => setBillToPlace(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Pincode" htmlFor="inv-bill-pin">
            <Input
              id="inv-bill-pin"
              value={billToPincode}
              onChange={(event) =>
                setBillToPincode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              className={fieldClass}
            />
          </Field>
        </div>
      </Section>

      {/* --------------------------------------------- place of supply */}
      <Section title="Place of supply">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="State whose tax is charged" htmlFor="inv-pos">
            <select
              id="inv-pos"
              value={placeOfSupply}
              onChange={(event) => setPlaceOfSupply(event.target.value)}
              className={cn(selectClass, !placeOfSupply && "border-red-500/60")}
            >
              <option value="">— choose —</option>
              {GST_STATE_OPTIONS.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.code} — {state.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <div
              className={cn(
                "w-full rounded-md border px-3 py-2 text-sm",
                totals.kind === "intra"
                  ? "border-emerald-700/40 bg-emerald-950/30 text-emerald-200"
                  : "border-sky-700/40 bg-sky-950/30 text-sky-200",
              )}
            >
              {placeOfSupply ? (
                totals.kind === "intra" ? (
                  <>
                    <strong>CGST + SGST</strong> — {stateNameForCode(company.state_code)}{" "}
                    supplier, {stateNameForCode(placeOfSupply)} place of supply
                  </>
                ) : (
                  <>
                    <strong>IGST</strong> — {stateNameForCode(company.state_code)} supplier,{" "}
                    {stateNameForCode(placeOfSupply)} place of supply
                  </>
                )
              ) : (
                "Choose a place of supply to see which tax applies"
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------- lines */}
      <Section title="Items">
        <div className="space-y-3">
          {lines.map((line, index) => {
            const computed = totals.lines[index];
            return (
              <div
                key={line.key}
                className="rounded-lg border border-[#2a2d34] bg-[#111214] p-3"
              >
                <div className="grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-3">
                    <Field label="Item" htmlFor={`line-item-${line.key}`}>
                      <select
                        id={`line-item-${line.key}`}
                        value={line.item_id}
                        onChange={(event) => chooseItem(line.key, event.target.value)}
                        className={selectClass}
                      >
                        <option value="">— choose —</option>
                        {items
                          .filter((item) => item.is_active)
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="HSN" htmlFor={`line-hsn-${line.key}`}>
                      <Input
                        id={`line-hsn-${line.key}`}
                        value={line.hsn}
                        onChange={(event) =>
                          setLine(line.key, { hsn: event.target.value.replace(/\D/g, "") })
                        }
                        className={cn(fieldClass, "font-mono", !line.hsn && line.item_name && "border-amber-600/60")}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-1">
                    <Field label="Unit" htmlFor={`line-unit-${line.key}`}>
                      <select
                        id={`line-unit-${line.key}`}
                        value={line.unit}
                        onChange={(event) => setLine(line.key, { unit: event.target.value })}
                        className={selectClass}
                      >
                        {UQC_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.value}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Quantity" htmlFor={`line-qty-${line.key}`}>
                      <Input
                        id={`line-qty-${line.key}`}
                        value={line.quantity}
                        onChange={(event) => setLine(line.key, { quantity: event.target.value })}
                        inputMode="decimal"
                        className={fieldClass}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-2">
                    <Field label="Rate" htmlFor={`line-rate-${line.key}`}>
                      <Input
                        id={`line-rate-${line.key}`}
                        value={line.rate}
                        onChange={(event) => setLine(line.key, { rate: event.target.value })}
                        inputMode="decimal"
                        className={fieldClass}
                      />
                    </Field>
                  </div>
                  <div className="sm:col-span-1">
                    <Field label="GST %" htmlFor={`line-gst-${line.key}`}>
                      <Input
                        id={`line-gst-${line.key}`}
                        value={line.gst_rate}
                        onChange={(event) => setLine(line.key, { gst_rate: event.target.value })}
                        inputMode="decimal"
                        className={fieldClass}
                      />
                    </Field>
                  </div>
                  <div className="flex items-end justify-end sm:col-span-1">
                    <button
                      type="button"
                      onClick={() =>
                        setLines((current) =>
                          current.length === 1
                            ? [emptyLine()]
                            : current.filter((candidate) => candidate.key !== line.key),
                        )
                      }
                      aria-label="Remove line"
                      className="cursor-pointer rounded-md p-2 text-zinc-500 hover:bg-[#2a1616] hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {computed && computed.taxable_value > 0 ? (
                  <p className="mt-2 border-t border-[#2a2d34] pt-2 text-right text-xs tabular-nums text-zinc-500">
                    Taxable ₹{formatNumberIN(computed.taxable_value, { minimumFractionDigits: 2 })}
                    {" · "}
                    {totals.kind === "intra"
                      ? `CGST ₹${formatNumberIN(computed.cgst, { minimumFractionDigits: 2 })} + SGST ₹${formatNumberIN(computed.sgst, { minimumFractionDigits: 2 })}`
                      : `IGST ₹${formatNumberIN(computed.igst, { minimumFractionDigits: 2 })}`}
                    {" · "}
                    <span className="text-zinc-300">
                      ₹{formatNumberIN(computed.total_value, { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                ) : null}
              </div>
            );
          })}

          <Button
            variant="outline"
            onClick={() => setLines((current) => [...current, emptyLine()])}
            className="cursor-pointer border-[#2a2d34] bg-transparent text-zinc-300 hover:bg-[#1b1e24]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add line
          </Button>
        </div>
      </Section>

      {/* -------------------------------------------- optional addresses */}
      <Section title="Ship to and dispatch from">
        <div className="space-y-4">
          <Toggle
            checked={showShipTo}
            onChange={setShowShipTo}
            label="Goods go to a different address from the billing address"
          />
          {showShipTo ? (
            <div className="grid gap-4 rounded-lg border border-[#2a2d34] bg-[#111214] p-3 sm:grid-cols-2">
              <Field label="Consignee name" htmlFor="ship-name">
                <Input id="ship-name" value={shipToName} onChange={(e) => setShipToName(e.target.value)} className={fieldClass} />
              </Field>
              <Field label="Address" htmlFor="ship-addr">
                <Input id="ship-addr" value={shipToAddress} onChange={(e) => setShipToAddress(e.target.value)} className={fieldClass} />
              </Field>
              <Field label="Place" htmlFor="ship-place">
                <Input id="ship-place" value={shipToPlace} onChange={(e) => setShipToPlace(e.target.value)} className={fieldClass} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pincode" htmlFor="ship-pin">
                  <Input id="ship-pin" value={shipToPincode} onChange={(e) => setShipToPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" className={fieldClass} />
                </Field>
                <Field label="State" htmlFor="ship-state">
                  <select id="ship-state" value={shipToStateCode} onChange={(e) => setShipToStateCode(e.target.value)} className={selectClass}>
                    <option value="">—</option>
                    {GST_STATE_OPTIONS.map((state) => (
                      <option key={state.code} value={state.code}>{state.name}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
          ) : null}

          <Toggle
            checked={showDispatch}
            onChange={setShowDispatch}
            label="Goods leave from somewhere other than our own premises"
          />
          {showDispatch ? (
            <div className="space-y-3 rounded-lg border border-[#2a2d34] bg-[#111214] p-3">
              <p className="rounded-md border border-[#2a3a44] bg-[#0f1a1f] px-3 py-2 text-xs text-sky-200/80">
                This is an e-Way Bill address only. It does <strong>not</strong> change
                the tax — a load leaving a mill in Maharashtra for a Karnataka buyer
                is still a local Karnataka sale when both registrations are Karnataka.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="disp-name">
                  <Input id="disp-name" value={dispatchName} onChange={(e) => setDispatchName(e.target.value)} placeholder="LATUR" className={fieldClass} />
                </Field>
                <Field label="Address" htmlFor="disp-addr">
                  <Input id="disp-addr" value={dispatchAddress} onChange={(e) => setDispatchAddress(e.target.value)} placeholder="MIDC LATUR" className={fieldClass} />
                </Field>
                <Field label="Place" htmlFor="disp-place">
                  <Input id="disp-place" value={dispatchPlace} onChange={(e) => setDispatchPlace(e.target.value)} className={fieldClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Pincode" htmlFor="disp-pin">
                    <Input id="disp-pin" value={dispatchPincode} onChange={(e) => setDispatchPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" className={fieldClass} />
                  </Field>
                  <Field label="State" htmlFor="disp-state">
                    <select id="disp-state" value={dispatchStateCode} onChange={(e) => setDispatchStateCode(e.target.value)} className={selectClass}>
                      <option value="">—</option>
                      {GST_STATE_OPTIONS.map((state) => (
                        <option key={state.code} value={state.code}>{state.name}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Section>

      {/* --------------------------------------------------- transport */}
      <Section
        title="Transport"
        subtitle={
          ewbRequired
            ? `Required — this invoice is over ₹${formatNumberIN(EWB_THRESHOLD_RUPEES)}, so an e-Way Bill must accompany it`
            : `Optional below ₹${formatNumberIN(EWB_THRESHOLD_RUPEES)}`
        }
        icon={<Truck className="h-4 w-4" />}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Mode" htmlFor="tr-mode">
            <select id="tr-mode" value={transportMode} onChange={(e) => setTransportMode(e.target.value)} className={selectClass}>
              <option value="">—</option>
              {TRANSPORT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Vehicle number" htmlFor="tr-vehicle">
            <Input
              id="tr-vehicle"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
              placeholder="KA28AB3276"
              className={cn(fieldClass, "font-mono", vehicleProblem && "border-red-500/60")}
            />
            {vehicleProblem ? <Hint tone="bad">{vehicleProblem}</Hint> : null}
          </Field>
          <Field label="Vehicle type" htmlFor="tr-vtype">
            <select id="tr-vtype" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={selectClass}>
              {VEHICLE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Transporter name" htmlFor="tr-name">
            <Input id="tr-name" value={transporterName} onChange={(e) => setTransporterName(e.target.value)} className={fieldClass} />
          </Field>
          <Field label="Transporter ID (GSTIN)" htmlFor="tr-id">
            <Input id="tr-id" value={transporterId} onChange={(e) => setTransporterId(e.target.value.toUpperCase())} className={cn(fieldClass, "font-mono")} />
          </Field>
          <Field label="Distance (km)" htmlFor="tr-dist">
            <Input id="tr-dist" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="250" className={fieldClass} />
            <Hint tone="muted">Leave blank and the portal computes it from the pincodes</Hint>
          </Field>
        </div>
      </Section>

      {/* ------------------------------------------------------ totals */}
      <Section title="Totals">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <Field label="Other charges (not taxed)" htmlFor="inv-other">
              <Input id="inv-other" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} inputMode="decimal" className={fieldClass} />
            </Field>
            <Field label="Notes" htmlFor="inv-notes">
              <Input id="inv-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} />
            </Field>
          </div>

          <dl className="space-y-1.5 rounded-lg border border-[#2a2d34] bg-[#111214] p-4 text-sm tabular-nums">
            <Row label="Taxable value" value={totals.taxable_value} />
            {totals.kind === "intra" ? (
              <>
                <Row label="CGST" value={totals.cgst} />
                <Row label="SGST" value={totals.sgst} />
              </>
            ) : (
              <Row label="IGST" value={totals.igst} />
            )}
            {totals.other_charges ? <Row label="Other charges" value={totals.other_charges} /> : null}
            <Row label="Round off" value={totals.round_off} />
            <div className="mt-2 flex items-baseline justify-between border-t border-[#2a2d34] pt-2">
              <dt className="font-semibold text-zinc-200">Invoice total</dt>
              <dd className="text-lg font-bold text-[#ff8f6b]">
                ₹{formatNumberIN(totals.total_value)}
              </dd>
            </div>
          </dl>
        </div>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[#2a2d34] bg-[#0f1013]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <p className="text-sm text-zinc-500">
            {company.name}
            {company.gstin ? ` · ${company.gstin}` : " · no GSTIN yet"}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              disabled={isPending}
              className="cursor-pointer text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={isPending}
              className="cursor-pointer bg-[#ff6a3d] text-white hover:bg-[#ff7f57]"
            >
              {isPending ? "Saving…" : invoice ? "Save changes" : "Create invoice"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- helpers */

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#2a2d34] bg-[#14161b] p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon ? <span className="text-[#ff8f6b]">{icon}</span> : null}
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">
          {title}
        </h2>
      </div>
      {subtitle ? <p className="-mt-2 mb-3 text-xs text-zinc-500">{subtitle}</p> : null}
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs text-zinc-400">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Hint({ tone, children }: { tone: "good" | "bad" | "muted"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "text-xs",
        tone === "good" && "text-emerald-400",
        tone === "bad" && "text-red-400",
        tone === "muted" && "text-zinc-600",
      )}
    >
      {children}
    </p>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="cursor-pointer accent-[#ff6a3d]"
      />
      {label}
    </label>
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
