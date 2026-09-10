import { createSoyaTradeService } from "@/features/soya-trade/service/create-soya-trade-service";
import { createSoyaPaymentService } from "@/features/soya-companies/service/create-soya-payment-service";

/**
 * Soya Parties: the maize Sales record shape against its own soya_sales table,
 * with its own party directory. Nothing here touches a maize table.
 */
const service = createSoyaTradeService({
  table: "soya_sales",
  partyType: "buyer",
  entityLabel: "entry",
});

export const getSoyaPartyEntries = service.getAll;
export const getSoyaPartyEntryById = service.getById;
export const createSoyaPartyEntry = service.create;
export const updateSoyaPartyEntry = service.update;
export const deleteSoyaPartyEntry = service.remove;
export const getSoyaParties = service.getPartyCompanies;
export const getSoyaPartyIssuers = service.getIssuerCompanies;
export const getNextSoyaPartyIdentifiersForDate =
  service.getNextIdentifiersForDate;

const payments = createSoyaPaymentService({
  paymentsTable: "soya_sale_payments",
  allocationsTable: "soya_sale_payment_allocations",
  recordsTable: "soya_sales",
});

export const getSoyaPartyPayments = payments.getPayments;
export const getSoyaPartyPaymentAllocations = payments.getAllocations;
export const createSoyaPartyPayment = payments.createPayment;
export const deleteSoyaPartyPayment = payments.deletePayment;
