"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  User,
  UserPlus,
  Home,
  ChevronDown,
  Search,
  List,
  ShoppingBag,
  ShoppingCart,
  Maximize,
  Minimize,
  Calculator,
  Gauge,
  Sparkles,
  Hand,
  RotateCw,
  Banknote,
  PackageSearch,
  Minus,
  Plus,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import toast from "react-hot-toast";
import { calculateLineTotals, calculateOrderTotals, type DiscountType, type TaxType } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import { getPosProducts, type PosProduct } from "@/app/(pos)/pos/actions";
import SaleItemModal, { type SaleItemModalValues } from "@/components/sales/SaleItemModal";
import HeldOrdersModal from "./HeldOrdersModal";
import { loadHeldOrders, saveHeldOrders, type HeldOrder } from "./heldOrders";
import styles from "./PosScreen.module.css";

type OptionItem = { id: string; name: string };
type CustomerOption = { id: string; name: string; isDefault: boolean };

type PosScreenProps = {
  warehouses: OptionItem[];
  customers: CustomerOption[];
  categories: OptionItem[];
  brands: OptionItem[];
  units: OptionItem[];
};

// Same shape as SaleForm's own SaleItemState — a cart line is a Sale line
// that just hasn't been saved yet. Every new line starts at zero discount,
// matching design/Create Sale.html's own example row; a line only picks up
// a discount/tax once the pencil-icon modal (SaleItemModal, reused verbatim
// from Sales) is used to set one.
type CartItem = {
  productId: string;
  code: string;
  name: string;
  unitPrice: string;
  /** Current quantity in the selected warehouse — a UX hint only (Step 3); the authoritative check happens server-side at payment. */
  stock: number;
  quantity: number;
  discountType: DiscountType;
  discount: string;
  taxType: TaxType;
  orderTax: string;
  unit: string;
};

function lineTotals(item: CartItem) {
  return calculateLineTotals({
    unitCost: item.unitPrice || 0,
    quantity: item.quantity,
    discountType: item.discountType,
    discount: item.discount || 0,
    taxType: item.taxType,
    taxRate: item.orderTax || 0,
  });
}

// No real product photography is wired into POS yet — a deterministic
// gradient per product (hashed from its code) stands in for a thumbnail,
// same visual language as design/POS.html's hardcoded per-product colors.
const CARD_GRADIENTS: [string, string][] = [
  ["#E48FA6", "#C75C7E"],
  ["#9FB6C9", "#6E8BA6"],
  ["#8FC9A6", "#4E9E73"],
  ["#E8A6B4", "#D06A82"],
  ["#E79BB0", "#CE6B88"],
  ["#C9B48F", "#A6824E"],
  ["#9F9FC9", "#6E6EA6"],
];

function gradientFor(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length];
}

// A module-scope helper (rather than inline in handleHold) so the
// impure-by-nature Date.now()/crypto.randomUUID() calls aren't attributed
// to the component's own render body.
function generateHeldOrderId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `held-${Date.now()}`;
}

