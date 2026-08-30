"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Minus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  searchProductsForTransfer,
  createTransfer,
  updateTransfer,
  type TransferProductSearchResult,
} from "@/app/(dashboard)/transfers/actions";
import { calculateLineTotals, calculateOrderTotals, type DiscountType, type TaxType } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import TransferItemModal, { type TransferItemModalValues } from "./TransferItemModal";
import styles from "./TransferForm.module.css";

type OptionItem = { id: string; name: string };

type TransferStatus = "PENDING" | "SENT" | "COMPLETED";

// Every new line starts at zero discount/tax, matching design/Create
// Transfer.html's own example row — a line only picks up a discount/tax
// once the pencil-icon modal is used to set one.
type TransferItemState = {
  productId: string;
  code: string;
  name: string;
  unitCost: string;
  /** Current quantity in the From warehouse — read-only reference only. */
  stock: number;
  quantity: number;
  discountType: DiscountType;
  discount: string;
  taxType: TaxType;
  orderTax: string;
  unit: string;
};

// Pre-filled form state for edit mode — see
// app/(dashboard)/transfers/[id]/edit/page.tsx (Step 5), which will build
// this from the stored Transfer and its items.
export type TransferFormInitialData = {
  id: string;
  date: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  items: TransferItemState[];
  orderTaxPercent: string;
  discount: string;
  shipping: string;
  status: TransferStatus;
  notes: string;
};

type TransferFormProps = {
  warehouses: OptionItem[];
  units: OptionItem[];
  initialData?: TransferFormInitialData;
};

const SEARCH_DEBOUNCE_MS = 300;

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lineTotals(item: TransferItemState) {
  return calculateLineTotals({
    unitCost: item.unitCost || 0,
    quantity: item.quantity,
    discountType: item.discountType,
    discount: item.discount || 0,
    taxType: item.taxType,
    taxRate: item.orderTax || 0,
  });
}

