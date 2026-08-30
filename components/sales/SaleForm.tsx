"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Minus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Decimal from "decimal.js";
import toast from "react-hot-toast";
import {
  searchProductsForSale,
  createSale,
  updateSale,
  type SaleProductSearchResult,
} from "@/app/(dashboard)/sales/actions";
import { calculateLineTotals, calculateOrderTotals, type DiscountType, type TaxType } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import SaleItemModal, { type SaleItemModalValues } from "./SaleItemModal";
import styles from "./SaleForm.module.css";

type OptionItem = { id: string; name: string };
type CustomerOption = { id: string; name: string; isDefault: boolean };

type SaleStatus = "RECEIVED" | "PENDING" | "ORDERED";
type SalePaymentStatus = "UNPAID" | "PAID" | "PARTIAL";

// Every new line starts at zero discount/tax, matching design/Create
// Sale.html's own example row — a line only picks up a discount/tax once
// the pencil-icon modal is used to set one.
type SaleItemState = {
  productId: string;
  code: string;
  name: string;
  unitPrice: string;
  /** Current quantity in the selected warehouse — the ceiling this line can sell, enforced server-side on save. */
  stock: number;
  quantity: number;
  discountType: DiscountType;
  discount: string;
  taxType: TaxType;
  orderTax: string;
  unit: string;
};

// Pre-filled form state for edit mode — see
// app/(dashboard)/sales/[id]/edit/page.tsx (a later step), which will build
// this from the stored Sale and its items. `paid`/`paymentType` are the
// SALE'S OWN stored totals (the sum of its real SalePayment rows), included
// only for read-only display — see SaleForm's own comment below on why
// they're never editable here.
export type SaleFormInitialData = {
  id: string;
  date: string;
  warehouseId: string;
  customerId: string;
  items: SaleItemState[];
  orderTaxPercent: string;
  discount: string;
  shipping: string;
  status: SaleStatus;
  paid: string;
  paymentType: string;
  notes: string;
};

type SaleFormProps = {
  warehouses: OptionItem[];
  customers: CustomerOption[];
  units: OptionItem[];
  initialData?: SaleFormInitialData;
};

const SEARCH_DEBOUNCE_MS = 300;

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lineTotals(item: SaleItemState) {
  return calculateLineTotals({
    unitCost: item.unitPrice || 0,
    quantity: item.quantity,
    discountType: item.discountType,
    discount: item.discount || 0,
    taxType: item.taxType,
    taxRate: item.orderTax || 0,
  });
}

// paymentStatus is always DERIVED, never free-typed — see the Sale model's
// own schema comment. This is a client-side preview of the exact same rule
// the server applies (paid >= grandTotal -> Paid, 0 -> Unpaid, otherwise ->
// Partial); the server recomputes it independently from the real numbers
// on save, this is just so the (disabled) Payment Status field shown here
// isn't a lie while the user is still editing amounts.
function derivePaymentStatus(paid: Decimal.Value, grandTotal: Decimal): SalePaymentStatus {
  const paidAmount = new Decimal(paid || 0);
  if (paidAmount.lte(0)) return "UNPAID";
  if (paidAmount.gte(grandTotal)) return "PAID";
  return "PARTIAL";
}

