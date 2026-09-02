"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, ChevronRight } from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { NAV, type NavEntry } from "./nav-data";

// A link is "active" on its own page and any of its sub-routes (e.g.
// "/reports" while on "/reports/warehouse") — plain equality alone would
// never highlight a module whose content all lives under sub-routes, which
// is exactly Reports' shape (see app/(dashboard)/reports).
function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Hides nav entries the signed-in user lacks permission for — UX only. The
// real enforcement is each page/action's own server-side hasPermission()
// check; a hidden link here is never what stops unauthorized access.
function visibleNav(session: ReturnType<typeof useSession>["data"]): NavEntry[] {
  const entries: NavEntry[] = [];
  for (const entry of NAV) {
    if (entry.type === "link") {
      if (!entry.permission || hasPermission(session ?? null, entry.permission)) {
        entries.push(entry);
      }
      continue;
    }

    const children = entry.children.filter(
      (child) => !child.permission || hasPermission(session ?? null, child.permission),
    );
    if (children.length > 0) {
      entries.push({ ...entry, children });
    }
  }
  return entries;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const nav = visibleNav(session);

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
        {nav.map((entry) => {
          if (entry.type === "link") {
            const isActive = isNavActive(pathname, entry.href);
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
                  const isActive = isNavActive(pathname, child.href);
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
