import styles from "@/app/(dashboard)/products/products.module.css";

const SKELETON_ROWS = 6;
const SKELETON_COLS = 9;

export default function ProductTableSkeleton() {
  return (
    <div className="gg-table-wrap">
      <table className="gg-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Name</th>
            <th>Code</th>
            <th>Brand</th>
            <th>Price</th>
            <th>Product Unit</th>
            <th>In Stock</th>
            <th>Created On</th>
            <th style={{ textAlign: "right" }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <tr key={i}>
              <td>
                <div className={styles["skeleton-bar"]} style={{ width: 46, height: 46, borderRadius: "50%" }} />
              </td>
              {Array.from({ length: SKELETON_COLS - 2 }).map((__, j) => (
                <td key={j}>
                  <div className={styles["skeleton-bar"]} style={{ width: "70%" }} />
                </td>
              ))}
              <td style={{ textAlign: "right" }}>
                <div className={styles["skeleton-bar"]} style={{ width: "90px", marginLeft: "auto" }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
