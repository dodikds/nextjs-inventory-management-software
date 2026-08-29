"use client";

import { Filter } from "lucide-react";
import toast from "react-hot-toast";

// design/Sales.html's gold filter icon has no wired behavior of its own in
// the mockup — the actual filtering here is the date field next to it.
// Kept as a visible placeholder, same as PurchaseFilterButton.
export default function SaleFilterButton() {
  return (
    <button
      className="gg-icon-btn"
      type="button"
      style={{ background: "var(--gold-600)", color: "#fff", borderColor: "var(--gold-600)" }}
      onClick={() => toast("Advanced filtering isn't available yet — use search or the date field")}
    >
      <Filter />
    </button>
  );
}
