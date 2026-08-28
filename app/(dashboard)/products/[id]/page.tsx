import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Boxes, Pencil } from "lucide-react";
import { formatDateTimeChip, formatMoney } from "@/lib/format";
import { getProductDetail } from "../queries";
import styles from "./product-view.module.css";

type ProductViewPageProps = {
  params: Promise<{ id: string }>;
};

const STOCK_STATUS_LABELS: Record<string, string> = {
  RECEIVED: "Received",
  PENDING: "Pending",
  ORDERED: "Ordered",
};

export default async function ProductViewPage({ params }: ProductViewPageProps) {
  const { id } = await params;
  const product = await getProductDetail(id);
  if (!product) {
    notFound();
  }

  const totalStock = product.stocks.reduce((sum, stock) => sum + stock.quantity, 0);
  const created = formatDateTimeChip(product.createdAt);
  const updated = formatDateTimeChip(product.updatedAt);

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Product Details</h1>
        <div className="gg-row gg-gap-3">
          <Link href={`/products/${product.id}/edit`} className="gg-btn gg-btn--secondary">
            <Pencil /> Edit
          </Link>
          <Link href="/products" className="gg-btn gg-btn--secondary">
            <ArrowLeft /> Back
          </Link>
        </div>
      </div>

      <div className="gg-card gg-card-pad">
        <div className="pd-title">
          Product Details : {product.code}
        </div>

        {product.images.length > 0 ? (
          <div className={styles.gallery}>
            {product.images.map((image) => (
              <div key={image.id} className={styles["gallery-item"]}>
                {/* eslint-disable-next-line @next/next/no-img-element -- locally uploaded product image, not an optimizable remote asset */}
                <img src={image.path} alt={product.name} />
              </div>
            ))}
          </div>
        ) : (
          <div className={styles["gallery-empty"]}>
            <Boxes />
          </div>
        )}

        <div className="info-grid">
          <div className="info-panel">
            <div className="band">Product Info</div>
            <div className="info-body">
              <div className="info-line">
                <span className="k">Name :</span>
                <span className="v">{product.name}</span>
              </div>
              <div className="info-line">
                <span className="k">Code :</span>
                <span className="v gg-num">{product.code}</span>
              </div>
              <div className="info-line">
                <span className="k">Category :</span>
                <span className="v">{product.category.name}</span>
              </div>
              <div className="info-line">
                <span className="k">Brand :</span>
                <span className="v">{product.brand.name}</span>
              </div>
              <div className="info-line">
                <span className="k">Unit :</span>
                <span className="v">{product.productUnit}</span>
              </div>
            </div>
          </div>

          <div className="info-panel">
            <div className="band">Pricing &amp; Tax</div>
            <div className="info-body">
              <div className="info-line">
                <span className="k">Price :</span>
                <span className="v gg-num">$ {formatMoney(product.price)}</span>
              </div>
              <div className="info-line">
                <span className="k">Tax Type :</span>
                <span className="v">{product.taxType === "EXCLUSIVE" ? "Exclusive" : "Inclusive"}</span>
              </div>
              <div className="info-line">
                <span className="k">Order Tax :</span>
                <span className="v gg-num">{product.orderTax != null ? `${formatMoney(product.orderTax)}%` : "—"}</span>
              </div>
              <div className="info-line">
                <span className="k">Stock Alert :</span>
                <span className="v gg-num">{product.stockAlert ?? "—"}</span>
              </div>
              <div className="info-line">
                <span className="k">Quantity Limitation :</span>
                <span className="v gg-num">{product.quantityLimitation ?? "—"}</span>
              </div>
            </div>
          </div>

          <div className="info-panel">
            <div className="band">Meta</div>
            <div className="info-body">
              <div className="info-line">
                <span className="k">Total In Stock :</span>
                <span className="v gg-num">{totalStock}</span>
              </div>
              <div className="info-line">
                <span className="k">Created On :</span>
                <span className="v gg-num">
                  {created.date} {created.time}
                </span>
              </div>
              <div className="info-line">
                <span className="k">Updated On :</span>
                <span className="v gg-num">
                  {updated.date} {updated.time}
                </span>
              </div>
            </div>
          </div>
        </div>

        {product.notes && (
          <>
            <div className="band" style={{ borderRadius: "var(--r-md)", marginBottom: "var(--sp-3)" }}>
              Notes
            </div>
            <p className="gg-muted" style={{ marginBottom: "var(--sp-8)" }}>
              {product.notes}
            </p>
          </>
        )}

        <div className="band" style={{ borderRadius: "var(--r-md)", marginBottom: "var(--sp-5)" }}>
          Stock by Warehouse
        </div>
        <div className="gg-table-wrap">
          <table className="gg-table">
            <thead>
              <tr>
                <th>Warehouse</th>
                <th>Supplier</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {product.stocks.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <div className="gg-muted" style={{ padding: "var(--sp-6) 0", textAlign: "center" }}>
                      No stock recorded yet.
                    </div>
                  </td>
                </tr>
              ) : (
                product.stocks.map((stock) => (
                  <tr key={stock.id}>
                    <td className="gg-td-strong">{stock.warehouse.name}</td>
                    <td>{stock.supplier?.name ?? "—"}</td>
                    <td>
                      <span className="gg-chip-unit">{STOCK_STATUS_LABELS[stock.status] ?? stock.status}</span>
                    </td>
                    <td className="gg-num" style={{ textAlign: "right" }}>
                      {stock.quantity}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {product.stocks.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="gg-num" style={{ textAlign: "right" }}>
                    {totalStock}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
}
