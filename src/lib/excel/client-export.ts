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

export function exportWorkbookToXlsx(
  sheets: Array<{
    name: string;
    rows: ExportRow[];
    columnWidths?: number[];
    autoFilter?: boolean;
  }>,
  {
    fileName,
    emptyMessage = "No records found",
  }: {
    fileName: string;
    emptyMessage?: string;
  }
) {
  const workbook = XLSX.utils.book_new();

  const normalizedSheets =
    sheets.length > 0
      ? sheets
      : [{ name: "Data", rows: [{ Info: emptyMessage }] as ExportRow[], autoFilter: true }];

  for (const sheet of normalizedSheets) {
    const normalizedRows =
      sheet.rows.length > 0
        ? sheet.rows.map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [key, normalizeCellValue(value)])
            )
          )
        : [{ Info: emptyMessage }];

    const worksheet = XLSX.utils.json_to_sheet(normalizedRows);
    if (sheet.columnWidths && sheet.columnWidths.length > 0) {
      worksheet["!cols"] = sheet.columnWidths.map((wch) => ({ wch }));
    }
    if (sheet.autoFilter !== false) {
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1:A1");
      if (range.e.r >= range.s.r && range.e.c >= range.s.c) {
        worksheet["!autofilter"] = { ref: XLSX.utils.encode_range(range) };
      }
    }
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31) || "Sheet");
  }

  const xlsxBytes = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });
  const blob = new Blob([xlsxBytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${sanitizeFileName(fileName)}.xlsx`;
  link.click();
  URL.revokeObjectURL(link.href);
}
