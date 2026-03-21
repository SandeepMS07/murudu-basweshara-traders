"use client";

import { useCallback, useMemo, useState } from "react";
import { addDays, isValid, parseISO } from "date-fns";

import { DataTable } from "@/components/shared/DataTable";
import { createSaleColumns } from "@/features/sales/components/Columns";
import { Sale } from "@/features/sales/schemas";
import { Company } from "@/features/companies/schemas";

interface SalesTableClientProps {
  data: Sale[];
  buyerCompanies: Company[];
  issuerCompanies: Company[];
  pendingBySaleId: Record<string, number>;
}

export function SalesTableClient({
  data,
  buyerCompanies,
  issuerCompanies,
  pendingBySaleId,
}: SalesTableClientProps) {
  const [selectedBuyerId, setSelectedBuyerId] = useState("");
  const buyerPhoneById = useMemo(
    () => Object.fromEntries(buyerCompanies.map((company) => [company.id, company.phone || ""])),
    [buyerCompanies]
  );

  const filteredData = useMemo(() => {
    if (!selectedBuyerId) return data;
    return data.filter((sale) => sale.sale_company_id === selectedBuyerId);
  }, [data, selectedBuyerId]);

  const columns = useMemo(
    () => createSaleColumns(issuerCompanies, pendingBySaleId),
    [issuerCompanies, pendingBySaleId]
  );
  const today = new Date();
  const todayStart = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate()),
    [today]
  );

  const parseTermDays = useCallback((terms: string | null | undefined) => {
    const parsed = Number.parseInt(String(terms ?? "").trim(), 10);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }, []);

  const getDueDate = useCallback(
    (sale: Sale) => {
      const saleDate = parseISO(sale.sale_date);
      if (!isValid(saleDate)) return null;
      return addDays(saleDate, parseTermDays(sale.payment_terms));
    },
    [parseTermDays]
  );

  const getRowDueStatus = useCallback(
    (sale: Sale) => {
      const dueDate = getDueDate(sale);
      if (!dueDate) return "unknown" as const;
      const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const effectivePending = pendingBySaleId[sale.id] ?? sale.pending_amount;
      if (effectivePending <= 0) return "cleared" as const;
      if (dueStart.getTime() < todayStart.getTime()) return "overdue" as const;
      if (dueStart.getTime() === todayStart.getTime()) return "due_today" as const;
      return "upcoming" as const;
    },
    [getDueDate, pendingBySaleId, todayStart]
  );

  const getRowClassName = useCallback(
    (sale: Sale) => {
      const status = getRowDueStatus(sale);
      if (status === "overdue") return "bg-[#2a1111]/40 hover:bg-[#361616]/50";
      if (status === "due_today") return "bg-[#2a2412]/40 hover:bg-[#352d16]/50";
      if (status === "cleared") return "bg-[#102015]/30 hover:bg-[#16301f]/45";
      return "";
    },
    [getRowDueStatus]
  );

  const toolbarRight = (
    <div className="flex w-full flex-col gap-2 lg:flex-row lg:items-center lg:justify-end">
      <div className="flex flex-wrap items-center gap-2 lg:mr-auto">
        <div className="inline-flex items-center gap-2 rounded-md border border-[#3b1b1b] bg-[#2a1111]/40 px-2 py-1 text-xs text-zinc-200">
          <span className="h-2 w-2 rounded-full bg-[#ef4444]" />
          Overdue (date crossed)
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-[#3d3418] bg-[#2a2412]/40 px-2 py-1 text-xs text-zinc-200">
          <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
          Due Today
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-[#1d3a27] bg-[#102015]/30 px-2 py-1 text-xs text-zinc-200">
          <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
          Cleared
        </div>
        <div className="inline-flex items-center gap-2 rounded-md border border-[#2a2d34] bg-[#15171c] px-2 py-1 text-xs text-zinc-200">
          <span className="h-2 w-2 rounded-full bg-[#71717a]" />
          Upcoming
        </div>
      </div>
      <select
        value={selectedBuyerId}
        onChange={(event) => {
          setSelectedBuyerId(event.target.value);
        }}
        className="h-10 rounded-md border border-[#2a2d34] bg-[#14161b] px-3 text-sm text-zinc-100"
      >
        <option value="">All buyer companies</option>
        {buyerCompanies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={filteredData}
        searchKey="party"
        searchPlaceholder="Filter by party or phone..."
        searchPredicate={(sale, query) => {
          const party = (sale.party || "").toLowerCase();
          const buyerPhone = (buyerPhoneById[sale.sale_company_id || ""] || "").replace(/\D/g, "");
          const queryDigits = query.replace(/\D/g, "");

          return party.includes(query) || (!!queryDigits && buyerPhone.includes(queryDigits));
        }}
        toolbarRight={toolbarRight}
        rowClassName={(row) => getRowClassName(row.original)}
      />
    </>
  );
}
