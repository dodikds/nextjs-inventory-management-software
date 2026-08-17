"use client";

import { usePathname } from "next/navigation";
import { Menu, Plus, Monitor, Grid2x2, ChevronDown } from "lucide-react";
import { useSidebarCollapse } from "./AppShell";
import { getPageTitle } from "./nav-data";

export default function Topbar() {
  const pathname = usePathname();
  const { toggleCollapsed } = useSidebarCollapse();
  const title = getPageTitle(pathname);

  return (
    <header className="gg-topbar">
      <button className="gg-icon-btn" title="Toggle sidebar" onClick={toggleCollapsed}>
        <Menu />
      </button>
      <div className="gg-topbar-title">
        <span className="gg-page-chip">
          <Plus />
        </span>
        <span className="gg-breadcrumb">{title}</span>
      </div>
      <div className="gg-topbar-spacer" />
      <button className="gg-pos-btn">
        <Monitor style={{ width: 16, height: 16 }} /> POS
      </button>
      <button className="gg-icon-btn">
        <Grid2x2 />
      </button>
      <div className="gg-user">
        <div className="gg-avatar">A</div>
        <span style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>admin</span>
        <ChevronDown style={{ width: 16, height: 16, color: "var(--gray-400)" }} />
      </div>
    </header>
  );
}
