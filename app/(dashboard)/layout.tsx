import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import AppShell from "@/components/layout/AppShell";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import Footer from "@/components/layout/Footer";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session) {
    redirect("/");
  }

  return (
    <SessionProvider session={session}>
      <AppShell>
        <Sidebar />
        <div className="gg-main">
          <Topbar />
          <main className="gg-content">{children}</main>
          <Footer />
        </div>
      </AppShell>
    </SessionProvider>
  );
}
