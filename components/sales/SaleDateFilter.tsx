"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import styles from "@/app/(dashboard)/sales/sales.module.css";

export default function SaleDateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = searchParams.get("date") ?? "";

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams);
    if (next) {
      params.set("date", next);
    } else {
      params.delete("date");
    }
    params.delete("page");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className={styles["date-field"]} style={{ width: 260 }}>
      <input
        type="date"
        className={`gg-input gg-num ${styles.input}`}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        aria-label="Filter by date"
      />
      <Calendar />
    </div>
  );
}
