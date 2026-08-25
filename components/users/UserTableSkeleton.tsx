import styles from "@/app/(dashboard)/users/users.module.css";

const SKELETON_ROWS = 6;

export default function UserTableSkeleton() {
  return (
    <div className="gg-table-wrap">
      <table className="gg-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Phone Number</th>
            <th>Created On</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <tr key={i}>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "60%", marginBottom: 6 }} />
                <div className={styles["skeleton-bar"]} style={{ width: "40%", height: 11 }} />
              </td>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "50%" }} />
              </td>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: "70%" }} />
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
