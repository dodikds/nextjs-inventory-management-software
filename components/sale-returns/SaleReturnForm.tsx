"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { calculateLineTotals, calculateOrderTotals, type DiscountType, type TaxType } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import { createSaleReturn } from "@/app/(dashboard)/sales/returns/actions";
// Reused as-is from Sales — design/Edit Sale Return.html's item-edit modal
// has the exact same fields/labels ("Product Price"/"Sale Unit") as
// design/Create Sale.html's own, so a duplicate would just be the same 166
// lines twice (same reasoning Purchase Returns used to reuse
// PurchaseItemModal).
import SaleItemModal, { type SaleItemModalValues } from "@/components/sales/SaleItemModal";
import styles from "./SaleReturnForm.module.css";

type OptionItem = { id: string; name: string };
type SaleReturnStatus = "PENDING" | "RECEIVED" | "COMPLETED";

// Every line starts at what the sale itself charged — a return is "give
// back what was sold, at the same terms," not a fresh order — so nothing
// here resets to zero the way a brand-new Sale line would.
// `originalQuantity` is the ceiling the qty stepper enforces: this line can
// never claim to return more than the sale itself actually sold.
type SaleReturnItemState = {
  productId: string;
  code: string;
  name: string;
  unitPrice: string;
  /** Current quantity in the warehouse — informational only, same as Sale's own "Stock" column; the real ceiling is `originalQuantity`, not this. */
  stock: number;
  originalQuantity: number;
  quantity: number;
  discountType: DiscountType;
  discount: string;
  taxType: TaxType;
  orderTax: string;
  unit: string;
};

// The data this form always starts from — there's no truly-blank create
// state (see the create page's own comment): a return is always pre-filled
// from an existing sale. `returnId` is present only in edit mode (Step 5,
// reusing this same component pre-filled from the stored SaleReturn
// instead of the Sale); its absence is what this component uses to tell
// create and edit apart.
export type SaleReturnFormInitialData = {
  returnId?: string;
  saleId: string;
  saleReference: string;
  customerId: string;
  warehouseId: string;
  date: string;
  status: SaleReturnStatus;
  items: SaleReturnItemState[];
  orderTaxPercent: string;
  discount: string;
  shipping: string;
  notes: string;
};

type SaleReturnFormProps = {
  units: OptionItem[];
  data: SaleReturnFormInitialData;
};

function lineTotals(item: SaleReturnItemState) {
  return calculateLineTotals({
    unitCost: item.unitPrice || 0,
    quantity: item.quantity,
    discountType: item.discountType,
    discount: item.discount || 0,
    taxType: item.taxType,
    taxRate: item.orderTax || 0,
  });
}

