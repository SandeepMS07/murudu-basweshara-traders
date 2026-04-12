"use client";

import * as XLSX from "xlsx";

type ExportPrimitive = string | number | boolean | null | undefined;
export type ExportRow = Record<string, ExportPrimitive>;

function normalizeCellValue(value: ExportPrimitive): string | number | boolean {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return String(value);
}

function sanitizeFileName(name: string): string {
  const safe = name.trim().replace(/[^\w-]+/g, "_");
  return safe || "table_export";
}

export function exportRowsToCsv(
  rows: ExportRow[],
  {
    fileName,
    sheetName = "Data",
    emptyMessage = "No records found",
  }: {
    fileName: string;
    sheetName?: string;
    emptyMessage?: string;
  }
) {
  // Keep a single-row sheet for empty exports so users still get a valid file.
  const normalizedRows =
    rows.length > 0
      ? rows.map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, normalizeCellValue(value)])
          )
        )
      : [{ Info: emptyMessage }];

  const worksheet = XLSX.utils.json_to_sheet(normalizedRows);
  const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ",", RS: "\n" });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${sanitizeFileName(fileName)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}
