"use client";

import { Clock, RotateCcw, Trash2, X } from "lucide-react";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import type { HeldOrder } from "./heldOrders";
import styles from "./HeldOrdersModal.module.css";

type HeldOrdersModalProps = {
  heldOrders: HeldOrder[];
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
  onClose: () => void;
};

// Same shared pricing utility every other total in POS/Sales goes through —
// a held order's total is just a preview for this list, recomputed fresh
// from its stored lines rather than a cached number that could drift.
function heldOrderTotal(held: HeldOrder) {
  const lineSubtotals = held.items.map(
    (item) =>
      calculateLineTotals({
        unitCost: item.unitPrice || 0,
        quantity: item.quantity,
        discountType: item.discountType,
        discount: item.discount || 0,
        taxType: item.taxType,
        taxRate: item.orderTax || 0,
      }).subtotal,
  );
  return calculateOrderTotals({
    lineSubtotals,
    orderTaxRate: held.orderTaxPercent || 0,
    discount: held.discount || 0,
    shipping: held.shipping || 0,
  }).grandTotal;
}

function formatHeldAt(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HeldOrdersModal({ heldOrders, onResume, onDiscard, onClose }: HeldOrdersModalProps) {
  return (
    <div
      className="gg-overlay is-open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gg-modal" role="dialog" aria-modal="true">
        <div className="gg-modal-head">
          <span className="gg-card-title">Held Orders</span>
          <button className="gg-modal-close" type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="gg-modal-body">
          {heldOrders.length === 0 ? (
            <div className={styles.empty}>No held orders. Use Hold to park the current cart.</div>
          ) : (
            <div className={styles.list}>
              {heldOrders.map((held) => (
                <div key={held.id} className={styles.row}>
                  <div className={styles.info}>
                    <div className={styles.customer}>{held.customerName}</div>
                    <div className={`${styles.meta} gg-num`}>
                      {held.warehouseName} · {held.items.length} item{held.items.length === 1 ? "" : "s"} · $
                      {formatMoney(heldOrderTotal(held))}
                    </div>
                    <div className={styles.heldAt}>
                      <Clock /> Held {formatHeldAt(held.heldAt)}
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className="gg-btn gg-btn--primary gg-btn--sm"
                      onClick={() => onResume(held.id)}
                    >
                      <RotateCcw /> Resume
                    </button>
                    <button
                      type="button"
                      className="gg-icon-btn"
                      style={{ border: "none", color: "var(--danger)" }}
                      title="Discard"
                      onClick={() => onDiscard(held.id)}
                    >
                      <Trash2 />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
