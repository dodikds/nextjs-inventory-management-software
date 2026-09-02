// Single source of truth for how Purchase.status renders as a badge —
// shared by this module's own list page and Purchase Reports (see
// ../reports/purchase/page.tsx), so the two can never disagree on
// label/color for the same purchase.
export const STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  RECEIVED: { label: "Received", variant: "gg-badge--success" },
  PENDING: { label: "Pending", variant: "gg-badge--warning" },
  ORDERED: { label: "Ordered", variant: "gg-badge--info" },
};