export default function PosScreen({ warehouses, customers, categories, brands, units }: PosScreenProps) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [customerId, setCustomerId] = useState(
    customers.find((customer) => customer.isDefault)?.id ?? customers[0]?.id ?? "",
  );

  const [products, setProducts] = useState<PosProduct[]>([]);
  const [isLoadingProducts, startLoadTransition] = useTransition();

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);

  const [isWarehouseMenuOpen, setIsWarehouseMenuOpen] = useState(false);
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [orderTaxPercent, setOrderTaxPercent] = useState("0.00");
  const [discount, setDiscount] = useState("0.00");
  const [shipping, setShipping] = useState("0.00");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);

  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [isHeldOrdersModalOpen, setIsHeldOrdersModalOpen] = useState(false);
  const hasLoadedHeldOrders = useRef(false);
  const [, startHeldOrdersLoadTransition] = useTransition();

  const whRef = useRef<HTMLDivElement>(null);
  const custRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (whRef.current && !whRef.current.contains(e.target as Node)) setIsWarehouseMenuOpen(false);
      if (custRef.current && !custRef.current.contains(e.target as Node)) setIsCustomerMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // localStorage only exists client-side, so held orders load in an effect
  // rather than in useState's initializer — that keeps the very first
  // render (server-rendered, then hydrated) at an empty list on both sides,
  // avoiding a hydration mismatch, then syncs in the real list right after.
  // Wrapped in startTransition (same as the product loader below) so the
  // setState isn't a direct, synchronous call inside the effect body.
  useEffect(() => {
    startHeldOrdersLoadTransition(async () => {
      setHeldOrders(loadHeldOrders());
    });
  }, []);

  // Skips the first run (the initial, still-loading [] from the mount
  // above) so it can never race ahead of the load effect and clobber
  // storage with an empty array before the real list has been read in.
  useEffect(() => {
    if (!hasLoadedHeldOrders.current) {
      hasLoadedHeldOrders.current = true;
      return;
    }
    saveHeldOrders(heldOrders);
  }, [heldOrders]);

  // The only "load products" server call the screen makes (see AGENTS.md) —
  // fired on mount and whenever the warehouse changes; every other filter
  // (search/category/brand) runs client-side against this same list.
  useEffect(() => {
    // products starts at [] and warehouseId only ever moves from empty to a
    // real id (never back), so there's nothing to reset here.
    if (!warehouseId) return;
    startLoadTransition(async () => {
      const results = await getPosProducts(warehouseId);
      setProducts(results);
    });
  }, [warehouseId]);

  function handleWarehouseSelect(id: string) {
    if (id === warehouseId) {
      setIsWarehouseMenuOpen(false);
      return;
    }
    if (cartItems.length > 0 && !window.confirm("Switching warehouses will clear the current cart. Continue?")) {
      setIsWarehouseMenuOpen(false);
      return;
    }
    setWarehouseId(id);
    setIsWarehouseMenuOpen(false);
    // Same reasoning as SaleForm's own handleWarehouseChange — stock and the
    // product grid are scoped to one warehouse, so filters (and any cart
    // lines, which reference this warehouse's stock) are wiped rather than
    // carrying stale results over.
    setSearchQuery("");
    setCategoryId(null);
    setBrandId(null);
    setCartItems([]);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {
        toast.error("Fullscreen isn't available in this browser");
      });
    }
  }

  function stub(label: string) {
    toast(`${label} — coming soon`);
  }

  // Clicking a product adds it to the cart, or increments the existing
  // line's quantity if it's already there — never a second row for the same
  // product. Stock is a client-side HINT only (Step 3) — createSale's own
  // adjustProductStock call is the real, authoritative guard at payment
  // time, so this never blocks adding a line outright; it only stops the
  // cashier from silently stepping past what this warehouse shows in stock.
  // toast() is a side effect (it updates the Toaster's own state), so it
  // can't run inside a setCartItems updater callback — React may invoke
  // that callback more than once, and doing so while another component is
  // rendering trips "Cannot update a component while rendering a different
  // component". The stock check reads straight from the cartItems closure
  // instead, and toast/setCartItems run as separate, ordinary statements.
  function handleSelectProduct(product: PosProduct) {
    const existing = cartItems.find((item) => item.productId === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) {
        toast.error(`Only ${product.stock} ${product.productUnit} of "${product.name}" in stock here`);
        return;
      }
      setCartItems((prev) =>
        prev.map((item) => (item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item)),
      );
      return;
    }

    if (product.stock <= 0) {
      toast(`"${product.name}" is out of stock here — added anyway, payment will confirm the real stock`, {
        icon: "⚠️",
      });
    }
    setCartItems((prev) => [
      ...prev,
      {
        productId: product.id,
        code: product.code,
        name: product.name,
        unitPrice: product.price,
        stock: product.stock,
        quantity: 1,
        discountType: "FIXED",
        discount: "0.00",
        taxType: product.taxType,
        orderTax: product.orderTax,
        unit: product.productUnit,
      },
    ]);
  }

  function decrementItem(productId: string) {
    setCartItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item)),
    );
  }

  // Same stock ceiling as handleSelectProduct's own increment path — the
  // stepper is the other place a line's quantity can grow, so it needs the
  // same hint-only cap.
  function incrementItem(productId: string) {
    const item = cartItems.find((i) => i.productId === productId);
    if (!item) return;
    if (item.quantity >= item.stock) {
      toast.error(`Only ${item.stock} ${item.unit} of "${item.name}" in stock here`);
      return;
    }
    setCartItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i)),
    );
  }

  function removeItem(productId: string) {
    setCartItems((prev) => prev.filter((item) => item.productId !== productId));
    if (editingProductId === productId) setEditingProductId(null);
  }

  function handleSaveItemModal(values: SaleItemModalValues) {
    setCartItems((prev) => prev.map((item) => (item.productId === editingProductId ? { ...item, ...values } : item)));
    setEditingProductId(null);
  }

  function handleReset() {
    setCartItems([]);
    setOrderTaxPercent("0.00");
    setDiscount("0.00");
    setShipping("0.00");
  }

  // Parks the current cart so the cashier can start a new one — a held
  // order is never a Sale and never touches stock (see AGENTS.md); it's
  // just this same cart/customer/warehouse state, snapshotted to
  // localStorage until it's resumed or discarded.
  function handleHold() {
    if (cartItems.length === 0) return;
    const held: HeldOrder = {
      id: generateHeldOrderId(),
      heldAt: new Date().toISOString(),
      warehouseId,
      warehouseName: selectedWarehouse?.name ?? "Unknown warehouse",
      customerId,
      customerName: selectedCustomer?.name ?? "Unknown customer",
      items: cartItems,
      orderTaxPercent,
      discount,
      shipping,
    };
    setHeldOrders((prev) => [held, ...prev]);
    setCartItems([]);
    setOrderTaxPercent("0.00");
    setDiscount("0.00");
    setShipping("0.00");
    setCustomerId(customers.find((customer) => customer.isDefault)?.id ?? customers[0]?.id ?? "");
    toast.success("Order held — resume it anytime from the list");
  }

  function handleResumeHeldOrder(id: string) {
    const held = heldOrders.find((order) => order.id === id);
    if (!held) return;
    if (cartItems.length > 0 && !window.confirm("Resuming will replace your current cart. Continue?")) {
      return;
    }
    setWarehouseId(held.warehouseId);
    setCustomerId(held.customerId);
    setCartItems(held.items);
    setOrderTaxPercent(held.orderTaxPercent);
    setDiscount(held.discount);
    setShipping(held.shipping);
    setSearchQuery("");
    setCategoryId(null);
    setBrandId(null);
    setHeldOrders((prev) => prev.filter((order) => order.id !== id));
    setIsHeldOrdersModalOpen(false);
    toast.success("Order resumed");
  }

  function handleDiscardHeldOrder(id: string) {
    if (!window.confirm("Discard this held order? This can't be undone.")) return;
    setHeldOrders((prev) => prev.filter((order) => order.id !== id));
  }

  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId) ?? null;
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;
  const editingItem = cartItems.find((item) => item.productId === editingProductId) ?? null;

  const query = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) return false;
    if (brandId && product.brandId !== brandId) return false;
    if (query && !product.name.toLowerCase().includes(query) && !product.code.toLowerCase().includes(query)) {
      return false;
    }
    return true;
  });

  // Every number the cart shows comes from the same shared pricing utility
  // Sales itself uses (lib/pricing.ts) — createSale recomputes these exact
  // figures server-side from the raw inputs, so nothing here can drift from
  // what the saved Sale ends up with.
  const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const orderTotals = calculateOrderTotals({
    lineSubtotals: cartItems.map((item) => lineTotals(item).subtotal),
    orderTaxRate: orderTaxPercent || 0,
    discount: discount || 0,
    shipping: shipping || 0,
  });

  return (
    <div className={styles.pos}>
      {/* ============================= LEFT : CART ============================= */}
      <div className={styles.col}>
        <div className={styles.bar}>
          <div className={styles.custWrap} ref={custRef}>
            <div className={styles.custBox}>
              <button
                type="button"
                className={styles.custWho}
                onClick={() => setIsCustomerMenuOpen((open) => !open)}
              >
                <User />
                <span>{selectedCustomer?.name ?? "Choose customer"}</span>
              </button>
              <button
                type="button"
                className={styles.custAdd}
                title="Add customer"
                onClick={() => stub("Add customer")}
              >
                <UserPlus />
              </button>
            </div>
            {isCustomerMenuOpen && (
              <div className={`gg-menu ${styles.pickerMenu}`}>
                {customers.length === 0 ? (
                  <div className={styles.pickerHint}>No customers yet.</div>
                ) : (
                  customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="gg-menu-item"
                      onClick={() => {
                        setCustomerId(customer.id);
                        setIsCustomerMenuOpen(false);
                      }}
                    >
                      <User /> {customer.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <div className={styles.whBox} ref={whRef} onClick={() => setIsWarehouseMenuOpen((open) => !open)}>
            <Home className={styles.h} />
            <span className={styles.nm}>{selectedWarehouse?.name ?? "Choose warehouse"}</span>
            <ChevronDown className={styles.c} />
            {isWarehouseMenuOpen && (
              <div className={`gg-menu ${styles.pickerMenu}`} onClick={(e) => e.stopPropagation()}>
                {warehouses.length === 0 ? (
                  <div className={styles.pickerHint}>No warehouses yet.</div>
                ) : (
                  warehouses.map((warehouse) => (
                    <div
                      key={warehouse.id}
                      className="gg-menu-item"
                      onClick={() => handleWarehouseSelect(warehouse.id)}
                    >
                      <Home /> {warehouse.name}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className={styles.cart}>
          <div className={styles.cartHead}>
            <span>Product</span>
            <span style={{ textAlign: "center" }}>Qty</span>
            <span>Price</span>
            <span>Sub Total</span>
            <span></span>
          </div>
          <div className={styles.cartBody}>
            {cartItems.length === 0 ? (
              <div className={styles.cartEmpty}>
                <ShoppingCart />
                <span>Cart is empty — tap a product to add it here.</span>
              </div>
            ) : (
              cartItems.map((item) => {
                const { subtotal } = lineTotals(item);
                // Hint only — createSale's own stock check at payment is
                // authoritative, this just flags it early for the cashier.
                const isOverStock = item.quantity > item.stock;
                const atStockCeiling = item.quantity >= item.stock;
                return (
                  <div
                    key={item.productId}
                    className={`${styles.cartRow} ${isOverStock ? styles.cartRowWarn : ""}`}
                  >
                    <div className={styles.lineInfo}>
                      <div className={styles.lineName}>{item.name}</div>
                      <div className={styles.lineMeta}>
                        <span className={styles.lineCode}>{item.code}</span>
                        <button
                          type="button"
                          className={styles.lineEdit}
                          title="Edit line details"
                          onClick={() => setEditingProductId(item.productId)}
                        >
                          <Pencil />
                        </button>
                        {isOverStock && (
                          <span className={styles.stockWarn} title={`Only ${item.stock} ${item.unit} in stock here`}>
                            <TriangleAlert />
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.qtyCell}>
                      <div className={styles.stepper}>
                        <button
                          type="button"
                          className={styles.stepBtn}
                          onClick={() => decrementItem(item.productId)}
                        >
                          <Minus />
                        </button>
                        <span className={`${styles.stepQty} gg-num`}>{item.quantity}</span>
                        <button
                          type="button"
                          className={styles.stepBtn}
                          onClick={() => incrementItem(item.productId)}
                          disabled={atStockCeiling}
                          title={atStockCeiling ? `Only ${item.stock} ${item.unit} in stock here` : undefined}
                        >
                          <Plus />
                        </button>
                      </div>
                      <div className={`${styles.stockHint} ${isOverStock ? styles.stockHintWarn : ""} gg-num`}>
                        {isOverStock ? `Only ${item.stock} in stock` : `${item.stock} in stock`}
                      </div>
                    </div>
                    <div className={`${styles.linePrice} gg-num`}>$ {formatMoney(item.unitPrice)}</div>
                    <div className={`${styles.lineSub} gg-num`}>$ {formatMoney(subtotal)}</div>
                    <button
                      type="button"
                      className={styles.lineDel}
                      title="Remove"
                      onClick={() => removeItem(item.productId)}
                    >
                      <Trash2 />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className={styles.cartFoot}>
            <div className={styles.footGrid}>
              <div className={styles.footFields}>
                <div className={styles.footInput}>
                  <input
                    placeholder="Tax"
                    value={orderTaxPercent}
                    onChange={(e) => setOrderTaxPercent(e.target.value)}
                  />
                  <span className={styles.suf}>%</span>
                </div>
                <div className={styles.footInput}>
                  <input placeholder="Discount" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                  <span className={styles.suf}>$</span>
                </div>
                <div className={styles.footInput}>
                  <input placeholder="Shipping" value={shipping} onChange={(e) => setShipping(e.target.value)} />
                  <span className={styles.suf}>$</span>
                </div>
              </div>
              <div className={styles.totals}>
                <div className={`${styles.tq} gg-num`}>
                  Total QTY : <span>{totalQty}</span>
                </div>
                <div className={`${styles.st} gg-num`}>
                  Sub Total : $ <span>{formatMoney(orderTotals.itemsTotal)}</span>
                </div>
                <div className={`${styles.gt} gg-num`}>
                  Total : <b>$ {formatMoney(orderTotals.grandTotal)}</b>
                </div>
              </div>
            </div>
            <div className={styles.cartActions}>
              <button
                type="button"
                className={`${styles.posBtn} ${styles.btnHold}`}
                disabled={cartItems.length === 0}
                onClick={handleHold}
              >
                Hold <Hand />
              </button>
              <button
                type="button"
                className={`${styles.posBtn} ${styles.btnReset}`}
                disabled={cartItems.length === 0}
                onClick={handleReset}
              >
                Reset <RotateCw />
              </button>
              <button
                type="button"
                className={`${styles.posBtn} ${styles.btnPay}`}
                disabled={cartItems.length === 0}
                onClick={() => stub("Pay Now (Step 5)")}
              >
                Pay Now <Banknote />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================= RIGHT : PRODUCTS ======================= */}
      <div className={styles.col}>
        <div className={styles.bar}>
          <div className={styles.searchBox}>
            <Search />
            <input
              placeholder="Scan/Search Product by Code Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.tools}>
            <button
              type="button"
              className={`${styles.tool} ${styles.toolRose}`}
              title="Held orders"
              onClick={() => setIsHeldOrdersModalOpen(true)}
            >
              <List />
              <span className={`${styles.badge} gg-num`}>{heldOrders.length}</span>
            </button>
            <button
              type="button"
              className={`${styles.tool} ${styles.toolGreen}`}
              title="Cart view"
              onClick={() => stub("Cart view")}
            >
              <ShoppingBag />
            </button>
            <button
              type="button"
              className={`${styles.tool} ${styles.toolGold}`}
              title="Fullscreen"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize /> : <Maximize />}
            </button>
            <button
              type="button"
              className={`${styles.tool} ${styles.toolGold}`}
              title="Calculator"
              onClick={() => stub("Calculator")}
            >
              <Calculator />
            </button>
            <button
              type="button"
              className={`${styles.tool} ${styles.toolGold}`}
              title="Sales gauge"
              onClick={() => stub("Sales gauge")}
            >
              <Gauge />
            </button>
          </div>
        </div>

        <div className={styles.prods}>
          <div className={styles.chipRow}>
            <button
              type="button"
              className={`${styles.fchip} ${categoryId === null ? styles.fchipActive : ""}`}
              onClick={() => setCategoryId(null)}
            >
              All Categories
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`${styles.fchip} ${categoryId === category.id ? styles.fchipActive : ""}`}
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className={styles.chipRow}>
            <button
              type="button"
              className={`${styles.fchip} ${brandId === null ? styles.fchipActive : ""}`}
              onClick={() => setBrandId(null)}
            >
              All Brands
            </button>
            {brands.map((brand) => (
              <button
                key={brand.id}
                type="button"
                className={`${styles.fchip} ${brandId === brand.id ? styles.fchipActive : ""}`}
                onClick={() => setBrandId(brand.id)}
              >
                {brand.name}
              </button>
            ))}
          </div>

          <div className={styles.gridWrap}>
            {!warehouseId ? (
              <div className={styles.prodEmpty}>
                <PackageSearch />
                <span>Choose a warehouse to load its products.</span>
              </div>
            ) : isLoadingProducts ? (
              <div className={styles.prodEmpty}>
                <span>Loading products…</span>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className={styles.prodEmpty}>
                <PackageSearch />
                <span>No products match these filters.</span>
              </div>
            ) : (
              <div className={styles.prodGrid}>
                {filteredProducts.map((product) => {
                  const [c1, c2] = gradientFor(product.code || product.id);
                  return (
                    <button
                      type="button"
                      key={product.id}
                      className={styles.pcard}
                      onClick={() => handleSelectProduct(product)}
                    >
                      <div className={styles.ph} style={{ background: `linear-gradient(140deg, ${c1}, ${c2})` }}>
                        <span className={`${styles.tag} ${styles.tagPrice} gg-num`}>
                          $ {formatMoney(product.price)}
                        </span>
                        <span
                          className={`${styles.tag} ${styles.tagStock} ${product.stock <= 0 ? styles.isOut : ""} gg-num`}
                        >
                          {product.stock} {product.productUnit}
                        </span>
                        <Sparkles />
                      </div>
                      <div className={styles.pbody}>
                        <div className={styles.pname}>{product.name}</div>
                        <div className={styles.pcode}>{product.code}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

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

      {isHeldOrdersModalOpen && (
        <HeldOrdersModal
          heldOrders={heldOrders}
          onResume={handleResumeHeldOrder}
          onDiscard={handleDiscardHeldOrder}
          onClose={() => setIsHeldOrdersModalOpen(false)}
        />
      )}
    </div>
  );
}
