"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, Minus, Pencil, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  searchProductsForPurchase,
  getProductStocksForWarehouse,
  createPurchase,
  updatePurchase,
  type PurchaseProductSearchResult,
} from "@/app/(dashboard)/purchases/actions";
import { calculateLineTotals, calculateOrderTotals, type DiscountType, type TaxType } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import PurchaseItemModal, { type PurchaseItemModalValues } from "./PurchaseItemModal";
import styles from "./PurchaseForm.module.css";

type OptionItem = { id: string; name: string };

type PurchaseStatus = "RECEIVED" | "PENDING" | "ORDERED";

// Every new line starts at zero discount/tax, matching design/Create
// Purchase.html's own example rows — a line only picks up a discount/tax
// once the pencil-icon modal is used to set one.
type PurchaseItemState = {
  productId: string;
  code: string;
  name: string;
  unitCost: string;
  /** Current quantity in the selected warehouse — read-only reference only. */
  stock: number;
  quantity: number;
  discountType: DiscountType;
  discount: string;
  taxType: TaxType;
  orderTax: string;
  unit: string;
};

// Pre-filled form state for edit mode — see
// app/(dashboard)/purchases/[id]/edit/page.tsx, which builds this from the
// stored Purchase and its items.
export type PurchaseFormInitialData = {
  id: string;
  date: string;
  warehouseId: string;
  supplierId: string;
  items: PurchaseItemState[];
  orderTaxPercent: string;
  discount: string;
  shipping: string;
  status: PurchaseStatus;
  notes: string;
};

type PurchaseFormProps = {
  warehouses: OptionItem[];
  suppliers: OptionItem[];
  units: OptionItem[];
  initialData?: PurchaseFormInitialData;
};

const SEARCH_DEBOUNCE_MS = 300;

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lineTotals(item: PurchaseItemState) {
  return calculateLineTotals({
    unitCost: item.unitCost || 0,
    quantity: item.quantity,
    discountType: item.discountType,
    discount: item.discount || 0,
    taxType: item.taxType,
    taxRate: item.orderTax || 0,
  });
}

export default function PurchaseForm({ warehouses, suppliers, units, initialData }: PurchaseFormProps) {
  const router = useRouter();
  const isEditing = initialData !== undefined;

  const [date, setDate] = useState(initialData?.date ?? todayInputValue);
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId ?? "");
  const [supplierId, setSupplierId] = useState(initialData?.supplierId ?? "");
  const [items, setItems] = useState<PurchaseItemState[]>(initialData?.items ?? []);

  const [orderTaxPercent, setOrderTaxPercent] = useState(initialData?.orderTaxPercent ?? "0.00");
  const [discount, setDiscount] = useState(initialData?.discount ?? "0.00");
  const [shipping, setShipping] = useState(initialData?.shipping ?? "0.00");
  const [status, setStatus] = useState<PurchaseStatus>(initialData?.status ?? "RECEIVED");
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PurchaseProductSearchResult[]>([]);
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
    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }
    startSearchTransition(async () => {
      const results = await searchProductsForPurchase(query.trim(), forWarehouseId);
      setSearchResults(results);
    });
  }

  function handleWarehouseChange(next: string) {
    setWarehouseId(next);

    // Unlike Adjustments, changing warehouse does NOT clear the items list
    // — nothing about a line (cost, qty, discount, tax) depends on which
    // warehouse it'll receive into. Only the read-only "Stock" reference
    // column needs to be refreshed for the newly selected warehouse.
    if (items.length > 0) {
      const productIds = items.map((item) => item.productId);
      getProductStocksForWarehouse(productIds, next).then((stockByProductId) => {
        setItems((prev) => prev.map((item) => ({ ...item, stock: stockByProductId[item.productId] ?? 0 })));
      });
    }
  }

  function handleSearchChange(next: string) {
    setSearchQuery(next);
    setIsSearchOpen(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(next, warehouseId), SEARCH_DEBOUNCE_MS);
  }

  function handleSelectProduct(product: PurchaseProductSearchResult) {
    if (items.some((item) => item.productId === product.id)) {
      toast.error(`${product.name} is already in this purchase`);
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

  function handleSaveItemModal(values: PurchaseItemModalValues) {
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
      const payload = {
        date,
        warehouseId,
        supplierId,
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

      const result = isEditing ? await updatePurchase(initialData.id, payload) : await createPurchase(payload);

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(isEditing ? "Purchase updated" : "Purchase created");
      router.push(isEditing ? `/purchases/${result.id}` : "/purchases");
    });
  }

  function handleCancel() {
    if (
      (items.length > 0 || warehouseId !== "" || supplierId !== "") &&
      !window.confirm("You have unsaved changes. Discard them?")
    ) {
      return;
    }
    router.push(isEditing ? `/purchases/${initialData.id}` : "/purchases");
  }

  const isValid = date !== "" && warehouseId !== "" && supplierId !== "" && items.length > 0;

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
            <label className="gg-label" htmlFor="supplierId">
              Supplier <span className="gg-req">*</span>
            </label>
            <select
              id="supplierId"
              className="gg-select"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
            >
              <option value="">Choose Supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
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
                placeholder="Search Product by Code Name"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onFocus={() => searchQuery && setIsSearchOpen(true)}
              />
            </div>

            {isSearchOpen && (
              <div className={`gg-menu ${styles["search-results"]}`}>
                {isSearching ? (
                  <div className={styles["search-hint"]}>Searching…</div>
                ) : searchQuery.trim() === "" ? (
                  <div className={styles["search-hint"]}>Start typing a product&apos;s name or code.</div>
                ) : searchResults.length === 0 ? (
                  <div className={styles["search-hint"]}>No products found.</div>
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
                      {warehouseId && (
                        <span className={`${styles["stock-chip"]} gg-num`}>{product.stock} in stock</span>
                      )}
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
                      Search for a product above to add it.
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

        <div className="gg-field" style={{ marginTop: "var(--sp-6)", maxWidth: 420 }}>
          <label className="gg-label" htmlFor="status">
            Status <span className="gg-req">*</span>
          </label>
          <select
            id="status"
            className="gg-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as PurchaseStatus)}
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
        <PurchaseItemModal
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
