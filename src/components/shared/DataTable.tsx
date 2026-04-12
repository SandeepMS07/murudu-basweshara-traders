"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  getFilteredRowModel,
  Row,
} from "@tanstack/react-table";
import { CSSProperties, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Download, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { exportRowsToCsv } from "@/lib/excel/client-export";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ColumnMeta {
  sticky?: boolean;
  left?: string;
  right?: string;
  width?: string;
  zIndex?: number;
  headClassName?: string;
  cellClassName?: string;
  boxShadow?: string;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  searchPredicate?: (row: TData, query: string) => boolean;
  rowClassName?: (row: Row<TData>) => string | undefined;
  toolbarRight?: ReactNode;
  toolbarBelow?: ReactNode;
  toolbarFarRight?: ReactNode;
  exportFileName?: string;
  showExportButton?: boolean;
  disablePagination?: boolean;
  scrollToBottom?: boolean;
  scrollContainerClassName?: string;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  searchPredicate,
  rowClassName,
  toolbarRight,
  toolbarBelow,
  toolbarFarRight,
  exportFileName = "table_export",
  showExportButton = true,
  disablePagination = false,
  scrollToBottom = false,
  scrollContainerClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredByPredicate = useMemo(() => {
    if (!searchPredicate || !normalizedQuery) return data;
    return data.filter((row) => searchPredicate(row, normalizedQuery));
  }, [data, normalizedQuery, searchPredicate]);

  const table = useReactTable({
    data: filteredByPredicate,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: disablePagination ? undefined : getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      globalFilter,
    },
  });

  const handleExportCsv = () => {
    const exportableColumns = table
      .getAllLeafColumns()
      .filter((column) => {
        const def = column.columnDef as { accessorKey?: unknown; accessorFn?: unknown };
        if (column.id === "actions" || column.id === "view_bill") return false;
        return typeof def.accessorKey === "string" || typeof def.accessorFn === "function";
      });

    const headers = exportableColumns.map((column) => {
      const header = column.columnDef.header;
      if (typeof header === "string") return header;
      return String(column.id).replaceAll("_", " ").toUpperCase();
    });

    const rows = table.getFilteredRowModel().rows.map((row) => {
      const obj: Record<string, string | number | boolean> = {};
      exportableColumns.forEach((column, index) => {
        const key = headers[index];
        const value = row.getValue(column.id);
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
          obj[key] = value;
          return;
        }
        obj[key] = value == null ? "" : JSON.stringify(value);
      });
      return obj;
    });

    const emptyRow = Object.fromEntries(headers.map((header) => [header, ""]));
    exportRowsToCsv(rows.length > 0 ? rows : [emptyRow], {
      fileName: exportFileName,
      sheetName: "Data",
      emptyMessage: "No records found",
    });
  };

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!disablePagination || !scrollToBottom) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const raf = requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [disablePagination, scrollToBottom, filteredByPredicate.length]);

  return (
    <div className="space-y-4">
      {(searchKey || toolbarRight || showExportButton) && (
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
          {searchKey && (
            <div className="relative w-full xl:max-w-sm xl:flex-none">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
              <Input
                placeholder={searchPlaceholder}
                value={
                  searchPredicate
                    ? searchQuery
                    : (table.getColumn(searchKey)?.getFilterValue() as string) ?? globalFilter
                }
                onChange={(event) => {
                  if (searchPredicate) {
                    setSearchQuery(event.target.value);
                    return;
                  }
                  if (searchKey && table.getColumn(searchKey)) {
                    table.getColumn(searchKey)?.setFilterValue(event.target.value);
                  } else {
                    setGlobalFilter(event.target.value);
                  }
                }}
                className="h-10 border-[#2a2d34] bg-[#14161b] pl-8 text-zinc-200 placeholder:text-zinc-500"
              />
            </div>
          )}
          {toolbarRight ? <div className="min-w-0 w-full xl:flex-1">{toolbarRight}</div> : null}
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            {showExportButton ? (
              <div className="xl:ml-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleExportCsv}
                  className="h-10 border-[#2a2d34] bg-[#17191f] text-zinc-200 hover:bg-[#1d2026] hover:text-zinc-100"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            ) : null}
            {toolbarFarRight ? <div className="xl:ml-2">{toolbarFarRight}</div> : null}
          </div>
        </div>
      )}
      {toolbarBelow ? <div className="flex w-full">{toolbarBelow}</div> : null}

      <div
        ref={scrollContainerRef}
        className={cn(
          "overflow-x-auto rounded-xl border border-[#252932] bg-[#111214] text-zinc-100 shadow-[0_12px_30px_rgba(0,0,0,0.3)]",
          disablePagination ? "overflow-y-auto" : "overflow-y-hidden",
          disablePagination ? scrollContainerClassName ?? "max-h-[70vh]" : "",
        )}
      >
        <Table className="min-w-max">
          <TableHeader className="sticky top-0 z-10">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-b border-[#252932] bg-[#15171c] hover:bg-[#15171c]"
              >
                {headerGroup.headers.map((header) => {
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                  const headerStyle: CSSProperties | undefined = meta?.sticky
                    ? {
                        position: "sticky",
                        left: meta.left,
                        right: meta.right,
                        zIndex: meta.zIndex,
                        width: meta.width,
                        boxShadow: meta.boxShadow,
                      }
                    : undefined;
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        "h-12 border-b border-[#252932] bg-[#15171c] text-zinc-200",
                        meta?.headClassName
                      )}
                      style={headerStyle}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn("border-b border-[#252932] text-zinc-200", rowClassName?.(row))}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                    const cellStyle: CSSProperties | undefined = meta?.sticky
                      ? {
                          position: "sticky",
                          left: meta.left,
                          right: meta.right,
                          zIndex: meta.zIndex,
                          width: meta.width,
                          boxShadow: meta.boxShadow,
                        }
                      : undefined;
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn("h-14 border-b border-[#252932] bg-transparent", meta?.cellClassName)}
                        style={cellStyle}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-zinc-500"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {!disablePagination ? (
        <div className="flex items-center justify-end space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="border-[#2a2d34] bg-[#17191f] text-zinc-300 hover:bg-[#1d2026] hover:text-zinc-100"
          >
            Previous
          </Button>
          <span className="flex items-center justify-center text-sm text-zinc-500">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="border-[#2a2d34] bg-[#17191f] text-zinc-300 hover:bg-[#1d2026] hover:text-zinc-100"
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
