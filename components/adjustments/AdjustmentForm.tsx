"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Calendar, Check, Minus, Plus, Search, Trash2 } from "lucide-react";
import { createAdjustment, searchProductsForWarehouse, type ProductSearchResult } from "@/app/(dashboard)/adjustments/actions";
import styles from "./AdjustmentForm.module.css";

type OptionItem = { id: string; name: string };

type AdjustmentItemType = "ADDITION" | "SUBTRACTION";

type AdjustmentItemState = {
  productId: string;
  name: string;
  code: string;
  stock: number;
  quantity: number;
  type: AdjustmentItemType;
};

type AdjustmentFormProps = {
  warehouses: OptionItem[];
};

const SEARCH_DEBOUNCE_MS = 300;

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdjustmentForm({ warehouses }: AdjustmentFormProps) {
  const router = useRouter();

  const [warehouseId, setWarehouseId] = useState("");
  const [date, setDate] = useState(todayInputValue);
  const [items, setItems] = useState<AdjustmentItemState[]>([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductSearchResult[]>([]);
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
      const results = await searchProductsForWarehouse(forWarehouseId, query.trim());
      setSearchResults(results);
    });
  }

  function handleWarehouseChange(next: string) {
    // Every already-added item's "Stock" figure — and the point of the
    // search below — is scoped to one warehouse, so switching warehouses
    // mid-edit would leave stale figures around. The slate is wiped rather
    // than trying to re-fetch stock for the new warehouse under the same
    // items.
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

  function handleSelectProduct(product: ProductSearchResult) {
    if (items.some((item) => item.productId === product.id)) {
      toast.error(`${product.name} is already in this adjustment`);
      return;
    }
    setItems((prev) => [
      ...prev,
      { productId: product.id, name: product.name, code: product.code, stock: product.stock, quantity: 1, type: "ADDITION" },
    ]);
    setSearchQuery("");
    setSearchResults([]);
    setIsSearchOpen(false);
  }

  function updateItemQuantity(productId: string, quantity: number) {
    setItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item)),
    );
  }

  function updateItemType(productId: string, type: AdjustmentItemType) {
    setItems((prev) => prev.map((item) => (item.productId === productId ? { ...item, type } : item)));
  }

  function removeItem(productId: string) {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    startSaveTransition(async () => {
      const result = await createAdjustment({
        warehouseId,
        date,
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, type: item.type })),
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success("Adjustment created");
      router.push("/adjustments");
    });
  }

  const isValid = warehouseId !== "" && date !== "" && items.length > 0;

  function handleCancel() {
    if ((items.length > 0 || warehouseId !== "") && !window.confirm("You have unsaved changes. Discard them?")) {
      return;
    }
    router.push("/adjustments");
  }

  return (
    <div className="gg-card gg-card-pad">
      <form onSubmit={handleSubmit} noValidate>
        <div className={styles["adj-top"]}>
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
        </div>

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
                    <span className={`${styles["stock-chip"]} gg-num`}>{product.stock} in stock</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="gg-table-wrap" style={{ marginTop: "var(--sp-6)" }}>
          <table className="gg-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Code Product</th>
                <th>Stock</th>
                <th>Qty</th>
                <th>Type</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="gg-muted" style={{ padding: "var(--sp-6) 0", textAlign: "center" }}>
                      {warehouseId ? "Search for a product above to add it." : "Choose a warehouse to start adding products."}
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.productId}>
                    <td className="gg-td-strong">{item.name}</td>
                    <td className="gg-num">{item.code}</td>
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
                    <td>
                      <select
                        className="gg-select"
                        value={item.type}
                        onChange={(e) => updateItemType(item.productId, e.target.value as AdjustmentItemType)}
                      >
                        <option value="ADDITION">Addition</option>
                        <option value="SUBTRACTION">Subtraction</option>
                      </select>
                    </td>
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
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="gg-form-actions">
          <button className="gg-btn gg-btn--primary" type="submit" disabled={!isValid || isSaving}>
            <Check /> {isSaving ? "Saving..." : "Save"}
          </button>
          <button className="gg-btn gg-btn--secondary" type="button" onClick={handleCancel} disabled={isSaving}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
