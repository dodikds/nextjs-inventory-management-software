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
import styles from "./dashboard.module.css";

const KPIS = [
  { tone: "gold", icon: ShoppingCart, value: "$ 0.00", label: "Sales" },
  { tone: "emerald", icon: ShoppingBag, value: "$ 0.00", label: "Purchases" },
  { tone: "blue", icon: ArrowRight, value: "$ 0.00", label: "Sales Returns" },
  { tone: "orange", icon: ArrowLeft, value: "$ 0.00", label: "Purchases Returns" },
  { tone: "violet", icon: DollarSign, value: "$ 0.00", label: "Today Total Sales" },
  { tone: "rose", icon: Banknote, value: "$ 0.00", label: "Today Total Received (Sales)" },
  { tone: "cyan", icon: ShoppingCart, value: "$ 0.00", label: "Today Total Purchases" },
  { tone: "red", icon: CircleMinus, value: "$ 0.00", label: "Today Total Expense" },
] as const;

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

export default function DashboardPage() {
  return (
    <div className={styles["dash-section-gap"]}>
      <div className="gg-kpi-grid">
        {KPIS.map((kpi, i) => (
          <div key={i} className={`gg-kpi gg-kpi--${kpi.tone}`}>
            <div className="gg-kpi-ico">
              <kpi.icon />
            </div>
            <div className="gg-kpi-body">
              <span className="gg-kpi-value gg-num">{kpi.value}</span>
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
                <WeekSalesChart />
              </div>
            </div>
          </div>

          <div className="gg-card">
            <div className="gg-card-head">
              <span className="gg-card-title">Top Selling Products (May)</span>
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
                <tbody className={styles["empty-table-body"]} />
              </table>
            </div>
          </div>
        </div>

        <div className={styles["dash-col"]}>
          <div className="gg-card">
            <div className="gg-card-head">
              <span className="gg-card-title">Top Selling Products (2026)</span>
            </div>
            <div className="gg-card-pad">
              <div className={styles["chart-box"]} style={{ height: 340 }}>
                <TopProductsChart />
              </div>
            </div>
          </div>

          <div className="gg-card">
            <div className="gg-card-head">
              <span className="gg-card-title">Top 5 Customers (May)</span>
            </div>
            <div className="gg-card-pad">
              <div className={styles["chart-box"]} style={{ height: 300 }}>
                <TopCustomersChart />
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
