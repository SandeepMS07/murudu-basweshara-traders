"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  createExpenseAction,
  createExpenseEmployeeAction,
  deleteExpenseAction,
  deleteExpenseEmployeeAction,
  updateExpenseAction,
  updateExpenseEmployeeAction,
} from "@/app/expenses/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import {
  ExpenseCategory,
  ExpenseEmployee,
  ExpenseEntry,
} from "@/features/expenses/schemas";

export type TabKey = "overview" | "salary" | "vehicle" | "hamali" | "other";

const tabOptions: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "salary", label: "Salary" },
  { key: "vehicle", label: "Vehicle" },
  { key: "hamali", label: "Hamali" },
  { key: "other", label: "Other Expenses" },
];

const expenseButtonLabel: Record<TabKey, string> = {
  overview: "",
  salary: "Add Salary",
  vehicle: "Add Expense",
  hamali: "Add Payment",
  other: "Add Expense",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

type VehicleFields = {
  vehicleType: string;
  vehicleNumber: string;
  reason: string;
};

const VEHICLE_REASON_PREFIX = "__vehicle__::";

function composeVehicleReason(fields: VehicleFields): string {
  const payload = {
    vehicleType: fields.vehicleType.trim(),
    vehicleNumber: fields.vehicleNumber.trim(),
    reason: fields.reason.trim(),
  };
  return `${VEHICLE_REASON_PREFIX}${JSON.stringify(payload)}`;
}

function parseVehicleReason(rawReason: string): VehicleFields {
  if (!rawReason) {
    return { vehicleType: "", vehicleNumber: "", reason: "" };
  }
  if (rawReason.startsWith(VEHICLE_REASON_PREFIX)) {
    try {
      const parsed = JSON.parse(rawReason.slice(VEHICLE_REASON_PREFIX.length)) as Partial<VehicleFields>;
      return {
        vehicleType: parsed.vehicleType?.toString() ?? "",
        vehicleNumber: parsed.vehicleNumber?.toString() ?? "",
        reason: parsed.reason?.toString() ?? "",
      };
    } catch {
      return { vehicleType: "", vehicleNumber: "", reason: rawReason };
    }
  }
  return { vehicleType: "", vehicleNumber: "", reason: rawReason };
}

interface ExpensesManagerProps {
  employees: ExpenseEmployee[];
  expenses: ExpenseEntry[];
  initialTab?: Exclude<TabKey, "overview"> | "overview";
}

export function ExpensesManager({ employees, expenses, initialTab = "salary" }: ExpensesManagerProps) {
  const [isPending, startTransition] = useTransition();
  const tab = initialTab;
  const [employeeList, setEmployeeList] = useState(employees);
  const [expenseList, setExpenseList] = useState(expenses);
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<ExpenseEmployee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "expense" | "employee";
    id: string;
    label: string;
  } | null>(null);

  const [expenseDate, setExpenseDate] = useState(todayISO());
  const [expenseEmployeeId, setExpenseEmployeeId] = useState("");
  const [expenseReason, setExpenseReason] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [employeeName, setEmployeeName] = useState("");

  const employeeMap = useMemo(
    () => new Map(employeeList.map((employee) => [employee.id, employee])),
    [employeeList]
  );

  const salaryRows = useMemo(
    () => expenseList.filter((expense) => expense.category === "salary"),
    [expenseList]
  );
  const vehicleRows = useMemo(
    () => expenseList.filter((expense) => expense.category === "vehicle"),
    [expenseList]
  );
  const hamaliRows = useMemo(
    () => expenseList.filter((expense) => expense.category === "hamali"),
    [expenseList]
  );
  const otherRows = useMemo(
    () => expenseList.filter((expense) => expense.category === "other"),
    [expenseList]
  );

  const employeeLedger = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const row of salaryRows) {
      if (!row.employee_id) continue;
      grouped.set(row.employee_id, (grouped.get(row.employee_id) ?? 0) + row.amount);
    }
    return employeeList.map((employee) => ({
      employee,
      paid: grouped.get(employee.id) ?? 0,
    }));
  }, [employeeList, salaryRows]);

  const resetExpenseForm = () => {
    setExpenseDate(todayISO());
    setExpenseEmployeeId("");
    setExpenseReason("");
    setExpenseAmount("");
    setVehicleType("");
    setVehicleNumber("");
    setEditingExpense(null);
  };

  const openExpenseDialog = (row?: ExpenseEntry) => {
    if (row) {
      setEditingExpense(row);
      setExpenseDate(row.expense_date);
      setExpenseEmployeeId(row.employee_id ?? "");
      if (tab === "vehicle") {
        const parsed = parseVehicleReason(row.reason ?? "");
        setVehicleType(parsed.vehicleType);
        setVehicleNumber(parsed.vehicleNumber);
        setExpenseReason(parsed.reason);
      } else {
        setExpenseReason(row.reason ?? "");
      }
      setExpenseAmount(row.amount.toString());
    } else {
      resetExpenseForm();
    }
    setExpenseDialogOpen(true);
  };

  const submitExpense = () => {
    const amount = Number(expenseAmount);
    const category = tab as ExpenseCategory;
    if (!expenseDate) {
      toast.error("Date is required");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be greater than zero");
      return;
    }
    if (category === "salary" && !expenseEmployeeId) {
      toast.error("Select employee");
      return;
    }
    if (category === "vehicle" && !vehicleType.trim()) {
      toast.error("Vehicle type is required");
      return;
    }
    if (category === "vehicle" && !vehicleNumber.trim()) {
      toast.error("Vehicle number is required");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          category,
          expense_date: expenseDate,
          employee_id: category === "salary" ? expenseEmployeeId : "",
          reason:
            category === "vehicle"
              ? composeVehicleReason({
                  vehicleType,
                  vehicleNumber,
                  reason: expenseReason,
                })
              : expenseReason,
          amount,
        };
        if (editingExpense) {
          const updated = await updateExpenseAction(editingExpense.id, payload);
          setExpenseList((current) => current.map((row) => (row.id === updated.id ? updated : row)));
          toast.success("Expense updated");
        } else {
          const created = await createExpenseAction(payload);
          setExpenseList((current) => [created, ...current]);
          toast.success("Expense added");
        }
        setExpenseDialogOpen(false);
        resetExpenseForm();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to save expense");
      }
    });
  };

  const openEmployeeDialog = (employee?: ExpenseEmployee) => {
    setEditingEmployee(employee ?? null);
    setEmployeeName(employee?.name ?? "");
    setEmployeeDialogOpen(true);
  };

  const submitEmployee = () => {
    if (!employeeName.trim()) {
      toast.error("Employee name is required");
      return;
    }

    startTransition(async () => {
      try {
        if (editingEmployee) {
          const updated = await updateExpenseEmployeeAction(editingEmployee.id, {
            name: employeeName.trim(),
            is_active: true,
          });
          setEmployeeList((current) =>
            current.map((employee) => (employee.id === updated.id ? updated : employee))
          );
          toast.success("Employee updated");
        } else {
          const created = await createExpenseEmployeeAction({
            name: employeeName.trim(),
            is_active: true,
          });
          setEmployeeList((current) => [...current, created]);
          toast.success("Employee added");
        }
        setEmployeeName("");
        setEditingEmployee(null);
        setEmployeeDialogOpen(false);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to save employee");
      }
    });
  };

  const openDeleteDialog = (target: { type: "expense" | "employee"; id: string; label: string }) => {
    setDeleteTarget(target);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    startTransition(async () => {
      try {
        if (deleteTarget.type === "expense") {
          await deleteExpenseAction(deleteTarget.id);
          setExpenseList((current) => current.filter((row) => row.id !== deleteTarget.id));
          toast.success("Expense deleted");
        } else {
          await deleteExpenseEmployeeAction(deleteTarget.id);
          setEmployeeList((current) => current.filter((employee) => employee.id !== deleteTarget.id));
          toast.success("Employee deleted");
        }
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete");
      }
    });
  };

  return (
    <div className="space-y-6">
      {tab === "overview" ? (
        <section className="rounded-xl border border-[#252932] bg-[#111214] p-4">
          <h3 className="text-base font-semibold text-zinc-100">Expense Summary</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              title="Salary"
              amount={salaryRows.reduce((acc, row) => acc + row.amount, 0)}
              count={salaryRows.length}
            />
            <SummaryCard
              title="Vehicle"
              amount={vehicleRows.reduce((acc, row) => acc + row.amount, 0)}
              count={vehicleRows.length}
            />
            <SummaryCard
              title="Hamali"
              amount={hamaliRows.reduce((acc, row) => acc + row.amount, 0)}
              count={hamaliRows.length}
            />
            <SummaryCard
              title="Other"
              amount={otherRows.reduce((acc, row) => acc + row.amount, 0)}
              count={otherRows.length}
            />
          </div>
          <div className="mt-3 rounded-md border border-[#252932] bg-[#15171c] p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">Grand Total</p>
            <p className="mt-1 text-2xl font-semibold text-[#ff8f6b]">
              {formatCurrencyINR(expenseList.reduce((acc, row) => acc + row.amount, 0))}
            </p>
          </div>
        </section>
      ) : null}

      {tab !== "overview" ? (
      <section className="rounded-xl border border-[#252932] bg-[#111214] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-100">
            {tabOptions.find((option) => option.key === tab)?.label}
          </h2>
          <div className="flex gap-2">
            {tab === "salary" ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => openEmployeeDialog()}
                className="border-[#2a2d34] bg-[#17191f] text-zinc-200 hover:bg-[#1d2026] hover:text-zinc-100"
              >
                Add Employee
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() => openExpenseDialog()}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {expenseButtonLabel[tab]}
            </Button>
          </div>
        </div>

        {tab === "salary" ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {employeeLedger.map(({ employee, paid }) => (
              <div
                key={employee.id}
                className="rounded-md border border-[#252932] bg-[#15171c] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.14em] text-zinc-500">{employee.name}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openEmployeeDialog(employee)}
                      className="h-7 border-[#2a2d34] bg-[#17191f] px-2 text-xs text-zinc-200 hover:bg-[#1d2026] hover:text-zinc-100"
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() =>
                        openDeleteDialog({
                          type: "employee",
                          id: employee.id,
                          label: employee.name,
                        })
                      }
                      className="h-7 border border-[#ff6a3d] bg-[#ff6a3d] px-2 text-xs text-white hover:bg-[#ff5a28]"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-xl font-semibold text-[#ff8f6b]">
                  {formatCurrencyINR(paid)}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto rounded-lg border border-[#252932]">
          {tab === "salary" ? (
            <table className="min-w-full text-sm">
              <thead className="bg-[#15171c] text-zinc-200">
                <tr>
                  <th className="px-3 py-2 text-left">Sl No</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Employee Name</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {salaryRows.length ? (
                  salaryRows.map((row, index) => (
                    <tr key={row.id} className="border-t border-[#252932] text-zinc-200">
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">{row.expense_date}</td>
                      <td className="px-3 py-2">{employeeMap.get(row.employee_id ?? "")?.name ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{formatCurrencyINR(row.amount)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openExpenseDialog(row)}
                            className="h-8 cursor-pointer border-[#2a2d34] bg-[#17191f] px-3 text-zinc-200 hover:bg-[#1d2026] hover:text-zinc-100"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              openDeleteDialog({
                                type: "expense",
                                id: row.id,
                                label: `salary entry ${index + 1}`,
                              })
                            }
                            className="h-8 cursor-pointer border border-[#ff6a3d] bg-[#ff6a3d] px-3 text-white hover:bg-[#ff5a28]"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                      No salary entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : null}

          {tab === "vehicle" ? (
            <table className="min-w-full text-sm">
              <thead className="bg-[#15171c] text-zinc-200">
                <tr>
                  <th className="px-3 py-2 text-left">Sl No</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Vehicle Type</th>
                  <th className="px-3 py-2 text-left">Vehicle Number</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-right">How Much Paid</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vehicleRows.length ? (
                  vehicleRows.map((row, index) => (
                    <tr key={row.id} className="border-t border-[#252932] text-zinc-200">
                      {(() => {
                        const parsed = parseVehicleReason(row.reason || "");
                        return (
                          <>
                            <td className="px-3 py-2">{index + 1}</td>
                            <td className="px-3 py-2">{row.expense_date}</td>
                            <td className="px-3 py-2">{parsed.vehicleType || "-"}</td>
                            <td className="px-3 py-2">{parsed.vehicleNumber || "-"}</td>
                            <td className="px-3 py-2">{parsed.reason || "-"}</td>
                            <td className="px-3 py-2 text-right">{formatCurrencyINR(row.amount)}</td>
                            <td className="px-3 py-2">
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openExpenseDialog(row)}
                                  className="h-8 cursor-pointer border-[#2a2d34] bg-[#17191f] px-3 text-zinc-200 hover:bg-[#1d2026] hover:text-zinc-100"
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() =>
                                    openDeleteDialog({
                                      type: "expense",
                                      id: row.id,
                                      label: `vehicle entry ${index + 1}`,
                                    })
                                  }
                                  className="h-8 cursor-pointer border border-[#ff6a3d] bg-[#ff6a3d] px-3 text-white hover:bg-[#ff5a28]"
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                      No vehicle expenses.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : null}

          {tab === "hamali" ? (
            <table className="min-w-full text-sm">
              <thead className="bg-[#15171c] text-zinc-200">
                <tr>
                  <th className="px-3 py-2 text-left">Sl No</th>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">How Much Paid</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {hamaliRows.length ? (
                  hamaliRows.map((row, index) => (
                    <tr key={row.id} className="border-t border-[#252932] text-zinc-200">
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">{row.expense_date}</td>
                      <td className="px-3 py-2 text-right">{formatCurrencyINR(row.amount)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openExpenseDialog(row)}
                            className="h-8 cursor-pointer border-[#2a2d34] bg-[#17191f] px-3 text-zinc-200 hover:bg-[#1d2026] hover:text-zinc-100"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              openDeleteDialog({
                                type: "expense",
                                id: row.id,
                                label: `hamali entry ${index + 1}`,
                              })
                            }
                            className="h-8 cursor-pointer border border-[#ff6a3d] bg-[#ff6a3d] px-3 text-white hover:bg-[#ff5a28]"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                      No hamali expenses.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : null}

          {tab === "other" ? (
            <table className="min-w-full text-sm">
              <thead className="bg-[#15171c] text-zinc-200">
                <tr>
                  <th className="px-3 py-2 text-left">Sl No</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                  <th className="px-3 py-2 text-right">How Much Paid</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {otherRows.length ? (
                  otherRows.map((row, index) => (
                    <tr key={row.id} className="border-t border-[#252932] text-zinc-200">
                      <td className="px-3 py-2">{index + 1}</td>
                      <td className="px-3 py-2">{row.reason || "-"}</td>
                      <td className="px-3 py-2 text-right">{formatCurrencyINR(row.amount)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openExpenseDialog(row)}
                            className="h-8 cursor-pointer border-[#2a2d34] bg-[#17191f] px-3 text-zinc-200 hover:bg-[#1d2026] hover:text-zinc-100"
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              openDeleteDialog({
                                type: "expense",
                                id: row.id,
                                label: `other expense ${index + 1}`,
                              })
                            }
                            className="h-8 cursor-pointer border border-[#ff6a3d] bg-[#ff6a3d] px-3 text-white hover:bg-[#ff5a28]"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                      No other expenses.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : null}
        </div>
      </section>
      ) : null}

      <Dialog
        open={expenseDialogOpen}
        onOpenChange={(open) => {
          setExpenseDialogOpen(open);
          if (!open) resetExpenseForm();
        }}
      >
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Edit Entry" : expenseButtonLabel[tab]}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Date</label>
              <Input
                type="date"
                value={expenseDate}
                onChange={(event) => setExpenseDate(event.target.value)}
                style={{ colorScheme: "dark" }}
                className="border-[#2a2d34] bg-[#111214] text-zinc-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:invert"
              />
            </div>
            {tab === "salary" ? (
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Employee</label>
                <select
                  value={expenseEmployeeId}
                  onChange={(event) => setExpenseEmployeeId(event.target.value)}
                  className="h-10 w-full rounded-md border border-[#2a2d34] bg-[#111214] px-3 text-sm text-zinc-100"
                >
                  <option value="">Select employee</option>
                  {employeeList.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            {tab !== "hamali" ? (
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Reason</label>
                <Input
                  value={expenseReason}
                  onChange={(event) => setExpenseReason(event.target.value)}
                  placeholder="Reason"
                  className="border-[#2a2d34] bg-[#111214] text-zinc-100"
                />
              </div>
            ) : null}
            {tab === "vehicle" ? (
              <>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Vehicle Type</label>
                  <Input
                    value={vehicleType}
                    onChange={(event) => setVehicleType(event.target.value)}
                    placeholder="Tractor, Car, Bike, Lorry..."
                    className="border-[#2a2d34] bg-[#111214] text-zinc-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-400">Vehicle Number</label>
                  <Input
                    value={vehicleNumber}
                    onChange={(event) => setVehicleNumber(event.target.value)}
                    placeholder="KA-01-AB-1234"
                    className="border-[#2a2d34] bg-[#111214] text-zinc-100"
                  />
                </div>
              </>
            ) : null}
            <div>
              <label className="mb-1 block text-xs text-zinc-400">Amount</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="Amount"
                className="border-[#2a2d34] bg-[#111214] text-zinc-100"
              />
            </div>
          </div>
          <DialogFooter className="-mx-4 -mb-4 rounded-b-xl border-t border-[#2a2d34] bg-[#15171c] p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExpenseDialogOpen(false)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitExpense}
              disabled={isPending}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? "Saving..." : editingExpense ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={employeeDialogOpen}
        onOpenChange={(open) => {
          setEmployeeDialogOpen(open);
          if (!open) {
            setEditingEmployee(null);
            setEmployeeName("");
          }
        }}
      >
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <div>
            <label className="mb-1 block text-xs text-zinc-400">Employee Name</label>
            <Input
              value={employeeName}
              onChange={(event) => setEmployeeName(event.target.value)}
              placeholder="Employee name"
              className="border-[#2a2d34] bg-[#111214] text-zinc-100"
            />
          </div>
          <DialogFooter className="-mx-4 -mb-4 rounded-b-xl border-t border-[#2a2d34] bg-[#15171c] p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEmployeeDialogOpen(false)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={submitEmployee}
              disabled={isPending}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? "Saving..." : editingEmployee ? "Update Employee" : "Add Employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="border border-[#2a2d34] bg-[#15171c] text-zinc-100">
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-400">
            This will permanently delete {deleteTarget?.label ?? "this record"}.
          </p>
          <DialogFooter className="-mx-4 -mb-4 rounded-b-xl border-t border-[#2a2d34] bg-[#15171c] p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="border-[#2a2d34] bg-[#1b1e24] text-zinc-200 hover:bg-[#23262e]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmDelete}
              disabled={isPending}
              className="border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]"
            >
              {isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function SummaryCard({
  title,
  amount,
  count,
}: {
  title: string;
  amount: number;
  count: number;
}) {
  return (
    <div className="rounded-md border border-[#252932] bg-[#15171c] p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">{title}</p>
        <p className="text-xs text-zinc-500">
          {formatNumberIN(count, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} entries
        </p>
      </div>
      <p className="mt-1 text-xl font-semibold text-[#ff8f6b]">{formatCurrencyINR(amount)}</p>
    </div>
  );
}
