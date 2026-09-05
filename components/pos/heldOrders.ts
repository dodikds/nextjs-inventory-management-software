import type { DiscountType, TaxType } from "@/lib/pricing";

// Same shape as PosScreen's own CartItem — a held order is just a parked
// cart, never a Sale (see AGENTS.md: "A held order must NOT create a Sale
// or touch stock").
export type HeldCartItem = {
  productId: string;
  code: string;
  name: string;
  unitPrice: string;
  stock: number;
  quantity: number;
  discountType: DiscountType;
  discount: string;
  taxType: TaxType;
  orderTax: string;
  unit: string;
};

export type HeldOrder = {
  id: string;
  /** ISO timestamp — when this order was parked. */
  heldAt: string;
  warehouseId: string;
  /** Snapshot of the warehouse's name at hold time, so the list still reads fine even if the warehouse is later renamed or removed. */
  warehouseName: string;
  customerId: string;
  customerName: string;
  items: HeldCartItem[];
  orderTaxPercent: string;
  discount: string;
  shipping: string;
};

const STORAGE_KEY = "gildedglow-pos-held-orders";

// Held orders are UI convenience state tied to one cashier's browser, not a
// business record — stock only ever moves at payment (createSale), so
// localStorage is enough; no schema/DB is needed for a parked cart. Both
// read and write guard against a corrupt or missing value rather than
// throwing, since a bad localStorage entry shouldn't break the POS screen.
export function loadHeldOrders(): HeldOrder[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHeldOrders(orders: HeldOrder[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    // Storage full/unavailable (private browsing, quota) — the in-memory
    // state still works for the rest of this tab's session, it just won't
    // survive a refresh.
  }
}
