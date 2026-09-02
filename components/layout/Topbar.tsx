"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Menu, Plus, Monitor, Grid2x2, ChevronDown, User, KeyRound, LogOut } from "lucide-react";
import { useSidebarCollapse } from "./AppShell";
import { getPageTitle } from "./nav-data";
import ReportsTabs from "./ReportsTabs";
import styles from "./Topbar.module.css";

export default function Topbar() {
  const pathname = usePathname();
  const { toggleCollapsed } = useSidebarCollapse();
  const title = getPageTitle(pathname);
  const isReportsRoute = pathname.startsWith("/reports");
  const { data: session } = useSession();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  function closeUserMenu() {
    setIsUserMenuOpen(false);
  }

  function handleLogout() {
    closeUserMenu();
    signOut({ callbackUrl: "/" });
  }

  const userName = session?.user?.name ?? "Account";
  const userInitial = userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="gg-topbar">
      <button className="gg-icon-btn" title="Toggle sidebar" onClick={toggleCollapsed}>
        <Menu />
      </button>
      <div className="gg-topbar-title">
        <span className="gg-page-chip">
          <Plus />
        </span>
        {!isReportsRoute && <span className="gg-breadcrumb">{title}</span>}
      </div>
      {isReportsRoute && <ReportsTabs />}
      <div className="gg-topbar-spacer" />
      <button className="gg-pos-btn">
        <Monitor style={{ width: 16, height: 16 }} /> POS
      </button>
      <button className="gg-icon-btn">
        <Grid2x2 />
      </button>
      <div className={styles["user-menu"]} ref={userMenuRef}>
        <div className="gg-user" onClick={() => setIsUserMenuOpen((open) => !open)}>
          <div className="gg-avatar">{userInitial}</div>
          <span style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{userName}</span>
          <ChevronDown style={{ width: 16, height: 16, color: "var(--gray-400)" }} />
        </div>
        {isUserMenuOpen && (
          <div className={`gg-menu ${styles["user-menu-dropdown"]}`}>
            <Link href="/profile" className="gg-menu-item" onClick={closeUserMenu}>
              <User /> Profile
            </Link>
            <Link href="/change-password" className="gg-menu-item" onClick={closeUserMenu}>
              <KeyRound /> Change Password
            </Link>
            <div className="gg-menu-item is-danger" onClick={handleLogout}>
              <LogOut /> Logout
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