export default function SaleReturnForm({ units, data }: SaleReturnFormProps) {
  const router = useRouter();
  const isEditing = data.returnId !== undefined;

  const [date, setDate] = useState(data.date);
  const [status, setStatus] = useState<SaleReturnStatus>(data.status);
  const [items, setItems] = useState<SaleReturnItemState[]>(data.items);
  const [orderTaxPercent, setOrderTaxPercent] = useState(data.orderTaxPercent);
  const [discount, setDiscount] = useState(data.discount);
  const [shipping, setShipping] = useState(data.shipping);
  const [notes, setNotes] = useState(data.notes);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  // No product search, no "add item" affordance anywhere in this form
  // (unlike every other order-form in this app) — design/Edit Sale
  // Return.html has none, and a return can only give back what the
  // original sale actually sold, never something new.
  function updateItemQuantity(productId: string, quantity: number) {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: Math.min(item.originalQuantity, Math.max(1, quantity)) }
          : item,
      ),
    );
  }

  function updateItemUnitPrice(productId: string, unitPrice: string) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, unitPrice } : item)));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
    if (editingProductId === productId) setEditingProductId(null);
  }

  function handleSaveItemModal(values: SaleItemModalValues) {
    setItems((prev) => prev.map((item) => (item.productId === editingProductId ? { ...item, ...values } : item)));
    setEditingProductId(null);
  }

  const editingItem = items.find((item) => item.productId === editingProductId) ?? null;

  const orderTotals = calculateOrderTotals({
    lineSubtotals: items.map((item) => lineTotals(item).subtotal),
    orderTaxRate: orderTaxPercent || 0,
    discount: discount || 0,
    shipping: shipping || 0,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startSaveTransition(async () => {
      // Editing isn't wired up yet — updateSaleReturn is a later step
      // (reconciling stock by difference, not a blind re-increment).
      if (isEditing) {
        toast("Editing isn't wired up yet — coming in a later step.");
        return;
      }

      const payload = {
        saleId: data.saleId,
        date,
        status,
        items: items.map((item) => ({
          productId: item.productId,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discountType: item.discountType,
          discount: item.discount,
          taxType: item.taxType,
          orderTax: item.orderTax,
          unit: item.unit,
        })),
        orderTax: orderTaxPercent,
        discount,
        shipping,
        notes: notes || undefined,
      };

      const result = await createSaleReturn(payload);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Sale return created");
      router.push("/sales/returns");
    });
  }

  function handleCancel() {
    if (!window.confirm("Discard this sale return?")) {
      return;
    }
    router.push(isEditing ? `/sales/returns/${data.returnId}` : `/sales/${data.saleId}`);
  }

  const isValid = date !== "" && items.length > 0;

  return (
    <div className="gg-card gg-card-pad">
      <form onSubmit={handleSubmit} noValidate>
        <div className={styles["pur-top"]}>
          <div className="gg-field">
            <label className="gg-label" htmlFor="date">
              Date <span className="gg-req">*</span>
            </label>
            <div className={styles["date-field"]}>
              <input
                id="date"
                type="date"
                className="gg-input gg-num"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <Calendar />
            </div>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="saleReference">
              Sale Reference <span className="gg-req">*</span>
            </label>
            <input id="saleReference" className="gg-input" value={data.saleReference} disabled />
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="status">
              Status <span className="gg-req">*</span>
            </label>
            <select
              id="status"
              className="gg-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as SaleReturnStatus)}
            >
              <option value="PENDING">Pending</option>
              <option value="RECEIVED">Received</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </div>
        </div>

        <div className={styles["list-label"]}>Product List</div>

        <label className="gg-label" style={{ display: "block", marginBottom: "var(--sp-3)" }}>
          Order items <span className="gg-req">*</span>
        </label>
        <div className="gg-table-wrap">
          <table className="gg-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Net Unit Price</th>
                <th>Stock</th>
                <th>Qty</th>
                <th>Discount</th>
                <th>Tax</th>
                <th>Subtotal</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="gg-muted" style={{ padding: "var(--sp-6) 0", textAlign: "center" }}>
                      All lines have been removed from this return.
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const { discountAmount, taxAmount, subtotal } = lineTotals(item);
                  return (
                    <tr key={item.productId}>
                      <td>
                        <div className={styles["prod-cell"]}>
                          <span className={styles["prod-code"]}>{item.code}</span>
                          <span className={styles["prod-name-row"]}>
                            <span className="gg-chip-unit">{item.name}</span>
                            <button
                              className={styles["prod-edit"]}
                              type="button"
                              title="Edit line details"
                              onClick={() => setEditingProductId(item.productId)}
                            >
                              <Pencil />
                            </button>
                          </span>
                        </div>
                      </td>
                      <td>
                        <input
                          className="gg-input gg-num"
                          style={{ maxWidth: 110 }}
                          value={item.unitPrice}
                          onChange={(e) => updateItemUnitPrice(item.productId, e.target.value)}
                        />
                      </td>
                      <td>
                        <span className={`${styles["stock-chip"]} gg-num`}>{item.stock}</span>
                      </td>
                      <td>
                        <div className="gg-stepper">
                          <button type="button" onClick={() => updateItemQuantity(item.productId, item.quantity - 1)}>
                            <Minus />
                          </button>
                          <input
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.productId, Number(e.target.value) || 1)}
                          />
                          <button
                            type="button"
                            disabled={item.quantity >= item.originalQuantity}
                            onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}
                            title={`Can't return more than the ${item.originalQuantity} originally sold`}
                          >
                            <Plus />
                          </button>
                        </div>
                      </td>
                      <td className="gg-num">$ {formatMoney(discountAmount)}</td>
                      <td className="gg-num">$ {formatMoney(taxAmount)}</td>
                      <td className="gg-num gg-td-strong">$ {formatMoney(subtotal)}</td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="gg-icon-btn"
                          type="button"
                          style={{ border: "none", color: "var(--danger)" }}
                          title="Remove"
                          onClick={() => removeItem(item.productId)}
                        >
                          <Trash2 />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={styles["totals-box"]}>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Order Tax</span>
            <span className={`${styles.val} gg-num`}>
              $ {formatMoney(orderTotals.orderTaxAmount)} ({formatMoney(orderTaxPercent || 0)}) %
            </span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Discount</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(discount || 0)}</span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Shipping</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(shipping || 0)}</span>
          </div>
          <div className={`${styles["totals-row"]} ${styles.grand}`}>
            <span className={styles.lbl}>Grand Total</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(orderTotals.grandTotal)}</span>
          </div>
        </div>

        <div className={styles["three-col"]}>
          <div className="gg-field">
            <label className="gg-label" htmlFor="orderTaxPercent">
              Order Tax
            </label>
            <div className="gg-input-group">
              <input
                id="orderTaxPercent"
                className="gg-input gg-num"
                value={orderTaxPercent}
                onChange={(e) => setOrderTaxPercent(e.target.value)}
              />
              <span className="gg-input-suffix">%</span>
            </div>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="discount">
              Discount
            </label>
            <div className="gg-input-group">
              <input
                id="discount"
                className="gg-input gg-num"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
              <span className="gg-input-suffix">$</span>
            </div>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="shipping">
              Shipping
            </label>
            <div className="gg-input-group">
              <input
                id="shipping"
                className="gg-input gg-num"
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
              />
              <span className="gg-input-suffix">$</span>
            </div>
          </div>
        </div>

        <div className="gg-field" style={{ marginTop: "var(--sp-5)" }}>
          <label className="gg-label" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            className="gg-textarea"
            placeholder="Enter Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="gg-form-actions">
          <button className="gg-btn gg-btn--primary" type="submit" disabled={!isValid || isSaving}>
            <Check /> {isSaving ? (isEditing ? "Updating..." : "Saving...") : isEditing ? "Update" : "Save"}
          </button>
          <button className="gg-btn gg-btn--secondary" type="button" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </button>
        </div>
      </form>

      {editingItem && (
        <SaleItemModal
          productName={editingItem.name}
          units={units}
          initialValues={{
            unitPrice: editingItem.unitPrice,
            taxType: editingItem.taxType,
            orderTax: editingItem.orderTax,
            discountType: editingItem.discountType,
            discount: editingItem.discount,
            unit: editingItem.unit,
          }}
          onSave={handleSaveItemModal}
          onClose={() => setEditingProductId(null)}
        />
      )}
    </div>
  );
}
