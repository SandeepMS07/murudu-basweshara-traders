import * as XLSX from "xlsx";
import { NextResponse } from "next/server";

import { requireAuth } from "@/features/auth/lib/session";
import { getPurchases } from "@/features/purchases/service/purchase.service";

export async function GET() {
  try {
    await requireAuth();

    const purchases = await getPurchases();
    const rows = purchases.map((purchase, index) => ({
      sl_no: index + 1,
      id: purchase.id,
      date: purchase.date,
      name: purchase.name,
      place: purchase.place,
      mob: purchase.mob,
      bags: purchase.bags,
      weight: purchase.weight,
      less_percent: purchase.less_percent,
      less_weight: purchase.less_weight,
      net_weight: purchase.net_weight,
      rate: purchase.rate,
      amount: purchase.amount,
      bag_less: purchase.bag_less,
      add_amount: purchase.add_amount,
      cash_paid: purchase.cash_paid,
      upi_paid: purchase.upi_paid,
      final_total: purchase.final_total,
      payment_through: purchase.payment_through,
      source: purchase.source,
      bag_avg: purchase.bag_avg,
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "purchases");

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    return new NextResponse(buffer as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="purchases.xlsx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export purchases";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
