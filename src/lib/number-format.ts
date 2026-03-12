const INDIAN_LOCALE = "en-IN";

function toSafeNumber(value: number | string | null | undefined): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatNumberIN(
  value: number | string | null | undefined,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
) {
  const numeric = toSafeNumber(value);
  const hasMin = typeof options?.minimumFractionDigits === "number";
  const hasMax = typeof options?.maximumFractionDigits === "number";

  const minCandidate = hasMin
    ? options!.minimumFractionDigits!
    : hasMax
      ? options!.maximumFractionDigits!
      : 2;
  const maxCandidate = hasMax ? options!.maximumFractionDigits! : 2;

  const minimumFractionDigits = Math.max(0, Math.min(20, Math.trunc(minCandidate)));
  const maximumFractionDigits = Math.max(
    minimumFractionDigits,
    Math.max(0, Math.min(20, Math.trunc(maxCandidate)))
  );

  return numeric.toLocaleString(INDIAN_LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

export function formatCurrencyINR(
  value: number | string | null | undefined,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
) {
  return `₹${formatNumberIN(value, options)}`;
}
