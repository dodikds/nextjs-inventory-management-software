export function formatDateTimeChip(date: Date): { time: string; date: string } {
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  const day = date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
  return { time, date: day };
}
