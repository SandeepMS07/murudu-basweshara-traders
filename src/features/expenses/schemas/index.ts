import { z } from "zod";

export const expenseCategoryEnum = z.enum(["salary", "vehicle", "hamali", "other"]);
export type ExpenseCategory = z.infer<typeof expenseCategoryEnum>;

export const employeeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Employee name is required"),
  is_active: z.boolean().default(true),
});

export type EmployeeInput = z.infer<typeof employeeSchema>;

export const expenseSchema = z.object({
  id: z.string().optional(),
  category: expenseCategoryEnum,
  expense_date: z.string().trim().min(1, "Date is required"),
  employee_id: z.string().trim().optional().default(""),
  reason: z.string().trim().default(""),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
});

export type ExpenseInput = z.infer<typeof expenseSchema>;

export interface ExpenseEmployee {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExpenseEntry {
  id: string;
  category: ExpenseCategory;
  expense_date: string;
  employee_id: string | null;
  reason: string;
  amount: number;
  created_at?: string;
  updated_at?: string;
}
