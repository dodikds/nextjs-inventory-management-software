import type { ReactNode } from "react";
import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import Footer from "@/components/layout/Footer";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <Sidebar />
      <div className="gg-main">
        <Topbar />
        <main className="gg-content">{children}</main>
        <Footer />
      </div>
    </AppShell>
  );
}
