import * as xlsx from "xlsx";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const EXCEL_FILE = path.join(DATA_DIR, "purchage.xlsx");
const BASE_SHEETS = ["PURCHASE", "BILL", "APP_PURCHASE", "APP_BILL"] as const;

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function createEmptyWorkbook(): xlsx.WorkBook {
  const wb = xlsx.utils.book_new();
  for (const sheet of BASE_SHEETS) {
    xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet([["id", "source"]]), sheet);
  }
  return wb;
}

function readWorkbookFromPath(filePath: string): xlsx.WorkBook {
  const binary = fs.readFileSync(filePath);
  return xlsx.read(binary, { type: "buffer" });
}

function writeWorkbookToPath(wb: xlsx.WorkBook, filePath: string) {
  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(filePath, buffer);
}

function resolveWorkbookPath(): string | null {
  if (fs.existsSync(EXCEL_FILE)) {
    return EXCEL_FILE;
  }

  if (!fs.existsSync(DATA_DIR)) {
    return null;
  }

  const latestBackup = fs
    .readdirSync(DATA_DIR)
    .filter((name) => name.startsWith("purchage.xlsx.broken-"))
    .sort()
    .pop();

  return latestBackup ? path.join(DATA_DIR, latestBackup) : null;
}

export function openWorkbook(): xlsx.WorkBook {
  const sourceFile = resolveWorkbookPath();

  if (!sourceFile) {
    // For read paths, avoid writing a file eagerly; return an in-memory workbook.
    return createEmptyWorkbook();
  }

  try {
    const wb = readWorkbookFromPath(sourceFile);

    // If we recovered from a backup file, restore the canonical workbook path.
    if (sourceFile !== EXCEL_FILE) {
      try {
        writeWorkbookToPath(wb, EXCEL_FILE);
      } catch (restoreError) {
        console.error("Failed to restore workbook from backup:", restoreError);
      }
    }

    return wb;
  } catch (error) {
    // If the workbook is unreadable/corrupt, rotate it and recover with a new one.
    const backupFile = `${EXCEL_FILE}.broken-${Date.now()}`;
    try {
      if (sourceFile === EXCEL_FILE) {
        fs.renameSync(EXCEL_FILE, backupFile);
      }
    } catch {
      // If rotation fails, continue with a fresh in-memory workbook anyway.
    }

    const wb = createEmptyWorkbook();
    try {
      writeWorkbookToPath(wb, EXCEL_FILE);
    } catch (writeError) {
      console.error("Failed to recreate workbook after read error:", writeError);
    }

    console.error("Workbook read failed, recovered with a new workbook:", error);
    return wb;
  }
}

export function saveWorkbook(wb: xlsx.WorkBook) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  writeWorkbookToPath(wb, EXCEL_FILE);
}

export function ensureSheet(wb: xlsx.WorkBook, sheetName: string): xlsx.WorkSheet {
  if (!wb.SheetNames.includes(sheetName)) {
    const ws = xlsx.utils.aoa_to_sheet([]);
    xlsx.utils.book_append_sheet(wb, ws, sheetName);
  }
  return wb.Sheets[sheetName];
}

export function readSheetRows<T>(sheetName: string): T[] {
  const wb = openWorkbook();
  const ws = ensureSheet(wb, sheetName);
  return xlsx.utils.sheet_to_json<T>(ws, { defval: null });
}

export function writeSheetRows<T>(sheetName: string, rows: T[]) {
  const wb = openWorkbook();
  const newWs = xlsx.utils.json_to_sheet(rows);
  wb.Sheets[sheetName] = newWs;
  if (!wb.SheetNames.includes(sheetName)) {
    wb.SheetNames.push(sheetName);
  }
  saveWorkbook(wb);
}

export function appendSheetRow<T>(sheetName: string, row: T) {
  const rows = readSheetRows<T>(sheetName);
  rows.push(row);
  writeSheetRows(sheetName, rows);
}

export function updateSheetRowById<T extends { id: string }>(
  sheetName: string,
  id: string,
  updatedRow: T
) {
  const rows = readSheetRows<T>(sheetName);
  const index = rows.findIndex((r) => r.id === id);
  if (index !== -1) {
    rows[index] = { ...rows[index], ...updatedRow };
    writeSheetRows(sheetName, rows);
  }
}
