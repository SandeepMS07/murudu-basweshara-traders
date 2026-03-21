import { requireAuth } from "@/features/auth/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import {
  EmployeeInput,
  ExpenseCategory,
  ExpenseEmployee,
  ExpenseEntry,
  ExpenseInput,
} from "@/features/expenses/schemas";

type ExpenseEmployeeRow = {
  id: string;
  name: string;
  is_active: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ExpenseEntryRow = {
  id: string;
  category: ExpenseCategory;
  expense_date: string;
  employee_id: string | null;
  reason: string | null;
  amount: number | string;
  created_at?: string | null;
  updated_at?: string | null;
};

function n(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toEmployee(row: ExpenseEmployeeRow): ExpenseEmployee {
  return {
    id: row.id,
    name: row.name,
    is_active: row.is_active ?? true,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

function toExpense(row: ExpenseEntryRow): ExpenseEntry {
  return {
    id: row.id,
    category: row.category,
    expense_date: row.expense_date,
    employee_id: row.employee_id,
    reason: row.reason ?? "",
    amount: n(row.amount),
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  };
}

async function ensureDefaultEmployees() {
  const { data, error } = await supabaseServer
    .from("expense_employees")
    .select("id")
    .in("name", ["chikka", "varun"])
    .limit(2);

  if (error) {
    throw new Error(`Failed to check default employees: ${error.message}`);
  }

  const existingCount = (data ?? []).length;
  if (existingCount === 2) return;

  const now = new Date().toISOString();
  const defaultRows = [
    { id: crypto.randomUUID(), name: "chikka", is_active: true, created_at: now, updated_at: now },
    { id: crypto.randomUUID(), name: "varun", is_active: true, created_at: now, updated_at: now },
  ];

  const { error: insertError } = await supabaseServer
    .from("expense_employees")
    .upsert(defaultRows, { onConflict: "name", ignoreDuplicates: true });

  if (insertError) {
    throw new Error(`Failed to seed default employees: ${insertError.message}`);
  }
}

export async function getExpenseEmployees(): Promise<ExpenseEmployee[]> {
  await requireAuth();
  await ensureDefaultEmployees();

  const { data, error } = await supabaseServer
    .from("expense_employees")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load employees: ${error.message}`);
  }

  return (data as ExpenseEmployeeRow[]).map(toEmployee);
}

export async function getExpenses(): Promise<ExpenseEntry[]> {
  await requireAuth();
  await ensureDefaultEmployees();

  const { data, error } = await supabaseServer
    .from("expenses")
    .select("*")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load expenses: ${error.message}`);
  }

  return (data as ExpenseEntryRow[]).map(toExpense);
}

export async function createExpenseEmployee(input: EmployeeInput): Promise<ExpenseEmployee> {
  await requireAuth();

  const payload = {
    id: crypto.randomUUID(),
    name: input.name.trim().toLowerCase(),
    is_active: input.is_active ?? true,
  };

  const { data, error } = await supabaseServer
    .from("expense_employees")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create employee: ${error.message}`);
  }

  return toEmployee(data as ExpenseEmployeeRow);
}

export async function updateExpenseEmployee(id: string, input: EmployeeInput): Promise<ExpenseEmployee> {
  await requireAuth();

  const payload = {
    name: input.name.trim().toLowerCase(),
    is_active: input.is_active ?? true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("expense_employees")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update employee: ${error.message}`);
  }

  return toEmployee(data as ExpenseEmployeeRow);
}

export async function deleteExpenseEmployee(id: string): Promise<void> {
  await requireAuth();

  const { error } = await supabaseServer
    .from("expense_employees")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to delete employee: ${error.message}`);
  }
}

export async function createExpense(input: ExpenseInput): Promise<ExpenseEntry> {
  await requireAuth();

  const payload = {
    id: crypto.randomUUID(),
    category: input.category,
    expense_date: input.expense_date,
    employee_id: input.category === "salary" ? (input.employee_id?.trim() || null) : null,
    reason: input.reason ?? "",
    amount: input.amount,
  };

  const { data, error } = await supabaseServer
    .from("expenses")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create expense: ${error.message}`);
  }

  return toExpense(data as ExpenseEntryRow);
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ExpenseEntry> {
  await requireAuth();

  const payload = {
    category: input.category,
    expense_date: input.expense_date,
    employee_id: input.category === "salary" ? (input.employee_id?.trim() || null) : null,
    reason: input.reason ?? "",
    amount: input.amount,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseServer
    .from("expenses")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to update expense: ${error.message}`);
  }

  return toExpense(data as ExpenseEntryRow);
}

export async function deleteExpense(id: string): Promise<void> {
  await requireAuth();

  const { error } = await supabaseServer.from("expenses").delete().eq("id", id);

  if (error) {
    throw new Error(`Failed to delete expense: ${error.message}`);
  }
}