export default function SaleForm({ warehouses, customers, units, initialData }: SaleFormProps) {
  const router = useRouter();
  const isEditing = initialData !== undefined;

  const [date, setDate] = useState(initialData?.date ?? todayInputValue);
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId ?? "");
  const [customerId, setCustomerId] = useState(
    initialData?.customerId ?? customers.find((customer) => customer.isDefault)?.id ?? "",
  );
  const [items, setItems] = useState<SaleItemState[]>(initialData?.items ?? []);

  const [orderTaxPercent, setOrderTaxPercent] = useState(initialData?.orderTaxPercent ?? "0.00");
  const [discount, setDiscount] = useState(initialData?.discount ?? "0.00");
  const [shipping, setShipping] = useState(initialData?.shipping ?? "0.00");
  const [status, setStatus] = useState<SaleStatus>(initialData?.status ?? "RECEIVED");
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  // design/Create Sale.html has no "amount paid" input at all — just a
  // freely-editable Payment Status <select>. But paymentStatus must always
  // be DERIVED from a real paid amount (see derivePaymentStatus above), so
  // on create this form adds an "Initial Payment" amount + type (creates a
  // SalePayment row on save — see the create action) instead of a
  // free-typed status. On EDIT, this pair is read-only: real payments are
  // only ever added through the dedicated "Show Payments" flow, never by
  // re-typing a number on this form — editing an existing sale must not be
  // able to corrupt its payment history.
  const [initialPaid, setInitialPaid] = useState("0.00");
  const [initialPaymentType, setInitialPaymentType] = useState("");

  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SaleProductSearchResult[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, startSearchTransition] = useTransition();
  const [isSaving, startSaveTransition] = useTransition();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function runSearch(query: string, forWarehouseId: string) {
    if (!forWarehouseId || query.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    startSearchTransition(async () => {
      const results = await searchProductsForSale(query.trim(), forWarehouseId);
      setSearchResults(results);
    });
  }

  function handleWarehouseChange(next: string) {
    // Same reasoning as Purchase Returns' own handleWarehouseChange: the
    // product search and every added line's "Stock" ceiling are scoped to
    // one warehouse — you can only sell what that warehouse holds. The
    // slate is wiped on a warehouse change rather than trying to carry
    // stale figures over.
    setWarehouseId(next);
    setItems([]);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchOpen(false);
  }

  function handleSearchChange(next: string) {
    setSearchQuery(next);
    setIsSearchOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(next, warehouseId), SEARCH_DEBOUNCE_MS);
  }

  function handleSelectProduct(product: SaleProductSearchResult) {
    if (items.some((item) => item.productId === product.id)) {
      toast.error(`${product.name} is already in this sale`);
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        code: product.code,
        name: product.name,
        unitPrice: product.unitPrice,
        stock: product.stock,
        quantity: 1,
        discountType: "FIXED",
        discount: "0.00",
        taxType: "EXCLUSIVE",
        orderTax: "0.00",
        unit: product.productUnit,
      },
    ]);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchOpen(false);
  }

  function updateItemUnitPrice(productId: string, unitPrice: string) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, unitPrice } : item)));
  }

  function updateItemQuantity(productId: string, quantity: number) {
    setItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item)),
    );
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

  const computedPaymentStatus = derivePaymentStatus(
    isEditing ? initialData.paid : initialPaid,
    orderTotals.grandTotal,
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startSaveTransition(async () => {
      const items_ = items.map((item) => ({
        productId: item.productId,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        discountType: item.discountType,
        discount: item.discount,
        taxType: item.taxType,
        orderTax: item.orderTax,
        unit: item.unit,
      }));

      // Editing intentionally never sends `paid`/`paymentType` — see
      // updateSale's own comment on why the payment fields are read-only in
      // edit mode and untouched by this save.
      const result = isEditing
        ? await updateSale(initialData.id, {
            date,
            warehouseId,
            customerId,
            items: items_,
            orderTax: orderTaxPercent,
            discount,
            shipping,
            status,
            notes: notes || undefined,
          })
        : await createSale({
            date,
            warehouseId,
            customerId,
            items: items_,
            orderTax: orderTaxPercent,
            discount,
            shipping,
            status,
            paid: initialPaid,
            paymentType: initialPaymentType || undefined,
            notes: notes || undefined,
          });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(isEditing ? "Sale updated" : "Sale created");
      router.push(isEditing ? `/sales/${result.id}` : "/sales");
    });
  }

  function handleCancel() {
    if (
      (items.length > 0 || warehouseId !== "" || customerId !== "") &&
      !window.confirm("You have unsaved changes. Discard them?")
    ) {
      return;
    }
    router.push(isEditing ? `/sales/${initialData.id}` : "/sales");
  }

  const isValid = date !== "" && warehouseId !== "" && customerId !== "" && items.length > 0;

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
            <label className="gg-label" htmlFor="warehouseId">
              Warehouse <span className="gg-req">*</span>
            </label>
            <select
              id="warehouseId"
              className="gg-select"
              value={warehouseId}
              onChange={(e) => handleWarehouseChange(e.target.value)}
              required
            >
              <option value="">Choose Warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="customerId">
              Customer <span className="gg-req">*</span>
            </label>
            <select
              id="customerId"
              className="gg-select"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
            >
              <option value="">Choose Customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="gg-field" style={{ marginBottom: "var(--sp-6)" }}>
          <label className="gg-label">Product</label>
          <div className={styles["search-wrap"]} ref={searchWrapRef}>
            <div className="gg-input-icon">
              <Search />
              <input
                className="gg-input"
                placeholder={warehouseId ? "Search Product by Code Name" : "Choose a warehouse first"}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchQuery && setIsSearchOpen(true)}
                disabled={!warehouseId}
              />
            </div>

            {isSearchOpen && warehouseId && (
              <div className={`gg-menu ${styles["search-results"]}`}>
                {isSearching ? (
                  <div className={styles["search-hint"]}>Searching…</div>
                ) : searchQuery.trim() === "" ? (
                  <div className={styles["search-hint"]}>Start typing a product&apos;s name or code.</div>
                ) : searchResults.length === 0 ? (
                  <div className={styles["search-hint"]}>No products with stock here found.</div>
                ) : (
                  searchResults.map((product) => (
                    <button
                      type="button"
                      key={product.id}
                      className={`gg-menu-item ${styles["search-result"]}`}
                      onClick={() => handleSelectProduct(product)}
                    >
                      <span className={styles["result-name"]}>{product.name}</span>
                      <span className="gg-chip-code">{product.code}</span>
                      <span className={`${styles["stock-chip"]} gg-num`}>{product.stock} in stock</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

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
                      {warehouseId ? "Search for a product above to add it." : "Choose a warehouse to start adding products."}
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
                          <button type="button" onClick={() => updateItemQuantity(item.productId, item.quantity + 1)}>
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

        {/* Not in design/Create Sale.html — see this component's own
            comment on why an initial-payment row replaces its free-typed
            Payment Status select. */}
        <div className={styles["three-col"]}>
          <div className="gg-field">
            <label className="gg-label" htmlFor="initialPaid">
              {isEditing ? "Paid" : "Initial Payment"}
            </label>
            {isEditing ? (
              <>
                <input className="gg-input gg-num" value={`$ ${formatMoney(initialData.paid)}`} disabled />
                <p className={styles["payment-note"]}>Manage payments via Show Payments.</p>
              </>
            ) : (
              <div className="gg-input-group">
                <input
                  id="initialPaid"
                  className="gg-input gg-num"
                  value={initialPaid}
                  onChange={(e) => setInitialPaid(e.target.value)}
                />
                <span className="gg-input-suffix">$</span>
              </div>
            )}
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="paymentType">
              Payment Type
            </label>
            <select
              id="paymentType"
              className="gg-select"
              value={isEditing ? initialData.paymentType : initialPaymentType}
              onChange={(e) => setInitialPaymentType(e.target.value)}
              disabled={isEditing}
            >
              <option value="">Choose Payment Type</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Cheque">Cheque</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>
          <div className="gg-field">
            <label className="gg-label" htmlFor="paymentStatus">
              Payment Status
            </label>
            <select id="paymentStatus" className="gg-select" value={computedPaymentStatus} disabled>
              <option value="UNPAID">Unpaid</option>
              <option value="PAID">Paid</option>
              <option value="PARTIAL">Partial</option>
            </select>
          </div>
        </div>

        <div className="gg-field" style={{ marginTop: "var(--sp-6)", maxWidth: 420 }}>
          <label className="gg-label" htmlFor="status">
            Status <span className="gg-req">*</span>
          </label>
          <select
            id="status"
            className="gg-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as SaleStatus)}
          >
            <option value="RECEIVED">Received</option>
            <option value="PENDING">Pending</option>
            <option value="ORDERED">Ordered</option>
          </select>
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
