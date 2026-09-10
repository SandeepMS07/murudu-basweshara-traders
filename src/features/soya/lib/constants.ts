/** Goods name stamped on Soya records (the maize side uses "MAIZE"). */
export const SOYA_GOODS_NAME = "SOYA";

/** Landing route when switching into the Soya workspace. */
export const SOYA_HOME = "/soya/dashboard";

/** Landing route when switching back to the Maize workspace. */
export const MAIZE_HOME = "/dashboard";

export type Workspace = "maize" | "soya";

/** Which workspace a path belongs to. Soya lives entirely under /soya. */
export function workspaceForPath(pathname: string): Workspace {
  return pathname === "/soya" || pathname.startsWith("/soya/") ? "soya" : "maize";
}
