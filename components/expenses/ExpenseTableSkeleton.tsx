import styles from "@/app/(dashboard)/expenses/expenses.module.css";

const SKELETON_ROWS = 6;

export default function ExpenseTableSkeleton() {
  return (
    <div className="gg-table-wrap">
      <table className="gg-table">
        <thead>
          <tr>
            <th>Reference</th>
            <th>Expense Title</th>
            <th>Warehouse</th>
            <th>Expense Category</th>
            <th>Amount</th>
            <th>Created On</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <tr key={i}>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "60px" }} />
              </td>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "70%" }} />
              </td>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "50%" }} />
              </td>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "60%" }} />
              </td>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "50%" }} />
              </td>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "70px" }} />
              </td>
              <td style={{ textAlign: "right" }}>
                <div className={styles["skeleton-bar"]} style={{ width: "72px", marginLeft: "auto" }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
