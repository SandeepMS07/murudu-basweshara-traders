/**
 * The source workbook carries unrounded products (e.g. 34850 * 47.238 =
 * 1646244.3 and its 2.5% = 41156.1075), so Soya keeps 2 decimals on money and
 * 4 on tax components rather than rounding to rupees. Values are only rounded
 * for display.
 */
export function round2(value: number): number {
  return Number((value || 0).toFixed(2));
}

export function round4(value: number): number {
  return Number((value || 0).toFixed(4));
}
