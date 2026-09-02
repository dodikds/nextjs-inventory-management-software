// Single source of truth for how SaleReturn.status/paymentStatus render as
// badges — shared by this module's own list page and Warehouse Reports'
// Sales Returns sub-tab (see ../../reports/warehouse/page.tsx), so the two
// can never disagree on label/color for the same sale return.
export const STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  PENDING: { label: "Pending", variant: "gg-badge--warning" },
  RECEIVED: { label: "Received", variant: "gg-badge--info" },
  COMPLETED: { label: "Completed", variant: "gg-badge--success" },
};

export const PAYMENT_STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  PAID: { label: "Paid", variant: "gg-badge--success" },
  PARTIAL: { label: "Partial", variant: "gg-badge--info" },
  UNPAID: { label: "Unpaid", variant: "gg-badge--warning" },
};
