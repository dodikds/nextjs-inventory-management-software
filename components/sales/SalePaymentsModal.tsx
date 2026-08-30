"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  getSalePaymentsForModal,
  addSalePayment,
  type SalePaymentsModalData,
} from "@/app/(dashboard)/sales/actions";
import { formatDateTimeChip, formatMoney } from "@/lib/format";
import styles from "./SalePaymentsModal.module.css";

type SalePaymentsModalProps = {
  saleId: string;
  reference: string;
  onClose: () => void;
};

const PAYMENT_STATUS_BADGE: Record<string, { label: string; variant: string }> = {
  PAID: { label: "Paid", variant: "gg-badge--success" },
  PARTIAL: { label: "Partial", variant: "gg-badge--warning" },
  UNPAID: { label: "Unpaid", variant: "gg-badge--danger" },
};

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Opened by SaleRowActions' "Show Payments" menu item. Not from a design
// mockup (no design/*.html covers this) — fetches its own data on open
// (getSalePaymentsForModal) rather than being passed the row's already-
// rendered figures, since those can be stale by the time the user opens it.
export default function SalePaymentsModal({ saleId, reference, onClose }: SalePaymentsModalProps) {
  const router = useRouter();
  const [data, setData] = useState<SalePaymentsModalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const [notes, setNotes] = useState("");
  const [isSubmitting, startSubmitTransition] = useTransition();

  // Fetches (or re-fetches, after adding a payment) this sale's payment
  // data. Deliberately doesn't toggle `isLoading` on a refetch — after
  // adding a payment the modal already has data on screen, so silently
  // replacing it reads better than flashing back to "Loading…".
  function fetchData() {
    return getSalePaymentsForModal(saleId).then((result) => {
      if (!result) {
        setLoadFailed(true);
        return;
      }
      setData(result);
    });
  }

  useEffect(() => {
    fetchData().finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saleId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startSubmitTransition(async () => {
      const result = await addSalePayment(saleId, { amount, paymentType, date, notes: notes || undefined });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Payment added");
      setAmount("");
      setPaymentType("");
      setDate(todayInputValue());
      setNotes("");
      fetchData();
      router.refresh();
    });
  }

  const isValid = amount.trim() !== "" && paymentType !== "" && date !== "";
  const paymentBadge = data ? PAYMENT_STATUS_BADGE[data.paymentStatus] : undefined;

  return (
    <div
      className="gg-overlay is-open"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="gg-modal" role="dialog" aria-modal="true" style={{ maxWidth: 640 }}>
        <div className="gg-modal-head">
          <span className="gg-card-title">Payments — {reference}</span>
          <button className="gg-modal-close" type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="gg-modal-body">
          {isLoading ? (
            <p className="gg-muted">Loading…</p>
          ) : loadFailed || !data ? (
            <p className="gg-muted">Couldn&apos;t load this sale&apos;s payments.</p>
          ) : (
            <>
              <div className={styles.summary}>
                <div className={styles["summary-item"]}>
                  <span className={styles["summary-label"]}>Grand Total</span>
                  <span className={`${styles["summary-value"]} gg-num`}>$ {formatMoney(data.grandTotal)}</span>
                </div>
                <div className={styles["summary-item"]}>
                  <span className={styles["summary-label"]}>Paid</span>
                  <span className={`${styles["summary-value"]} gg-num`}>$ {formatMoney(data.paid)}</span>
                </div>
                <div className={styles["summary-item"]}>
                  <span className={styles["summary-label"]}>Due</span>
                  <span className={`${styles["summary-value"]} gg-num`}>$ {formatMoney(data.due)}</span>
                </div>
                <div className={styles["summary-item"]}>
                  <span className={styles["summary-label"]}>Status</span>
                  <span>
                    {paymentBadge && <span className={`gg-badge ${paymentBadge.variant}`}>{paymentBadge.label}</span>}
                  </span>
                </div>
              </div>

              <div>
                <label className={`gg-label ${styles["section-label"]}`}>Payment History</label>
                {data.payments.length === 0 ? (
                  <p className="gg-muted" style={{ padding: "var(--sp-4) 0", textAlign: "center" }}>
                    No payments recorded yet.
                  </p>
                ) : (
                  <div className="gg-table-wrap">
                    <table className="gg-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Type</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="gg-num">{formatDateTimeChip(new Date(payment.date)).date}</td>
                            <td className="gg-num gg-td-strong">$ {formatMoney(payment.amount)}</td>
                            <td>
                              <span className="gg-chip-unit">{payment.paymentType}</span>
                            </td>
                            <td className="gg-muted">{payment.notes ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit}>
                <label className={`gg-label ${styles["section-label"]}`}>Add Payment</label>
                <div className={styles["add-form"]}>
                  <div className="gg-field">
                    <label className="gg-label" htmlFor="paymentAmount">
                      Amount <span className="gg-req">*</span>
                    </label>
                    <div className="gg-input-group">
                      <input
                        id="paymentAmount"
                        className="gg-input gg-num"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                      <span className="gg-input-suffix">$</span>
                    </div>
                  </div>
                  <div className="gg-field">
                    <label className="gg-label" htmlFor="paymentMethod">
                      Payment Type <span className="gg-req">*</span>
                    </label>
                    <select
                      id="paymentMethod"
                      className="gg-select"
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                    >
                      <option value="">Choose Payment Type</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                  <div className="gg-field">
                    <label className="gg-label" htmlFor="paymentDate">
                      Date <span className="gg-req">*</span>
                    </label>
                    <input
                      id="paymentDate"
                      type="date"
                      className="gg-input gg-num"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className="gg-field">
                    <label className="gg-label" htmlFor="paymentNotes">
                      Notes
                    </label>
                    <input
                      id="paymentNotes"
                      className="gg-input"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
                <div className="gg-form-actions" style={{ marginTop: "var(--sp-5)" }}>
                  <button className="gg-btn gg-btn--primary" type="submit" disabled={!isValid || isSubmitting}>
                    <Check /> {isSubmitting ? "Adding..." : "Add Payment"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
        <div className="gg-modal-foot">
          <button className="gg-btn gg-btn--secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