export default function TransferForm({ warehouses, units, initialData }: TransferFormProps) {
  const router = useRouter();
  const isEditing = initialData !== undefined;

  const [date, setDate] = useState(initialData?.date ?? todayInputValue);
  const [fromWarehouseId, setFromWarehouseId] = useState(initialData?.fromWarehouseId ?? "");
  const [toWarehouseId, setToWarehouseId] = useState(initialData?.toWarehouseId ?? "");
  const [items, setItems] = useState<TransferItemState[]>(initialData?.items ?? []);

  const [orderTaxPercent, setOrderTaxPercent] = useState(initialData?.orderTaxPercent ?? "0.00");
  const [discount, setDiscount] = useState(initialData?.discount ?? "0.00");
  const [shipping, setShipping] = useState(initialData?.shipping ?? "0.00");
  // "Completed" is the first (selected) option in design/Create Transfer.html's
  // own Status <select> — same reasoning as Purchase defaulting to its own
  // first option, "Received".
  const [status, setStatus] = useState<TransferStatus>(initialData?.status ?? "COMPLETED");
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TransferProductSearchResult[]>([]);
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

  function runSearch(query: string, forFromWarehouseId: string) {
    if (query.trim().length === 0 || forFromWarehouseId === "") {
      setSearchResults([]);
      return;
    }
    startSearchTransition(async () => {
      const results = await searchProductsForTransfer(query.trim(), forFromWarehouseId);
      setSearchResults(results);
    });
  }

  // Every already-added item's "Stock" figure — and the point of the search
  // below — is scoped to the From warehouse, and the search itself only
  // ever returns products that have stock *there* — so switching From
  // warehouses mid-build would leave stale, possibly-invalid rows around
  // (the new From warehouse might not carry that product at all). The
  // slate is wiped rather than trying to re-fetch stock for the new
  // warehouse under the same items — same choice Adjustments' own
  // single-warehouse-scoped form makes.
  function handleFromWarehouseChange(next: string) {
    setFromWarehouseId(next);
    setItems([]);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchOpen(false);
  }

  function handleSearchChange(next: string) {
    setSearchQuery(next);
    setIsSearchOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(next, fromWarehouseId), SEARCH_DEBOUNCE_MS);
  }

  function handleSelectProduct(product: TransferProductSearchResult) {
    if (items.some((item) => item.productId === product.id)) {
      toast.error(`${product.name} is already in this transfer`);
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        productId: product.id,
        code: product.code,
        name: product.name,
        unitCost: product.unitCost,
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

  function updateItemUnitCost(productId: string, unitCost: string) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, unitCost } : item)));
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

  function handleSaveItemModal(values: TransferItemModalValues) {
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

  const sameWarehouse = fromWarehouseId !== "" && toWarehouseId !== "" && fromWarehouseId === toWarehouseId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startSaveTransition(async () => {
      const payload = {
        date,
        fromWarehouseId,
        toWarehouseId,
        items: items.map((item) => ({
          productId: item.productId,
          unitCost: item.unitCost,
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
        status,
        notes: notes || undefined,
      };

      const result = isEditing ? await updateTransfer(initialData.id, payload) : await createTransfer(payload);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(isEditing ? "Transfer updated" : "Transfer created");
      router.push(isEditing ? `/transfers/${result.id}` : "/transfers");
    });
  }

  function handleCancel() {
    if (
      (items.length > 0 || fromWarehouseId !== "" || toWarehouseId !== "") &&
      !window.confirm("You have unsaved changes. Discard them?")
    ) {
      return;
    }
    router.push(isEditing ? `/transfers/${initialData.id}` : "/transfers");
  }

  const isValid =
    date !== "" &&
    fromWarehouseId !== "" &&
    toWarehouseId !== "" &&
    !sameWarehouse &&
    items.length > 0;

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
            <label className="gg-label" htmlFor="fromWarehouseId">
              From Warehouse <span className="gg-req">*</span>
            </label>
            <select
              id="fromWarehouseId"
              className="gg-select"
              value={fromWarehouseId}
              onChange={(e) => handleFromWarehouseChange(e.target.value)}
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
            <label className="gg-label" htmlFor="toWarehouseId">
              To Warehouse <span className="gg-req">*</span>
            </label>
            <select
              id="toWarehouseId"
              className="gg-select"
              value={toWarehouseId}
              onChange={(e) => setToWarehouseId(e.target.value)}
              required
            >
              <option value="">Choose Warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>
            {sameWarehouse && (
              <span className={styles["field-error"]}>From and To warehouses must be different</span>
            )}
          </div>
        </div>

        <div className="gg-field" style={{ marginBottom: "var(--sp-6)" }}>
          <label className="gg-label">Product</label>
          <div className={styles["search-wrap"]} ref={searchWrapRef}>
            <div className="gg-input-icon">
              <Search />
              <input
                className="gg-input"
                placeholder={fromWarehouseId ? "Search Product by Code Name" : "Choose a From warehouse first"}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchQuery && setIsSearchOpen(true)}
                disabled={!fromWarehouseId}
              />
            </div>

            {isSearchOpen && fromWarehouseId && (
              <div className={`gg-menu ${styles["search-results"]}`}>
                {isSearching ? (
                  <div className={styles["search-hint"]}>Searching…</div>
                ) : searchQuery.trim() === "" ? (
                  <div className={styles["search-hint"]}>Start typing a product&apos;s name or code.</div>
                ) : searchResults.length === 0 ? (
                  <div className={styles["search-hint"]}>No products with stock in this warehouse.</div>
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
                <th>Net Unit Cost</th>
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
                      {fromWarehouseId
                        ? "Search for a product above to add it."
                        : "Choose a From warehouse to start adding products."}
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
                          value={item.unitCost}
                          onChange={(e) => updateItemUnitCost(item.productId, e.target.value)}
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

        <div className="gg-field" style={{ marginTop: "var(--sp-8)", maxWidth: 520 }}>
          <label className="gg-label" htmlFor="status">
            Status <span className="gg-req">*</span>
          </label>
          <select
            id="status"
            className="gg-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as TransferStatus)}
          >
            <option value="COMPLETED">Completed</option>
            <option value="SENT">Sent</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>
        <div className="gg-field" style={{ marginTop: "var(--sp-5)" }}>
          <label className="gg-label" htmlFor="notes">
            Note
          </label>
          <textarea
            id="notes"
            className="gg-textarea"
            placeholder="Enter Note"
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
        <TransferItemModal
          productName={editingItem.name}
          units={units}
          initialValues={{
            unitCost: editingItem.unitCost,
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
