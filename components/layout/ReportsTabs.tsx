"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

const TABS = [
  { label: "Warehouse Reports", href: "/reports/warehouse" },
  { label: "Sale Reports", href: "/reports/sale" },
  { label: "Stock Reports", href: "/reports/stock" },
  { label: "Purchase Reports", href: "/reports/purchase" },
];

// "Top Selling Products Reports" and "More" are in design/*.html's tab bar
// but no report behind either is in this task's scope yet — rendered as
// inert labels (matching the mockup's own unwired `href="#"`) rather than
// links to routes that don't exist.
export default function ReportsTabs() {
  const pathname = usePathname();

  return (
    <nav className="rpt-tabs">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`rpt-tab${pathname.startsWith(tab.href) ? " is-active" : ""}`}
        >
          {tab.label}
        </Link>
      ))}
      <span className="rpt-tab">Top Selling Products Reports</span>
      <span className="rpt-tab rpt-more">
        More <ChevronDown style={{ width: 15, height: 15 }} />
      </span>
    </nav>
  );
}
