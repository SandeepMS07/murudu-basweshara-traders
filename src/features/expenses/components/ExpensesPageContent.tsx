import { ExpensesManager, TabKey } from "@/features/expenses/components/ExpensesManager";
import { getExpenseEmployees, getExpenses } from "@/features/expenses/service/expense.service";

export async function ExpensesPageContent({ initialTab }: { initialTab: TabKey }) {
  const [employees, expenses] = await Promise.all([getExpenseEmployees(), getExpenses()]);

  return (
    <>
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100 sm:text-3xl">Expenses</h1>
      </div>
      <ExpensesManager employees={employees} expenses={expenses} initialTab={initialTab} />
    </>
  );
}
