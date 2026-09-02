import {
  ShoppingCart,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  Banknote,
  CircleMinus,
  Menu,
} from "lucide-react";
import WeekSalesChart from "@/components/dashboard/WeekSalesChart";
import TopProductsChart from "@/components/dashboard/TopProductsChart";
import TopCustomersChart from "@/components/dashboard/TopCustomersChart";
import { formatMoney } from "@/lib/format";
import {
  getDashboardKpis,
  getWeekSalesAndPurchases,
  getTopSellingProductsThisYear,
  getTopSellingProductsThisMonth,
  getTopCustomersThisMonth,
  getRecentSales,
  getStockAlerts,
} from "./queries";
import { STATUS_BADGE, PAYMENT_STATUS_BADGE } from "../sales/badges";
import styles from "./dashboard.module.css";

export default async function DashboardPage() {
  const [kpis, weekData, topProductsYear, topProductsMonth, topCustomers, recentSales, stockAlerts] =
    await Promise.all([
      getDashboardKpis(),
      getWeekSalesAndPurchases(),
      getTopSellingProductsThisYear(),
      getTopSellingProductsThisMonth(),
      getTopCustomersThisMonth(),
      getRecentSales(),
      getStockAlerts(),
    ]);

  const KPIS = [
    { tone: "gold", icon: ShoppingCart, value: kpis.sales, label: "Sales" },
    { tone: "emerald", icon: ShoppingBag, value: kpis.purchases, label: "Purchases" },
    { tone: "blue", icon: ArrowRight, value: kpis.salesReturns, label: "Sales Returns" },
    { tone: "orange", icon: ArrowLeft, value: kpis.purchasesReturns, label: "Purchases Returns" },
    { tone: "violet", icon: DollarSign, value: kpis.todayTotalSales, label: "Today Total Sales" },
    { tone: "rose", icon: Banknote, value: kpis.todayTotalReceivedSales, label: "Today Total Received (Sales)" },
    { tone: "cyan", icon: ShoppingCart, value: kpis.todayTotalPurchases, label: "Today Total Purchases" },
    { tone: "red", icon: CircleMinus, value: kpis.todayTotalExpense, label: "Today Total Expense" },
  ] as const;

  return (
    <div className={styles["dash-section-gap"]}>
      <div className="gg-kpi-grid">
        {KPIS.map((kpi, i) => (
          <div key={i} className={`gg-kpi gg-kpi--${kpi.tone}`}>
            <div className="gg-kpi-ico">
              <kpi.icon />
            </div>
            <div className="gg-kpi-body">
              <span className="gg-kpi-value gg-num">$ {formatMoney(kpi.value)}</span>
              <span className="gg-kpi-label">{kpi.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles["dash-2col"]}>
        <div className={styles["dash-col"]}>
          <div className="gg-card">
            <div className="gg-card-head">
              <span className="gg-card-title">This Week Sales &amp; Purchases</span>
              <button className="gg-icon-btn" type="button" style={{ width: 34, height: 34 }}>
                <Menu style={{ width: 16, height: 16 }} />
              </button>
            </div>
            <div className="gg-card-pad">
              <div className={styles["chart-box"]} style={{ height: 300 }}>
                <WeekSalesChart
                  labels={weekData.map((d) => d.date)}
                  sales={weekData.map((d) => d.sales)}
                  purchases={weekData.map((d) => d.purchases)}
                />
              </div>
            </div>
          </div>

          <div className="gg-card">
            <div className="gg-card-head">
              <span className="gg-card-title">Top Selling Products ({topProductsMonth.label})</span>
            </div>
            <div className="gg-card-pad" style={{ paddingTop: 0 }}>
              <table className="gg-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th style={{ textAlign: "right" }}>Grand Total</th>
                  </tr>
                </thead>
                {topProductsMonth.products.length === 0 ? (
                  <tbody className={styles["empty-table-body"]} />
                ) : (
                  <tbody>
                    {topProductsMonth.products.map((p) => (
                      <tr key={p.productId}>
                        <td className="gg-td-strong">{p.name}</td>
                        <td className="gg-num">{p.quantity}</td>
                        <td className="gg-num" style={{ textAlign: "right" }}>
                          $ {formatMoney(p.grandTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )}
              </table>
            </div>
          </div>
        </div>

        <div className={styles["dash-col"]}>
          <div className="gg-card">
            <div className="gg-card-head">
              <span className="gg-card-title">Top Selling Products ({topProductsYear.label})</span>
            </div>
            <div className="gg-card-pad">
              <div className={styles["chart-box"]} style={{ height: 340 }}>
                <TopProductsChart
                  labels={topProductsYear.products.map((p) => p.name)}
                  values={topProductsYear.products.map((p) => p.grandTotal)}
                />
              </div>
            </div>
          </div>

          <div className="gg-card">
            <div className="gg-card-head">
              <span className="gg-card-title">Top 5 Customers ({topCustomers.label})</span>
            </div>
            <div className="gg-card-pad">
              <div className={styles["chart-box"]} style={{ height: 300 }}>
                <TopCustomersChart
                  labels={topCustomers.customers.map((c) => c.name)}
                  values={topCustomers.customers.map((c) => c.grandTotal)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="gg-card">
        <div className="gg-card-head">
          <span className="gg-card-title">Recent Sales</span>
        </div>
        <div className="gg-card-pad" style={{ paddingTop: 0 }}>
          <div className="gg-table-wrap">
            <table className="gg-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Grand Total</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              {recentSales.length === 0 ? (
                <tbody className={styles["empty-table-body"]} />
              ) : (
                <tbody>
                  {recentSales.map((sale) => {
                    const badge = STATUS_BADGE[sale.status];
                    const paymentBadge = PAYMENT_STATUS_BADGE[sale.paymentStatus];
                    return (
                      <tr key={sale.id}>
                        <td>
                          <span className="gg-chip-code">{sale.reference}</span>
                        </td>
                        <td>{sale.customerName}</td>
                        <td>{badge && <span className={`gg-badge ${badge.variant}`}>{badge.label}</span>}</td>
                        <td className="gg-num gg-td-strong">$ {formatMoney(sale.grandTotal)}</td>
                        <td className="gg-num">$ {formatMoney(sale.paid)}</td>
                        <td className="gg-num">$ {formatMoney(sale.due)}</td>
                        <td>
                          {paymentBadge && (
                            <span className={`gg-badge ${paymentBadge.variant}`}>{paymentBadge.label}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>

      <div className="gg-card">
        <div className="gg-card-head">
          <span className="gg-card-title">Stock Alert</span>
        </div>
        <div className="gg-card-pad" style={{ paddingTop: 0 }}>
          <div className="gg-table-wrap">
            <table className="gg-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Product</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th style={{ textAlign: "right" }}>Alert Quantity</th>
                </tr>
              </thead>
              {stockAlerts.length === 0 ? (
                <tbody className={styles["empty-table-body"]} />
              ) : (
                <tbody>
                  {stockAlerts.map((item) => (
                    <tr key={`${item.productId}:${item.warehouseId}`}>
                      <td className="gg-num">{item.code}</td>
                      <td className="gg-td-strong">{item.productName}</td>
                      <td>{item.warehouseName}</td>
                      <td>
                        <span className={`${styles["qty-pill"]} gg-num`}>{item.quantity}</span>{" "}
                        <span className="gg-chip-unit">{item.unit}</span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <span className={`${styles["alert-pill"]} gg-num`}>{item.alertQuantity}</span>{" "}
                        <span className="gg-chip-unit">{item.unit}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
