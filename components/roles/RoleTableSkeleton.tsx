import styles from "@/app/(dashboard)/roles/roles.module.css";

const SKELETON_ROWS = 6;

export default function RoleTableSkeleton() {
  return (
    <div className="gg-table-wrap">
      <table className="gg-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Date</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <tr key={i}>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "60%" }} />
              </td>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "80px" }} />
              </td>
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
