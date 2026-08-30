import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Smartphone, Warehouse as WarehouseIcon } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/pricing";
import { formatMoney, formatDateTimeChip } from "@/lib/format";
import { getTransferById } from "../queries";
import styles from "./transfer-details.module.css";

type TransferViewPageProps = {
  params: Promise<{ id: string }>;
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  COMPLETED: "Completed",
};

export default async function TransferViewPage({ params }: TransferViewPageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_transfers")) {
    redirect("/transfers");
  }

  const { id } = await params;
  const transfer = await getTransferById(id);
  if (!transfer) {
    notFound();
  }

  const itemTotals = transfer.items.map((item) =>
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
    orderTaxRate: transfer.orderTax.toString(),
    discount: transfer.discount.toString(),
    shipping: transfer.shipping.toString(),
  });

  const date = formatDateTimeChip(transfer.date);
  const created = formatDateTimeChip(transfer.createdAt);

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Transfer Details</h1>
        <Link href="/transfers" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <div className="gg-card gg-card-pad">
        <div className="pd-title">Transfer Details : {transfer.reference}</div>

        {/* No supplier/customer/company panel — a transfer has neither (see
            AGENTS.md's "No payment, supplier, or customer on a transfer").
            The two warehouses take that spot instead, matching Purchase
            Details.html's own 3-panel info-grid shape. */}
        <div className="info-grid">
          <div className="info-panel">
            <div className="band">From Warehouse</div>
            <div className="info-body">
              <div className="info-row">
                <WarehouseIcon />
                <span>{transfer.fromWarehouse.name}</span>
              </div>
              <div className="info-row">
                <Mail />
                <span>{transfer.fromWarehouse.email}</span>
              </div>
              <div className="info-row">
                <Smartphone />
                <span className="gg-num">{transfer.fromWarehouse.phoneNumber}</span>
              </div>
              <div className="info-row">
                <MapPin />
                <span>
                  {transfer.fromWarehouse.city}, {transfer.fromWarehouse.country}
                </span>
              </div>
            </div>
          </div>
          <div className="info-panel">
            <div className="band">To Warehouse</div>
            <div className="info-body">
              <div className="info-row">
                <WarehouseIcon />
                <span>{transfer.toWarehouse.name}</span>
              </div>
              <div className="info-row">
                <Mail />
                <span>{transfer.toWarehouse.email}</span>
              </div>
              <div className="info-row">
                <Smartphone />
                <span className="gg-num">{transfer.toWarehouse.phoneNumber}</span>
              </div>
              <div className="info-row">
                <MapPin />
                <span>
                  {transfer.toWarehouse.city}, {transfer.toWarehouse.country}
                </span>
              </div>
            </div>
          </div>
          <div className="info-panel">
            <div className="band">Transfer Info</div>
            <div className="info-body">
              <div className="info-line">
                <span className="k">Reference :</span>
                <span className="v">{transfer.reference}</span>
              </div>
              <div className="info-line">
                <span className="k">Status :</span>
                <span className="v">{STATUS_LABEL[transfer.status] ?? transfer.status}</span>
              </div>
              <div className="info-line">
                <span className="k">Date :</span>
                <span className="v gg-num">{date.date}</span>
              </div>
              <div className="info-line">
                <span className="k">Items :</span>
                <span className="v gg-num">{transfer.items.length}</span>
              </div>
              <div className="info-line">
                <span className="k">Created On :</span>
                <span className="v gg-num">
                  {created.date} {created.time}
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
                <th>Net Unit Cost</th>
                <th>Quantity</th>
                <th>Unit Cost</th>
                <th>Discount</th>
                <th>Tax</th>
                <th style={{ textAlign: "right" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {transfer.items.map((item, index) => {
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
              $ {formatMoney(orderTotals.orderTaxAmount)} ({formatMoney(transfer.orderTax)}%)
            </span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Discount</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(transfer.discount)}</span>
          </div>
          <div className={styles["totals-row"]}>
            <span className={styles.lbl}>Shipping</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(transfer.shipping)}</span>
          </div>
          <div className={`${styles["totals-row"]} ${styles.grand}`}>
            <span className={styles.lbl}>Grand Total</span>
            <span className={`${styles.val} gg-num`}>$ {formatMoney(transfer.grandTotal)}</span>
          </div>
        </div>

        {transfer.notes && (
          <div style={{ marginTop: "var(--sp-6)" }}>
            <div className="band" style={{ borderRadius: "var(--r-md)", marginBottom: "var(--sp-3)" }}>
              Notes
            </div>
            <p className="gg-muted">{transfer.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
