export function stripIndiaCountryCode(phone?: string | null): string {
  if (!phone) return "-";
  return phone.replace(/^\+91/, "").trim() || "-";
}
