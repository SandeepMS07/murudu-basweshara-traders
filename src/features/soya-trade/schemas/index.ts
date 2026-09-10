import { z } from "zod";

import { saleSchema, type Sale } from "@/features/sales/schemas";
import { SOYA_GOODS_NAME } from "@/features/soya/lib/constants";

/**
 * A Soya trade record (a Soya Purchase or a Soya Sale) has exactly the same
 * shape as a maize Sale — that is the whole point of the module being "the same
 * sales from maize one". So the schema and the row type are reused rather than
 * copied: it keeps the two in lockstep, and it means the pure maize helpers
 * (computeEffectiveSalePending, CompanyStatementView) accept Soya rows with no
 * adapter. If the maize Sale shape ever changes, this fails to compile instead
 * of silently drifting.
 *
 * Only the goods name default differs.
 */
export const soyaTradeSchema = saleSchema.extend({
  goods_name: z
    .string()
    .trim()
    .min(1, "Goods name is required")
    .default(SOYA_GOODS_NAME),
});

export type SoyaTradeInput = z.infer<typeof soyaTradeSchema>;

export type SoyaTrade = Sale;
