import { format, isValid, parseISO } from "date-fns";

type FinancialYearBounds = {
  start: string;
  end: string;
};

function toSafeDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  const parsed = parseISO(input);
  return isValid(parsed) ? parsed : new Date();
}

export function getFinancialYearBounds(input: string | Date): FinancialYearBounds {
  const date = toSafeDate(input);
  const year = date.getMonth() >= 3 ? date.getFullYear() : date.getFullYear() - 1;
  const startDate = new Date(year, 3, 1);
  const endDate = new Date(year + 1, 2, 31);

  return {
    start: format(startDate, "yyyy-MM-dd"),
    end: format(endDate, "yyyy-MM-dd"),
  };
}
