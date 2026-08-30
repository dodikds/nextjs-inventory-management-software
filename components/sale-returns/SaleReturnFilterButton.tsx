"use client";

import { Filter } from "lucide-react";
import toast from "react-hot-toast";

// design/Sales Returns.html's gold filter icon has no wired behavior of its
// own in the mockup — the actual filtering here is the date field next to
// it. Kept as a visible placeholder, same as every other module's filter
// button.
export default function SaleReturnFilterButton() {
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
