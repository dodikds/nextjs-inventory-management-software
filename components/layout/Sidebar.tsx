"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ChevronRight } from "lucide-react";
import { NAV } from "./nav-data";

export default function Sidebar() {
  const pathname = usePathname();

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const entry of NAV) {
      if (entry.type === "group" && entry.children.some((c) => pathname.startsWith(c.href))) {
        initial.add(entry.label);
      }
    }
    return initial;
  });

  function toggleGroup(label: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  return (
    <aside className="gg-sidebar">
      <div className="gg-brand">
        <div className="gg-brand-mark">G</div>
        <span className="gg-brand-name">GildedGlow</span>
      </div>
      <div className="gg-sidebar-search">
        <div className="gg-input-icon">
          <Search />
          <input className="gg-input" type="text" placeholder="Search" />
        </div>
      </div>
      <nav className="gg-nav">
        {NAV.map((entry) => {
          if (entry.type === "link") {
            const isActive = pathname === entry.href;
            const Icon = entry.icon;
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={`gg-nav-item${isActive ? " is-active" : ""}`}
              >
                <Icon className="gg-nav-ico" />
                <span className="gg-nav-label">{entry.label}</span>
              </Link>
            );
          }

          const isOpen = openGroups.has(entry.label);
          const Icon = entry.icon;
          return (
            <div key={entry.label} className={`gg-nav-group${isOpen ? " is-open" : ""}`}>
              <div className="gg-nav-item" onClick={() => toggleGroup(entry.label)}>
                <Icon className="gg-nav-ico" />
                <span className="gg-nav-label">{entry.label}</span>
                <ChevronRight className="gg-nav-chev" />
              </div>
              <div className="gg-nav-sub">
                {entry.children.map((child) => {
                  const isActive = pathname === child.href;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`gg-nav-item${isActive ? " is-active" : ""}`}
                    >
                      <span className="gg-nav-label">{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
