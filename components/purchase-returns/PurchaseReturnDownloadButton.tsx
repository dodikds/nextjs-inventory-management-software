"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown } from "lucide-react";

// Same browser-print-to-PDF approach as PurchaseDownloadButton — no PDF
// library, relies on the @media print rules in app/gildedglow.css.
//
// Auto-triggers when navigated to with ?download=1 (see
// PurchaseReturnRowActions' "Download PDF" menu item).
export default function PurchaseReturnDownloadButton() {
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("download") === "1") {
      window.print();
    }
    // Only ever meant to fire once, off the URL this page loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <button className="gg-btn gg-btn--secondary no-print" type="button" onClick={() => window.print()}>
      <FileDown /> Download PDF
    </button>
  );
}
