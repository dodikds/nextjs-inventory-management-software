import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Smartphone, User } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import SaleReturnDownloadButton from "@/components/sale-returns/SaleReturnDownloadButton";
import { getSaleReturnById } from "../queries";
import styles from "./sale-return-details.module.css";

type SaleReturnViewPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  RECEIVED: "Received",
  COMPLETED: "Completed",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "gg-badge--warning",
  RECEIVED: "gg-badge--info",
  COMPLETED: "gg-badge--success",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  UNPAID: "Unpaid",
};

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PAID: "gg-badge--success",
  PARTIAL: "gg-badge--info",
  UNPAID: "gg-badge--warning",
};

// Same hardcoded Company Info panel as every other "Details" page in this
// app — no Settings/Company module exists yet.
const COMPANY_INFO = {
  name: "GildedGlow",
  email: "support@gildedglow.com",
  phone: "01708750611",
  address: "Sector: 10, Road: 06, Uttara, Dhaka, Bangladesh.",
};

export default async function SaleReturnViewPage({ params }: SaleReturnViewPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_sale_returns")) {
    redirect("/sales/returns");
  }

  const { id } = await params;
  const saleReturn = await getSaleReturnById(id);
  if (!saleReturn) {
    notFound();
  }

  const itemTotals = saleReturn.items.map((item) =>
    calculateLineTotals({
      unitCost: item.netUnitPrice.toString(),
      quantity: item.quantity,
      discountType: item.discountType,
      discount: item.discount.toString(),
      taxType: item.taxType,
      taxRate: item.orderTax.toString(),
    }),
  );
  const orderTotals = calculateOrderTotals({
    lineSubtotals: itemTotals.map((total) => total.subtotal),
    orderTaxRate: saleReturn.orderTax.toString(),
    discount: saleReturn.discount.toString(),
    shipping: saleReturn.shipping.toString(),
  });

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Sale Return Details</h1>
        <div className="gg-row gg-gap-3">
          <SaleReturnDownloadButton />
          <Link href="/sales/returns" className="gg-btn gg-btn--secondary no-print">
            <ArrowLeft /> Back
          </Link>
        </div>
      </div>

      <div className="gg-card gg-card-pad">
        <div className="pd-title">Sale Return Details : {saleReturn.reference}</div>

        <div className="info-grid">
          <div className="info-panel">
            <div className="band">Customer Info</div>
            <div className="info-body">
              <div className="info-row">
                <User />
                <span>{saleReturn.customer.name}</span>
              </div>
              <div className="info-row">
                <Mail />
                <span>{saleReturn.customer.email}</span>
              </div>
              <div className="info-row">
                <Smartphone />
                <span className="gg-num">{saleReturn.customer.phoneNumber}</span>
              </div>
              <div className="info-row">
                <MapPin />
                <span>
                  {saleReturn.customer.address}, {saleReturn.customer.city}, {saleReturn.customer.country}
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
            <div className="band">Return Info</div>
            <div className="info-body">
              <div className="info-line">
                <span className="k">Reference :</span>
                <span className="v">{saleReturn.reference}</span>
              </div>
              {saleReturn.sale && (
                <div className="info-line">
                  <span className="k">Sale Reference :</span>
                  <span className="v">{saleReturn.sale.reference}</span>
                </div>
              )}
              <div className="info-line" style={{ alignItems: "center" }}>
                <span className="k">Status :</span>
                <span className={`gg-badge ${STATUS_BADGE[saleReturn.status]}`}>
                  {STATUS_LABEL[saleReturn.status] ?? saleReturn.status}
                </span>
              </div>
              <div className="info-line">
                <span className="k">Warehouse :</span>
                <span className="v">{saleReturn.warehouse.name}</span>
              </div>
              <div className="info-line" style={{ alignItems: "center" }}>
                <span className="k">Refund Status :</span>
                <span className={`gg-badge ${PAYMENT_STATUS_BADGE[saleReturn.paymentStatus]}`}>
                  {PAYMENT_STATUS_LABEL[saleReturn.paymentStatus] ?? saleReturn.paymentStatus}
                </span>
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
                <th>Net Unit Price</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Tax</th>
                <th style={{ textAlign: "right" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {saleReturn.items.map((item, index) => {
                const { discountAmount, taxAmount, unitCostAfterAdjustments, subtotal } = itemTotals[index];
                return (
                  <tr key={item.id}>
                    <td className="gg-td-strong">
                      {item.product.code} ({item.product.name})
                    </td>
                    <td className="gg-num">$ {formatMoney(item.netUnitPrice)}</td>
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
              $ {formatMoney(orderTotals.orderTaxAmount)} ({formatMoney(saleReturn.orderTax)}%)
            </span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Discount</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(saleReturn.discount)}</span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Shipping</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(saleReturn.shipping)}</span>
          </div>
          <div className={`${styles["totals-row"]} ${styles.grand}`}>
            <span className={styles.lbl}>Grand Total</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(saleReturn.grandTotal)}</span>
          </div>
          {/* Not from a design mockup (none covers a Sale Return detail
              page) — a refund summary was explicitly asked for. `paid`/
              `due` here mean money owed BACK to the customer, the opposite
              direction of Sale's own Paid/Due, so the rows are labeled
              "Refunded"/"Refund Due" rather than reusing Sale's wording. */}
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Refunded</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(saleReturn.paid)}</span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Refund Due</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(saleReturn.due)}</span>
          </div>
        </div>

        {saleReturn.notes && (
          <div style={{ marginTop: "var(--sp-6)" }}>
            <div className="band" style={{ borderRadius: "var(--r-md)", marginBottom: "var(--sp-3)" }}>
              Notes
            </div>
            <p className="gg-muted">{saleReturn.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
