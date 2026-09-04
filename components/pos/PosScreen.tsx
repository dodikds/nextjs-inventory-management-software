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
} from "lucide-react";
import toast from "react-hot-toast";
import { formatMoney } from "@/lib/format";
import { getPosProducts, type PosProduct } from "@/app/(pos)/pos/actions";
import styles from "./PosScreen.module.css";

type OptionItem = { id: string; name: string };
type CustomerOption = { id: string; name: string; isDefault: boolean };

type PosScreenProps = {
  warehouses: OptionItem[];
  customers: CustomerOption[];
  categories: OptionItem[];
  brands: OptionItem[];
};

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

export default function PosScreen({ warehouses, customers, categories, brands }: PosScreenProps) {
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
    setWarehouseId(id);
    setIsWarehouseMenuOpen(false);
    // Same reasoning as SaleForm's own handleWarehouseChange — stock and the
    // product grid are scoped to one warehouse, so filters are wiped rather
    // than carrying stale results over.
    setSearchQuery("");
    setCategoryId(null);
    setBrandId(null);
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

  function handleSelectProduct(product: PosProduct) {
    // Cart state lands in Step 2 — this just confirms the grid is wired.
    toast(`Would add "${product.name}" to the cart (Step 2)`);
  }

  const selectedWarehouse = warehouses.find((warehouse) => warehouse.id === warehouseId) ?? null;
  const selectedCustomer = customers.find((customer) => customer.id === customerId) ?? null;

  const query = searchQuery.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    if (categoryId && product.categoryId !== categoryId) return false;
    if (brandId && product.brandId !== brandId) return false;
    if (query && !product.name.toLowerCase().includes(query) && !product.code.toLowerCase().includes(query)) {
      return false;
    }
    return true;
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
            {/* Cart state (rows, totals, Hold/Reset/Pay Now) lands in Step 2. */}
            <div className={styles.cartEmpty}>
              <ShoppingCart />
              <span>Cart is empty — tap a product to add it here.</span>
            </div>
          </div>

          <div className={styles.cartFoot}>
            <div className={styles.footGrid}>
              <div className={styles.footFields}>
                <div className={styles.footInput}>
                  <input placeholder="Tax" value="0.00" disabled readOnly />
                  <span className={styles.suf}>%</span>
                </div>
                <div className={styles.footInput}>
                  <input placeholder="Discount" value="0.00" disabled readOnly />
                  <span className={styles.suf}>$</span>
                </div>
                <div className={styles.footInput}>
                  <input placeholder="Shipping" value="0.00" disabled readOnly />
                  <span className={styles.suf}>$</span>
                </div>
              </div>
              <div className={styles.totals}>
                <div className={`${styles.tq} gg-num`}>
                  Total QTY : <span>0</span>
                </div>
                <div className={`${styles.st} gg-num`}>
                  Sub Total : $ <span>{formatMoney(0)}</span>
                </div>
                <div className={`${styles.gt} gg-num`}>
                  Total : <b>$ {formatMoney(0)}</b>
                </div>
              </div>
            </div>
            <div className={styles.cartActions}>
              <button type="button" className={`${styles.posBtn} ${styles.btnHold}`} disabled>
                Hold <Hand />
              </button>
              <button type="button" className={`${styles.posBtn} ${styles.btnReset}`} disabled>
                Reset <RotateCw />
              </button>
              <button type="button" className={`${styles.posBtn} ${styles.btnPay}`} disabled>
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
              onClick={() => stub("Held orders")}
            >
              <List />
              <span className={`${styles.badge} gg-num`}>0</span>
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
    </div>
  );
}
