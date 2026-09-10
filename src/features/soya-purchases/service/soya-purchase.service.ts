import { createSoyaTradeService } from "@/features/soya-trade/service/create-soya-trade-service";
import { createSoyaPaymentService } from "@/features/soya-companies/service/create-soya-payment-service";

/**
 * Soya Purchases: the buy side. Same sales-shaped record as Soya Sales, against
 * its own table, with suppliers as the counterparty.
 */
const service = createSoyaTradeService({
  table: "soya_purchases",
  partyType: "supplier",
  entityLabel: "purchase",
});

export const getSoyaPurchases = service.getAll;
export const getSoyaPurchaseById = service.getById;
export const createSoyaPurchase = service.create;
export const updateSoyaPurchase = service.update;
export const deleteSoyaPurchase = service.remove;
export const getSoyaSuppliers = service.getPartyCompanies;
export const getSoyaPurchaseIssuers = service.getIssuerCompanies;
export const getNextSoyaPurchaseIdentifiersForDate =
  service.getNextIdentifiersForDate;

const payments = createSoyaPaymentService({
  paymentsTable: "soya_purchase_payments",
  allocationsTable: "soya_purchase_payment_allocations",
  recordsTable: "soya_purchases",
});

export const getSoyaSupplierPayments = payments.getPayments;
export const getSoyaSupplierPaymentAllocations = payments.getAllocations;
export const createSoyaSupplierPayment = payments.createPayment;
export const deleteSoyaSupplierPayment = payments.deletePayment;
