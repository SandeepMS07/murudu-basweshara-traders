import { type Bilty, type BiltyInput } from "@/features/bilty/schemas";

function round2(value: number): number {
  return Number((value || 0).toFixed(2));
}

export function calculateBilty(input: BiltyInput, id: string): Bilty {
  const less_weight = round2((input.weight * input.less_percent) / 100);
  const net_weight = round2(input.weight - less_weight);
  const amount = round2((net_weight * input.rate) / 100);
  const final_total = round2(
    amount - input.bag_less + input.add_amount - input.cash_paid - input.upi_paid
  );
  const bag_avg = round2(input.bags > 0 ? net_weight / input.bags : 0);

  return {
    ...input,
    id,
    less_weight,
    net_weight,
    amount,
    final_total,
    bag_avg,
    name: input.party,
    place: "",
    mob: "",
  };
}
