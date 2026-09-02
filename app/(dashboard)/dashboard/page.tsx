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
} from "./queries";
import styles from "./dashboard.module.css";

const RECENT_SALES = [
  { ref: "SA_11149", customer: "direct-customer", total: "71,800.00", paid: "71,800.00", due: "0.00" },
  { ref: "SA_11148", customer: "direct-customer", total: "31,920.00", paid: "31,920.00", due: "0.00" },
  { ref: "SA_11147", customer: "direct-customer", total: "7,980.00", paid: "7,980.00", due: "0.00" },
  { ref: "SA_11146", customer: "direct-customer", total: "11,970.00", paid: "11,970.00", due: "0.00" },
  { ref: "SA_11145", customer: "direct-customer", total: "7,980.00", paid: "7,980.00", due: "0.00" },
] as const;

const STOCK_ALERTS = [
  { code: "002", product: "ipl laser hair removal", warehouse: "Office", qty: "0" },
  { code: "001", product: "FACE FAT AND DOUBLE CHIN", warehouse: "Office", qty: "2" },
] as const;

export default async function DashboardPage() {
  const [kpis, weekData, topProductsYear, topProductsMonth, topCustomers] = await Promise.all([
    getDashboardKpis(),
    getWeekSalesAndPurchases(),
    getTopSellingProductsThisYear(),
    getTopSellingProductsThisMonth(),
    getTopCustomersThisMonth(),
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
              <tbody>
                {RECENT_SALES.map((sale) => (
                  <tr key={sale.ref}>
                    <td>
                      <span className="gg-chip-code">{sale.ref}</span>
                    </td>
                    <td>{sale.customer}</td>
                    <td>
                      <span className="gg-badge gg-badge--success">Received</span>
                    </td>
                    <td className="gg-num gg-td-strong">$ {sale.total}</td>
                    <td className="gg-num">$ {sale.paid}</td>
                    <td className="gg-num">$ {sale.due}</td>
                    <td>
                      <span className="gg-badge gg-badge--success">Paid</span>
                    </td>
                  </tr>
                ))}
              </tbody>
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
              <tbody>
                {STOCK_ALERTS.map((item) => (
                  <tr key={item.code}>
                    <td className="gg-num">{item.code}</td>
                    <td className="gg-td-strong">{item.product}</td>
                    <td>{item.warehouse}</td>
                    <td>
                      <span className={`${styles["qty-pill"]} gg-num`}>{item.qty}</span>{" "}
                      <span className="gg-chip-unit">piece</span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <span className={`${styles["alert-pill"]} gg-num`}>3</span>{" "}
                      <span className="gg-chip-unit">piece</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
