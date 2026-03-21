import { addDays, isValid, parseISO } from "date-fns";

import { CompanyPayment, CompanyPaymentAllocation } from "@/features/companies/schemas";
import { Sale } from "@/features/sales/schemas";

type PendingResult = {
  pendingBySaleId: Record<string, number>;
  allocatedBySaleId: Record<string, number>;
};

const parseTermDays = (terms: string | null | undefined) => {
  const parsed = Number.parseInt(String(terms ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const getDueTime = (sale: Sale) => {
  const saleDate = parseISO(sale.sale_date);
  if (!isValid(saleDate)) return Number.MAX_SAFE_INTEGER;
  return addDays(saleDate, parseTermDays(sale.payment_terms)).getTime();
};

const getSaleTime = (sale: Sale) => {
  const saleDate = parseISO(sale.sale_date);
  if (!isValid(saleDate)) return Number.MAX_SAFE_INTEGER;
  return saleDate.getTime();
};

const getPaymentTime = (payment: CompanyPayment) => {
  const paidOn = parseISO(payment.paid_on);
  if (!isValid(paidOn)) return Number.MAX_SAFE_INTEGER;
  return paidOn.getTime();
};

export function computeEffectiveSalePending(
  sales: Sale[],
  payments: CompanyPayment[],
  allocations: CompanyPaymentAllocation[]
): PendingResult {
  const saleById = new Map(sales.map((sale) => [sale.id, sale]));
  const paymentById = new Map(payments.map((payment) => [payment.id, payment]));

  const explicitAllocatedBySaleId = new Map<string, number>();
  const explicitAllocatedByPaymentId = new Map<string, number>();

  for (const allocation of allocations) {
    if (!saleById.has(allocation.sale_id) || !paymentById.has(allocation.payment_id)) {
      continue;
    }
    explicitAllocatedBySaleId.set(
      allocation.sale_id,
      (explicitAllocatedBySaleId.get(allocation.sale_id) ?? 0) + allocation.amount
    );
    explicitAllocatedByPaymentId.set(
      allocation.payment_id,
      (explicitAllocatedByPaymentId.get(allocation.payment_id) ?? 0) + allocation.amount
    );
  }

  const remainingBySaleId = new Map<string, number>();
  const allocatedBySaleId = new Map<string, number>();
  for (const sale of sales) {
    const explicit = explicitAllocatedBySaleId.get(sale.id) ?? 0;
    const remaining = Math.max(sale.pending_amount - explicit, 0);
    remainingBySaleId.set(sale.id, remaining);
    allocatedBySaleId.set(sale.id, Math.max(explicit, 0));
  }

  const saleIdsByCompanyId = new Map<string, string[]>();
  for (const sale of sales) {
    if (!sale.sale_company_id) continue;
    const current = saleIdsByCompanyId.get(sale.sale_company_id) ?? [];
    current.push(sale.id);
    saleIdsByCompanyId.set(sale.sale_company_id, current);
  }

  const paymentsByCompanyId = new Map<string, CompanyPayment[]>();
  for (const payment of payments) {
    const current = paymentsByCompanyId.get(payment.company_id) ?? [];
    current.push(payment);
    paymentsByCompanyId.set(payment.company_id, current);
  }

  for (const [companyId, saleIds] of saleIdsByCompanyId) {
    const companyPayments = paymentsByCompanyId.get(companyId) ?? [];
    if (companyPayments.length === 0) continue;

    const sortedSaleIds = [...saleIds].sort((a, b) => {
      const saleA = saleById.get(a);
      const saleB = saleById.get(b);
      if (!saleA || !saleB) return 0;
      const dueDiff = getDueTime(saleA) - getDueTime(saleB);
      if (dueDiff !== 0) return dueDiff;
      const saleDateDiff = getSaleTime(saleA) - getSaleTime(saleB);
      if (saleDateDiff !== 0) return saleDateDiff;
      const billNoDiff =
        Number.parseInt(saleA.bill_number, 10) - Number.parseInt(saleB.bill_number, 10);
      if (Number.isFinite(billNoDiff) && billNoDiff !== 0) return billNoDiff;
      return saleA.id.localeCompare(saleB.id);
    });

    const sortedPayments = [...companyPayments].sort((a, b) => {
      const paidDiff = getPaymentTime(a) - getPaymentTime(b);
      if (paidDiff !== 0) return paidDiff;
      return a.id.localeCompare(b.id);
    });

    let saleIndex = 0;
    for (const payment of sortedPayments) {
      let unallocatedAmount = Math.max(
        payment.amount - (explicitAllocatedByPaymentId.get(payment.id) ?? 0),
        0
      );
      while (unallocatedAmount > 0 && saleIndex < sortedSaleIds.length) {
        const saleId = sortedSaleIds[saleIndex];
        const saleRemaining = remainingBySaleId.get(saleId) ?? 0;
        if (saleRemaining <= 0) {
          saleIndex += 1;
          continue;
        }
        const applied = Math.min(unallocatedAmount, saleRemaining);
        remainingBySaleId.set(saleId, saleRemaining - applied);
        allocatedBySaleId.set(saleId, (allocatedBySaleId.get(saleId) ?? 0) + applied);
        unallocatedAmount -= applied;
        if ((remainingBySaleId.get(saleId) ?? 0) <= 0) {
          saleIndex += 1;
        }
      }
    }
  }

  const pendingBySaleId: Record<string, number> = {};
  const allocatedBySaleRecord: Record<string, number> = {};
  for (const sale of sales) {
    const allocated = allocatedBySaleId.get(sale.id) ?? 0;
    pendingBySaleId[sale.id] = Math.max(sale.pending_amount - allocated, 0);
    allocatedBySaleRecord[sale.id] = Math.max(allocated, 0);
  }

  return {
    pendingBySaleId,
    allocatedBySaleId: allocatedBySaleRecord,
  };
}
