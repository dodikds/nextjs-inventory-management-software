// Single source of truth for how PurchaseReturn.status renders as a badge —
// shared by this module's own list page and Warehouse Reports' Purchases
// Returns sub-tab (see ../../reports/warehouse/page.tsx), so the two can
// never disagree on label/color for the same purchase return.
export const STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  RECEIVED: { label: "Received", variant: "gg-badge--success" },
  PENDING: { label: "Pending", variant: "gg-badge--warning" },
  ORDERED: { label: "Ordered", variant: "gg-badge--info" },
};
