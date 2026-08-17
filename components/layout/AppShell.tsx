"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type SidebarContextValue = {
  collapsed: boolean;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebarCollapse() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebarCollapse must be used within AppShell");
  }
  return ctx;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggleCollapsed: () => setCollapsed((v) => !v) }}
    >
      <div className={`gg-app${collapsed ? " is-collapsed" : ""}`}>
        {children}
      </div>
    </SidebarContext.Provider>
  );
}
