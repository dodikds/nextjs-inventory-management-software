// Single source of truth for how Sale.status/paymentStatus render as
// badges — shared by this module's own list page and the Dashboard's
// Recent Sales table, so the two can never disagree on label/color for the
// same sale.
export const STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  RECEIVED: { label: "Received", variant: "gg-badge--success" },
  PENDING: { label: "Pending", variant: "gg-badge--warning" },
  ORDERED: { label: "Ordered", variant: "gg-badge--info" },
};

export const PAYMENT_STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  PAID: { label: "Paid", variant: "gg-badge--success" },
  PARTIAL: { label: "Partial", variant: "gg-badge--warning" },
  UNPAID: { label: "Unpaid", variant: "gg-badge--danger" },
};
