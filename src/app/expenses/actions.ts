"use server";

import { employeeSchema, expenseSchema } from "@/features/expenses/schemas";
import {
  createExpense,
  createExpenseEmployee,
  deleteExpense,
  deleteExpenseEmployee,
  updateExpense,
  updateExpenseEmployee,
} from "@/features/expenses/service/expense.service";

export async function createExpenseEmployeeAction(data: unknown) {
  const parsed = employeeSchema.parse(data);
  return createExpenseEmployee(parsed);
}

export async function createExpenseAction(data: unknown) {
  const parsed = expenseSchema.parse(data);
  return createExpense(parsed);
}

export async function updateExpenseAction(id: string, data: unknown) {
  const parsed = expenseSchema.parse(data);
  return updateExpense(id, parsed);
}

export async function deleteExpenseAction(id: string) {
  return deleteExpense(id);
}

export async function updateExpenseEmployeeAction(id: string, data: unknown) {
  const parsed = employeeSchema.parse(data);
  return updateExpenseEmployee(id, parsed);
}

export async function deleteExpenseEmployeeAction(id: string) {
  return deleteExpenseEmployee(id);
}
