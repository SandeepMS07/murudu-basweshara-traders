import { Sale, SaleInput } from "@/features/sales/schemas";

function round2(value: number): number {
  return Number((value || 0).toFixed(2));
}

export function calculateSale(input: SaleInput, id: string): Sale {
  const bags = input.bags || 0;
  const netWeight = input.net_weight || 0;
  const rate = input.rate || 0;
  const flight = input.flight || 0;
  const factoryRate = input.factory_rate || 0;

  const amount = round2(netWeight * rate - flight);
  const computedBagAvg = bags > 0 ? round2(netWeight / bags) : 0;
  const bagAvg = round2(input.bag_avg ?? computedBagAvg);
  const factoryAmount = round2(netWeight * factoryRate);
  const pendingAmount = round2(amount - factoryAmount);

  return {
    id,
    sl_no: input.sl_no ?? null,
    bill_number: input.bill_number,
    sale_date: input.sale_date,
    issuer_company_id: input.issuer_company_id ?? null,
    lorry_number: input.lorry_number,
    party: input.party,
    sale_company_id: input.sale_company_id ?? null,
    payment_terms: input.payment_terms,
    bags: round2(bags),
    net_weight: round2(netWeight),
    factory_weight: round2(input.factory_weight || 0),
    rate: round2(rate),
    flight: round2(flight),
    bag_avg: bagAvg,
    factory_rate: round2(factoryRate),
    source: input.source,
    amount,
    factory_amount: factoryAmount,
    pending_amount: pendingAmount,
  };
}
