import { requireRole } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type {
  CompanyPayment,
  CompanyPaymentAllocation,
  CompanyPaymentInput,
} from "@/features/companies/schemas";

type PaymentRow = {
  id: string;
  company_id: string;
  paid_on: string;
  amount: number | string;
  payment_mode: "none" | "cash" | "rtgs" | null;
  rtgs_name: string | null;
  note: string | null;
  credit_hold_amount: number | string | null;
  created_at?: string;
  updated_at?: string;
};

type AllocationRow = {
  id: string;
  payment_id: string;
  sale_id: string;
  amount: number | string;
  created_at?: string;
  updated_at?: string;
};

export type SoyaPaymentServiceConfig = {
  /** e.g. "soya_purchase_payments" */
  paymentsTable: string;
  /** e.g. "soya_purchase_payment_allocations" */
  allocationsTable: string;
  /** Records the allocations point at, e.g. "soya_purchases" */
  recordsTable: string;
};

function n(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Payment ledger for one Soya module. The row types are the maize
 * CompanyPayment/CompanyPaymentAllocation on purpose — that is what lets the
 * shared FIFO allocator (computeEffectiveSalePending) and CompanyStatementView
 * consume Soya ledgers unchanged.
 */
export function createSoyaPaymentService(config: SoyaPaymentServiceConfig) {
  const { paymentsTable, allocationsTable, recordsTable } = config;

  function toPayment(row: PaymentRow): CompanyPayment {
    return {
      id: row.id,
      company_id: row.company_id,
      paid_on: row.paid_on,
      amount: n(row.amount),
      payment_mode: row.payment_mode ?? "none",
      rtgs_name: row.rtgs_name ?? "",
      note: row.note ?? "",
      credit_hold_amount: n(row.credit_hold_amount),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  function toAllocation(row: AllocationRow): CompanyPaymentAllocation {
    return {
      id: row.id,
      payment_id: row.payment_id,
      sale_id: row.sale_id,
      amount: n(row.amount),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async function getPayments(companyId?: string): Promise<CompanyPayment[]> {
    let query = supabaseServer
      .from(paymentsTable)
      .select("*")
      .order("paid_on", { ascending: false })
      .order("created_at", { ascending: false });

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to load soya payments: ${error.message}`);
    }
    return ((data as PaymentRow[]) ?? []).map(toPayment);
  }

  async function getAllocations(
    recordIds?: string[],
  ): Promise<CompanyPaymentAllocation[]> {
    let query = supabaseServer
      .from(allocationsTable)
      .select("*")
      .order("created_at", { ascending: false });

    if (recordIds && recordIds.length > 0) {
      query = query.in("sale_id", recordIds);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to load soya payment allocations: ${error.message}`);
    }
    return ((data as AllocationRow[]) ?? []).map(toAllocation);
  }

  async function createPayment(input: CompanyPaymentInput): Promise<{
    payment: CompanyPayment;
    allocations: CompanyPaymentAllocation[];
  }> {
    await requireRole(["admin"]);

    const allocations = (input.allocations ?? []).filter((item) => item.amount > 0);
    const recordIds = [...new Set(allocations.map((item) => item.sale_id))];
    const totalAllocated = allocations.reduce((sum, item) => sum + item.amount, 0);
    const creditHoldAmount = input.credit_hold_amount ?? 0;

    if (totalAllocated + creditHoldAmount > input.amount) {
      throw new Error(
        "Allocated amount plus credit hold cannot exceed payment amount",
      );
    }

    if (recordIds.length > 0) {
      const { data: recordRows, error: recordsError } = await supabaseServer
        .from(recordsTable)
        .select("id, sale_company_id, pending_amount")
        .in("id", recordIds);

      if (recordsError) {
        throw new Error(`Failed to validate allocations: ${recordsError.message}`);
      }

      const recordMap = new Map(
        (
          (recordRows as Array<{
            id: string;
            sale_company_id: string | null;
            pending_amount: number | string;
          }>) ?? []
        ).map((row) => [row.id, row]),
      );

      if (recordMap.size !== recordIds.length) {
        throw new Error("Some selected bills for allocation were not found");
      }

      for (const recordId of recordIds) {
        const record = recordMap.get(recordId);
        if (!record || record.sale_company_id !== input.company_id) {
          throw new Error("Allocated bills must belong to the selected party");
        }
      }

      const { data: existingRows, error: existingError } = await supabaseServer
        .from(allocationsTable)
        .select("sale_id, amount")
        .in("sale_id", recordIds);

      if (existingError) {
        throw new Error(
          `Failed to validate existing allocations: ${existingError.message}`,
        );
      }

      const allocatedByRecord = new Map<string, number>();
      for (const row of (existingRows as Array<{
        sale_id: string;
        amount: number | string;
      }>) ?? []) {
        allocatedByRecord.set(
          row.sale_id,
          (allocatedByRecord.get(row.sale_id) ?? 0) + n(row.amount),
        );
      }

      for (const alloc of allocations) {
        const record = recordMap.get(alloc.sale_id);
        if (!record) continue;
        const remaining = Math.max(
          n(record.pending_amount) - (allocatedByRecord.get(alloc.sale_id) ?? 0),
          0,
        );
        if (alloc.amount > remaining) {
          throw new Error(
            `Allocation exceeds remaining pending for bill ${alloc.sale_id}`,
          );
        }
      }
    }

    const paymentId = input.id ?? crypto.randomUUID();
    const { data, error } = await supabaseServer
      .from(paymentsTable)
      .insert({
        id: paymentId,
        company_id: input.company_id,
        paid_on: input.paid_on,
        amount: input.amount,
        payment_mode: input.payment_mode,
        rtgs_name: input.payment_mode === "rtgs" ? input.rtgs_name : "",
        note: input.note || "",
        credit_hold_amount: creditHoldAmount,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Failed to create soya payment: ${error.message}`);
    }

    let createdAllocations: CompanyPaymentAllocation[] = [];
    if (allocations.length > 0) {
      const { data: allocData, error: allocError } = await supabaseServer
        .from(allocationsTable)
        .insert(
          allocations.map((item) => ({
            id: crypto.randomUUID(),
            payment_id: paymentId,
            sale_id: item.sale_id,
            amount: item.amount,
            updated_at: new Date().toISOString(),
          })),
        )
        .select("*");

      if (allocError) {
        await supabaseServer.from(paymentsTable).delete().eq("id", paymentId);
        throw new Error(
          `Failed to create payment allocations: ${allocError.message}`,
        );
      }
      createdAllocations = ((allocData as AllocationRow[]) ?? []).map(toAllocation);
    }

    return { payment: toPayment(data as PaymentRow), allocations: createdAllocations };
  }

  async function deletePayment(id: string): Promise<void> {
    await requireRole(["admin"]);

    const { error: allocError } = await supabaseServer
      .from(allocationsTable)
      .delete()
      .eq("payment_id", id);
    if (allocError) {
      throw new Error(`Failed to delete payment allocations: ${allocError.message}`);
    }

    const { error } = await supabaseServer
      .from(paymentsTable)
      .delete()
      .eq("id", id);
    if (error) {
      throw new Error(`Failed to delete soya payment: ${error.message}`);
    }
  }

  return { getPayments, getAllocations, createPayment, deletePayment };
}
