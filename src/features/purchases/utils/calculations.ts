import { PurchaseInput, Purchase } from "../schemas";

export function calculatePurchase(input: PurchaseInput, id: string): Purchase {
  const less_weight = Number(((input.weight * input.less_percent) / 100).toFixed(2));
  const net_weight = Number((input.weight - less_weight).toFixed(2));
  const amount = Number((net_weight * input.rate).toFixed(2));
  const final_total = Number(
    (amount - input.bag_less + input.add_amount - input.cash_paid - input.upi_paid).toFixed(2)
  );
  const bag_avg = Number((input.bags > 0 ? net_weight / input.bags : 0).toFixed(2));

  return {
    ...input,
    id,
    bill_no: 0,
    less_weight,
    net_weight,
    amount,
    final_total,
    bag_avg,
  };
}
