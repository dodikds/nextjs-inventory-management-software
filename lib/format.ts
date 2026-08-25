// Builds the two-letter initials shown in the Users list's .ppl-ava badge
// (e.g. "Raihan Shak" -> "RS"), matching design/Users.html's mockup script.
export function getInitials(firstName: string, lastName: string): string {
  const first = firstName.trim().charAt(0);
  const last = lastName.trim().charAt(0);
  return `${first}${last}`.toUpperCase();
}

export function formatDateTimeChip(date: Date): { time: string; date: string } {
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const day = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  return { time, date: day };
}

// Formats a date-only value (e.g. a DOB) for `<input type="date">`, which
// requires "yyyy-mm-dd". Uses UTC getters rather than the local-time ones
// (getFullYear/getMonth/getDate) — a date-only value is stored as UTC
// midnight (see lib/validation/customer.ts), and reading it back with local
// getters would roll it back a day in any negative UTC-offset timezone.
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
