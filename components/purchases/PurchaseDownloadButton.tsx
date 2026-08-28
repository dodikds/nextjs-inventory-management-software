"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown } from "lucide-react";

// There's no PDF-generation library anywhere in this codebase yet, and
// adding a server-rendered-PDF pipeline is a lot of new infrastructure for
// one button. The browser's own print-to-PDF (triggered by window.print(),
// styled by the @media print rules in app/gildedglow.css) gets a real,
// working "Download PDF" with zero new dependencies — the print dialog's
// "Save as PDF" destination is standard in every major browser.
//
// Auto-triggers when navigated to with ?download=1 (see
// PurchaseRowActions' "Download PDF" menu item) so that's a genuine
// one-click action from the list, not just a link to this page.
export default function PurchaseDownloadButton() {
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
