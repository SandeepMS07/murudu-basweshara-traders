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
import { CSSProperties, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

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
  rowClassName?: (row: Row<TData>) => string | undefined;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  rowClassName,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onGlobalFilterChange: setGlobalFilter,
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      globalFilter,
    },
  });

  return (
    <div className="space-y-4">
      {searchKey && (
        <div className="max-w-sm items-center gap-2">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
            <Input
              placeholder={searchPlaceholder}
              value={(table.getColumn(searchKey)?.getFilterValue() as string) ?? globalFilter}
              onChange={(event) => {
                if (searchKey && table.getColumn(searchKey)) {
                  table.getColumn(searchKey)?.setFilterValue(event.target.value);
                } else {
                  setGlobalFilter(event.target.value);
                }
              }}
              className="h-10 border-[#2a2d34] bg-[#14161b] pl-8 text-zinc-200 placeholder:text-zinc-500"
            />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-[#252932] bg-[#111214] text-zinc-100 shadow-[0_12px_30px_rgba(0,0,0,0.3)]">
        <Table className="min-w-max">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b border-[#252932] bg-[#15171c] hover:bg-[#15171c]">
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
                      className={cn("h-12 border-b border-[#252932] bg-[#15171c] text-zinc-200", meta?.headClassName)}
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
    </div>
  );
}
