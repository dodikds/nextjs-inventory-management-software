import styles from "@/app/(dashboard)/brands/brands.module.css";

const SKELETON_ROWS = 6;

export default function BrandTableSkeleton() {
  return (
    <div className="gg-table-wrap">
      <table className="gg-table">
        <thead>
          <tr>
            <th>Brand</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <tr key={i}>
              <td>
                <div className="gg-row gg-gap-3">
                  <div className={styles["skeleton-bar"]} style={{ width: 42, height: 42, borderRadius: "50%" }} />
                  <div className={styles["skeleton-bar"]} style={{ width: "40%" }} />
                </div>
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
