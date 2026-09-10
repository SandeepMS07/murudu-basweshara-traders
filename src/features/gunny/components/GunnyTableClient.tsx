"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { type GunnyRecord } from "@/features/gunny/schemas";
import { deleteGunnyRecordAction } from "@/app/gunny/actions";
import { formatCurrencyINR, formatNumberIN } from "@/lib/number-format";
import { useRouter } from "next/navigation";
import { useCanEdit } from "@/features/auth/components/AuthProvider";

export function GunnyTableClient({ data }: { data: GunnyRecord[] }) {
  const router = useRouter();
  const canEdit = useCanEdit("gunny");
  const [isPending, startTransition] = useTransition();

  const onDelete = (id: string) => {
    if (!confirm("Delete this gunny record?")) return;
    startTransition(async () => {
      try {
        await deleteGunnyRecordAction(id);
        toast.success("Record deleted");
        router.refresh();
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to delete");
      }
    });
  };

  return (
    <div className="space-y-3">
      {canEdit ? (
        <div className="flex justify-end">
          <Link href="/gunny/add">
            <Button className="border border-[#2a2d34] bg-[#17191f] text-zinc-100 hover:bg-[#1d2026]">Add Gunny Bags</Button>
          </Link>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-[#252932] bg-[#111214]">
        <table className="min-w-[1100px] w-full text-sm">
          <thead className="bg-[#15171c] text-zinc-200">
            <tr>
              <th className="px-3 py-2 text-left">Bill No</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Seller</th>
              <th className="px-3 py-2 text-right">Bags</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Amount</th>
              <th className="px-3 py-2 text-right">Paid</th>
              <th className="px-3 py-2 text-right">Pending</th>
              <th className="px-3 py-2 text-left">Note</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">No gunny records.</td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={row.id} className="border-t border-[#252932] text-zinc-200">
                  <td className="px-3 py-2">{row.bill_no}</td>
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">{row.seller}</td>
                  <td className="px-3 py-2 text-right">{formatNumberIN(row.bags, { maximumFractionDigits: 0 })}</td>
                  <td className="px-3 py-2 text-right">{formatCurrencyINR(row.rate)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrencyINR(row.amount)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrencyINR(row.paid_amount)}</td>
                  <td className="px-3 py-2 text-right">{formatCurrencyINR(row.pending_amount)}</td>
                  <td className="px-3 py-2">{row.note || "-"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      {canEdit ? (
                        <>
                          <Link href={`/gunny/${row.id}/edit`}>
                            <Button size="sm" variant="outline" className="h-8 border-[#2a2d34] bg-[#17191f] text-zinc-200 hover:bg-[#1d2026]">Edit</Button>
                          </Link>
                          <Button size="sm" disabled={isPending} onClick={() => onDelete(row.id)} className="h-8 border border-[#ff6a3d] bg-[#ff6a3d] text-white hover:bg-[#ff5a28]">Delete</Button>
                        </>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
