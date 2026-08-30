import styles from "@/app/(dashboard)/transfers/transfers.module.css";

const SKELETON_ROWS = 6;
const SKELETON_COLS = 8;

export default function TransferTableSkeleton() {
  return (
    <div className="gg-table-wrap">
      <table className="gg-table">
        <thead>
          <tr>
            <th style={{ width: 44 }}>
              <input type="checkbox" className={styles["gg-check"]} disabled aria-hidden="true" />
            </th>
            <th>Reference</th>
            <th>From Warehouse</th>
            <th>To Warehouse</th>
            <th>Items</th>
            <th>Grand Total</th>
            <th>Status</th>
            <th>Created On</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <tr key={i}>
              <td>
                <input type="checkbox" className={styles["gg-check"]} disabled aria-hidden="true" />
              </td>
              {Array.from({ length: SKELETON_COLS - 1 }).map((__, j) => (
                <td key={j}>
                  <div className={styles["skeleton-bar"]} style={{ width: "70%" }} />
                </td>
              ))}
              <td style={{ textAlign: "right" }}>
                <div className={styles["skeleton-bar"]} style={{ width: "60px", marginLeft: "auto" }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
