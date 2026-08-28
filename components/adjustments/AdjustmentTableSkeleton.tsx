import styles from "@/app/(dashboard)/adjustments/adjustments.module.css";

const SKELETON_ROWS = 6;
const SKELETON_COLS = 5;

export default function AdjustmentTableSkeleton() {
  return (
    <div className="gg-table-wrap">
      <table className="gg-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Warehouse</th>
            <th>Date</th>
            <th>Items</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <tr key={i}>
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
