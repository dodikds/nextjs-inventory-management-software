import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Smartphone, User } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import PurchaseReturnDownloadButton from "@/components/purchase-returns/PurchaseReturnDownloadButton";
import { getPurchaseReturnById } from "../queries";
import styles from "./purchase-return-details.module.css";

type PurchaseReturnViewPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "Received",
  PENDING: "Pending",
  ORDERED: "Ordered",
};

// Same hardcoded Company Info panel as ../../[id]/page.tsx — no
// Settings/Company module exists yet in this app, see that page's own
// comment.
const COMPANY_INFO = {
  name: "GildedGlow",
  email: "support@gildedglow.com",
  phone: "01708750611",
  address: "Sector: 10, Road: 06, Uttara, Dhaka, Bangladesh.",
};

export default async function PurchaseReturnViewPage({ params }: PurchaseReturnViewPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_purchase_returns")) {
    redirect("/purchases/returns");
  }

  const { id } = await params;
  const purchaseReturn = await getPurchaseReturnById(id);
  if (!purchaseReturn) {
    notFound();
  }

  const itemTotals = purchaseReturn.items.map((item) =>
    calculateLineTotals({
      unitCost: item.netUnitCost.toString(),
      quantity: item.quantity,
      discountType: item.discountType,
      discount: item.discount.toString(),
      taxType: item.taxType,
      taxRate: item.orderTax.toString(),
    }),
  );
  const orderTotals = calculateOrderTotals({
    lineSubtotals: itemTotals.map((total) => total.subtotal),
    orderTaxRate: purchaseReturn.orderTax.toString(),
    discount: purchaseReturn.discount.toString(),
    shipping: purchaseReturn.shipping.toString(),
  });

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Purchase Return Details</h1>
        <div className="gg-row gg-gap-3">
          <PurchaseReturnDownloadButton />
          <Link href="/purchases/returns" className="gg-btn gg-btn--secondary no-print">
            <ArrowLeft /> Back
          </Link>
        </div>
      </div>

      <div className="gg-card gg-card-pad">
        <div className="pd-title">Purchase Return Details : {purchaseReturn.reference}</div>

        <div className="info-grid">
          <div className="info-panel">
            <div className="band">Supplier Info</div>
            <div className="info-body">
              <div className="info-row">
                <User />
                <span>{purchaseReturn.supplier.name}</span>
              </div>
              <div className="info-row">
                <Mail />
                <span>{purchaseReturn.supplier.email}</span>
              </div>
              <div className="info-row">
                <Smartphone />
                <span className="gg-num">{purchaseReturn.supplier.phone}</span>
              </div>
              <div className="info-row">
                <MapPin />
                <span>
                  {purchaseReturn.supplier.address}, {purchaseReturn.supplier.city}, {purchaseReturn.supplier.country}
                </span>
              </div>
            </div>
          </div>
          <div className="info-panel">
            <div className="band">Company Info</div>
            <div className="info-body">
              <div className="info-row">
                <User />
                <span>{COMPANY_INFO.name}</span>
              </div>
              <div className="info-row">
                <Mail />
                <span>{COMPANY_INFO.email}</span>
              </div>
              <div className="info-row">
                <Smartphone />
                <span className="gg-num">{COMPANY_INFO.phone}</span>
              </div>
              <div className="info-row">
                <MapPin />
                <span>{COMPANY_INFO.address}</span>
              </div>
            </div>
          </div>
          <div className="info-panel">
            <div className="band">Purchase Return Info</div>
            <div className="info-body">
              <div className="info-line">
                <span className="k">Reference :</span>
                <span className="v">{purchaseReturn.reference}</span>
              </div>
              <div className="info-line">
                <span className="k">Status :</span>
                <span className="v">{STATUS_LABEL[purchaseReturn.status] ?? purchaseReturn.status}</span>
              </div>
              <div className="info-line">
                <span className="k">Warehouse :</span>
                <span className="v">{purchaseReturn.warehouse.name}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="band" style={{ borderRadius: "var(--r-md)", marginBottom: "var(--sp-5)" }}>
          Order Summary
        </div>
        <div className="gg-table-wrap">
          <table className="gg-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Net Unit Cost</th>
                <th>Quantity</th>
                <th>Unit Cost</th>
                <th>Discount</th>
                <th>Tax</th>
                <th style={{ textAlign: "right" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {purchaseReturn.items.map((item, index) => {
                const { discountAmount, taxAmount, unitCostAfterAdjustments, subtotal } = itemTotals[index];
                return (
                  <tr key={item.id}>
                    <td className="gg-td-strong">
                      {item.product.code} ({item.product.name})
                    </td>
                    <td className="gg-num">$ {formatMoney(item.netUnitCost)}</td>
                    <td className="gg-num">{item.quantity}</td>
                    <td className="gg-num">$ {formatMoney(unitCostAfterAdjustments)}</td>
                    <td className="gg-num">$ {formatMoney(discountAmount)}</td>
                    <td className="gg-num">$ {formatMoney(taxAmount)}</td>
                    <td className="gg-num gg-td-strong" style={{ textAlign: "right" }}>
                      $ {formatMoney(subtotal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles["totals-box"]}>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Order Tax</span>
            <span className={`${styles.val} gg-num`}>
              $ {formatMoney(orderTotals.orderTaxAmount)} ({formatMoney(purchaseReturn.orderTax)}%)
            </span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Discount</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(purchaseReturn.discount)}</span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Shipping</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(purchaseReturn.shipping)}</span>
          </div>
          <div className={`${styles["totals-row"]} ${styles.grand}`}>
            <span className={styles.lbl}>Grand Total</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(purchaseReturn.grandTotal)}</span>
          </div>
        </div>

        {purchaseReturn.notes && (
          <div style={{ marginTop: "var(--sp-6)" }}>
            <div className="band" style={{ borderRadius: "var(--r-md)", marginBottom: "var(--sp-3)" }}>
              Notes
            </div>
            <p className="gg-muted">{purchaseReturn.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
