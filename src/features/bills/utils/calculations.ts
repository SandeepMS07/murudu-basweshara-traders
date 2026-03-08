import { addDays, format, parseISO } from "date-fns";
import { BillInput, Bill } from "../schemas";

export function calculateBill(input: BillInput, id: string): Bill {
  const amount = Number((input.net_weight * input.rate).toFixed(2));
  const final_amount = Number((amount - input.freight).toFixed(2));
  
  // Calculate due date
  const parsedDate = parseISO(input.bill_date);
  const due_date = format(addDays(parsedDate, input.payment_term_days), "yyyy-MM-dd");

  return {
    ...input,
    id,
    amount,
    final_amount,
    due_date,
  };
}
