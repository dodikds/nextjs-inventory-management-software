"use client";

import toast from "react-hot-toast";

// Placeholder until Step 6 wires up the real server-side .xlsx export —
// kept as its own component now so every report's toolbar already has the
// button in its final position and only this file changes later.
export default function ReportsExcelButton() {
  return (
    <button className="btn-excel" type="button" onClick={() => toast("Excel export isn't available yet")}>
      EXCEL
    </button>
  );
}
