import Spinner from "@/components/layout/Spinner";
import styles from "./loading.module.css";

export default function DashboardLoading() {
  return (
    <div className={styles.loadingWrap}>
      <Spinner size={56} />
    </div>
  );
}
