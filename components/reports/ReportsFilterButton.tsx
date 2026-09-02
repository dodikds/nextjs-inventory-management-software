"use client";

import { Filter } from "lucide-react";
import toast from "react-hot-toast";

// Every design/*Reports.html's gold filter icon has no wired behavior of
// its own in the mockup — the actual filtering here is the warehouse
// select, search box, and date field next to it. Kept as a visible
// placeholder, same as SaleFilterButton.
export default function ReportsFilterButton() {
  return (
    <button
      className="btn-icon-gold"
      type="button"
      onClick={() => toast("Advanced filtering isn't available yet — use search or the filters next to it")}
    >
      <Filter />
    </button>
  );
}
