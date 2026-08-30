import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Smartphone, User } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { formatMoney } from "@/lib/format";
import SaleDownloadButton from "@/components/sales/SaleDownloadButton";
import { getSaleById } from "../queries";
import styles from "./sale-details.module.css";

type SaleViewPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABEL: Record<string, string> = {
  RECEIVED: "Received",
  PENDING: "Pending",
  ORDERED: "Ordered",
};

const STATUS_BADGE: Record<string, string> = {
  RECEIVED: "gg-badge--success",
  PENDING: "gg-badge--warning",
  ORDERED: "gg-badge--info",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  PAID: "Paid",
  PARTIAL: "Partial",
  UNPAID: "Unpaid",
};

const PAYMENT_STATUS_BADGE: Record<string, string> = {
  PAID: "gg-badge--success",
  PARTIAL: "gg-badge--warning",
  UNPAID: "gg-badge--danger",
};

// Same hardcoded Company Info panel as every other "Details" page in this
// app — no Settings/Company module exists yet.
const COMPANY_INFO = {
  name: "GildedGlow",
  email: "support@gildedglow.com",
  phone: "01708750611",
  address: "Sector: 10, Road: 06, Uttara, Dhaka, Bangladesh.",
};

export default async function SaleViewPage({ params }: SaleViewPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_sales")) {
    redirect("/sales");
  }

  const { id } = await params;
  const sale = await getSaleById(id);
  if (!sale) {
    notFound();
  }

  const itemTotals = sale.items.map((item) =>
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
    orderTaxRate: sale.orderTax.toString(),
    discount: sale.discount.toString(),
    shipping: sale.shipping.toString(),
  });

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Sale Details</h1>
        <div className="gg-row gg-gap-3">
          <SaleDownloadButton />
          <Link href="/sales" className="gg-btn gg-btn--secondary no-print">
            <ArrowLeft /> Back
          </Link>
        </div>
      </div>

      <div className="gg-card gg-card-pad">
        <div className="pd-title">Sale Details : {sale.reference}</div>

        <div className="info-grid">
          <div className="info-panel">
            <div className="band">Customer Info</div>
            <div className="info-body">
              <div className="info-row">
                <User />
                <span>{sale.customer.name}</span>
              </div>
              <div className="info-row">
                <Mail />
                <span>{sale.customer.email}</span>
              </div>
              <div className="info-row">
                <Smartphone />
                <span className="gg-num">{sale.customer.phoneNumber}</span>
              </div>
              <div className="info-row">
                <MapPin />
                <span>
                  {sale.customer.address}, {sale.customer.city}, {sale.customer.country}
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
            <div className="band">Invoice Info</div>
            <div className="info-body">
              <div className="info-line">
                <span className="k">Reference :</span>
                <span className="v">{sale.reference}</span>
              </div>
              <div className="info-line" style={{ alignItems: "center" }}>
                <span className="k">Status :</span>
                <span className={`gg-badge ${STATUS_BADGE[sale.status]}`}>{STATUS_LABEL[sale.status] ?? sale.status}</span>
              </div>
              <div className="info-line">
                <span className="k">Warehouse :</span>
                <span className="v">{sale.warehouse.name}</span>
              </div>
              <div className="info-line" style={{ alignItems: "center" }}>
                <span className="k">Payment Status :</span>
                <span className={`gg-badge ${PAYMENT_STATUS_BADGE[sale.paymentStatus]}`}>
                  {PAYMENT_STATUS_LABEL[sale.paymentStatus] ?? sale.paymentStatus}
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
              {sale.items.map((item, index) => {
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
              $ {formatMoney(orderTotals.orderTaxAmount)} ({formatMoney(sale.orderTax)}%)
            </span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Discount</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(sale.discount)}</span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Shipping</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(sale.shipping)}</span>
          </div>
          <div className={`${styles["totals-row"]} ${styles.grand}`}>
            <span className={styles.lbl}>Grand Total</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(sale.grandTotal)}</span>
          </div>
          {/* Not in design/Sale Details.html (which only shows a Payment
              Status badge above) — a payment summary was explicitly asked
              for, so Paid/Due are appended here rather than inventing a
              whole new box for two rows. */}
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Paid</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(sale.paid)}</span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Due</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(sale.due)}</span>
          </div>
        </div>

        {sale.notes && (
          <div style={{ marginTop: "var(--sp-6)" }}>
            <div className="band" style={{ borderRadius: "var(--r-md)", marginBottom: "var(--sp-3)" }}>
              Notes
            </div>
            <p className="gg-muted">{sale.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
