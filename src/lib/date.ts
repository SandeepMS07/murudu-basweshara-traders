/**
 * Today's date as an ISO `yyyy-MM-dd` string in India Standard Time,
 * independent of the server or browser timezone. Safe to call on both
 * the server (Server Actions) and the client (live previews).
 */
export function istTodayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
