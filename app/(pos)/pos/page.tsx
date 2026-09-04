import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { getWarehouseOptions, getCustomerOptions, getUnitOptions } from "@/app/(dashboard)/sales/queries";
import { getCategoryOptions, getBrandOptions } from "@/app/(dashboard)/products/queries";
import PosScreen from "@/components/pos/PosScreen";

// Deliberately outside the (dashboard) route group / AppShell — POS is a
// fullscreen, no-sidebar, no-scroll screen (design/POS.html's body has
// `overflow: hidden`), unlike every other module's page inside the
// dashboard chrome.
export default async function PosPage() {
  const session = await auth();
  if (!hasPermission(session, "manage_pos_screen")) {
    redirect("/dashboard");
  }

  const [warehouses, customers, categories, brands, units] = await Promise.all([
    getWarehouseOptions(),
    getCustomerOptions(),
    getCategoryOptions(),
    getBrandOptions(),
    getUnitOptions(),
  ]);

  return (
    <PosScreen
      warehouses={warehouses}
      customers={customers}
      categories={categories}
      brands={brands}
      units={units}
    />
  );
}
