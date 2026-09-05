"use client";

import { useState } from "react";
import { Banknote, CheckCircle2, Printer, X } from "lucide-react";
import Decimal from "decimal.js";
import toast from "react-hot-toast";
import { formatMoney } from "@/lib/format";

export type PayNowResult = { success: true; saleId: string } | { success: false; message: string };

type PayNowModalProps = {
  grandTotal: Decimal;
  onSubmit: (values: { amountTendered: string; paymentType: string }) => Promise<PayNowResult>;
  onClose: () => void;
};

// Same four options as SaleForm's own Payment Type select — Sales doesn't
// export this as a shared constant, so this mirrors it rather than
// reaching into an unrelated component's internals for four strings.
const PAYMENT_TYPES = ["Cash", "Card", "Cheque", "Bank Transfer"];

const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

export default function PayNowModal({ grandTotal, onSubmit, onClose }: PayNowModalProps) {
  const [amountTendered, setAmountTendered] = useState(grandTotal.toFixed(2));
  const [paymentType, setPaymentType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);

  const isValidAmount = AMOUNT_PATTERN.test(amountTendered.trim());
  const change = isValidAmount ? Decimal.max(0, new Decimal(amountTendered).minus(grandTotal)) : new Decimal(0);
  const canConfirm = isValidAmount && paymentType !== "" && !isSubmitting;

  async function handleConfirm() {
    if (!canConfirm) return;
    setIsSubmitting(true);
    const result = await onSubmit({ amountTendered, paymentType });
    setIsSubmitting(false);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    setCompletedSaleId(result.saleId);
  }

  function handlePrintReceipt() {
    if (!completedSaleId) return;
    // Reuses the exact Sale view + its SaleDownloadButton (auto-triggers
    // window.print() off ?download=1) rather than building a separate
    // print view — same receipt every other Sale gets.
    window.open(`/sales/${completedSaleId}?download=1`, "_blank", "noopener,noreferrer");
  }

  if (completedSaleId) {
    return (
      <div className="gg-overlay is-open">
        <div className="gg-modal" role="dialog" aria-modal="true">
          <div className="gg-modal-head">
            <span className="gg-card-title">Sale Complete</span>
            <button className="gg-modal-close" type="button" onClick={onClose}>
              <X />
            </button>
          </div>
          <div className="gg-modal-body" style={{ alignItems: "center", textAlign: "center" }}>
            <CheckCircle2 style={{ width: 48, height: 48, color: "var(--success)" }} />
            <div>
              <div className="gg-card-title">Payment received</div>
              <p className="gg-muted" style={{ marginTop: 4 }}>
                The sale has been saved and appears in the Sales list like any other sale. Print a receipt for the
                customer, or close this to start the next one.
              </p>
            </div>
          </div>
          <div className="gg-modal-foot">
            <button className="gg-btn gg-btn--secondary" type="button" onClick={handlePrintReceipt}>
              <Printer /> Print Receipt
            </button>
            <button className="gg-btn gg-btn--primary" type="button" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="gg-overlay is-open"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="gg-modal" role="dialog" aria-modal="true">
        <div className="gg-modal-head">
          <span className="gg-card-title">Pay Now</span>
          <button className="gg-modal-close" type="button" onClick={onClose} disabled={isSubmitting}>
            <X />
          </button>
        </div>
        <div className="gg-modal-body">
          <div className="gg-field">
            <label className="gg-label">Total Due</label>
            <div className="gg-num" style={{ fontSize: 28, fontWeight: 700, color: "var(--ink)" }}>
              $ {formatMoney(grandTotal)}
            </div>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="amountTendered">
              Amount Tendered <span className="gg-req">*</span>
            </label>
            <div className="gg-input-group">
              <input
                id="amountTendered"
                className="gg-input gg-num"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
              <span className="gg-input-suffix">$</span>
            </div>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="paymentType">
              Payment Type <span className="gg-req">*</span>
            </label>
            <select
              id="paymentType"
              className="gg-select"
              value={paymentType}
              onChange={(e) => setPaymentType(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">Choose Payment Type</option>
              {PAYMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div className="gg-field">
            <label className="gg-label">Change</label>
            <div className="gg-num" style={{ fontSize: 20, fontWeight: 600, color: "var(--success-fg)" }}>
              $ {formatMoney(change)}
            </div>
          </div>
        </div>
        <div className="gg-modal-foot">
          <button className="gg-btn gg-btn--primary" type="button" onClick={handleConfirm} disabled={!canConfirm}>
            <Banknote /> {isSubmitting ? "Processing..." : "Confirm Payment"}
          </button>
          <button className="gg-btn gg-btn--secondary" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
