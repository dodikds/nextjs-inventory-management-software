import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Boxes,
  SlidersHorizontal,
  FileText,
  Receipt,
  ShoppingCart,
  Repeat,
  Wallet,
  Users,
  ShieldCheck,
  Warehouse,
  BarChart3,
  DollarSign,
  Languages,
  LayoutTemplate,
  Settings,
} from "lucide-react";
import type { Permission } from "@/lib/permissions/constants";

export type IconType = ComponentType<{ className?: string }>;

// `permission` is UX only — hiding a nav entry a user can't use. It is never
// the real access control; every page/action behind it enforces its own
// hasPermission() check server-side regardless of what the sidebar shows.
export type NavLink = {
  type: "link";
  label: string;
  href: string;
  icon: IconType;
  permission?: Permission;
};

export type NavGroup = {
  type: "group";
  label: string;
  icon: IconType;
  children: { label: string; href: string; permission?: Permission }[];
};

export type NavEntry = NavLink | NavGroup;

export const NAV: NavEntry[] = [
  { type: "link", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "manage_dashboard" },
  {
    type: "group",
    label: "Products",
    icon: Boxes,
    children: [
      { label: "Products", href: "/products", permission: "manage_products" },
      { label: "Product Categories", href: "/product-categories", permission: "manage_product_categories" },
      { label: "Brands", href: "/brands", permission: "manage_brands" },
      { label: "Units", href: "/products/units", permission: "manage_units" },
      // No dedicated permission for these two — Base Units shares Units'
      // permission, Print Barcode shares Products' (it's a product utility).
      { label: "Base Units", href: "/products/base-units", permission: "manage_units" },
      { label: "Print Barcode", href: "/products/print-barcode", permission: "manage_products" },
    ],
  },
  { type: "link", label: "Adjustments", href: "/adjustments", icon: SlidersHorizontal, permission: "manage_adjustments" },
  { type: "link", label: "Quotations", href: "/quotations", icon: FileText, permission: "manage_quotations" },
  {
    type: "group",
    label: "Purchases",
    icon: Receipt,
    children: [
      { label: "Purchases", href: "/purchases", permission: "manage_purchases" },
      { label: "Purchases Returns", href: "/purchases/returns", permission: "manage_purchase_returns" },
    ],
  },
  {
    type: "group",
    label: "Sales",
    icon: ShoppingCart,
    children: [
      { label: "Sales", href: "/sales", permission: "manage_sales" },
      { label: "Sales Returns", href: "/sales/returns", permission: "manage_sale_returns" },
    ],
  },
  { type: "link", label: "Transfers", href: "/transfers", icon: Repeat, permission: "manage_transfers" },
  {
    type: "group",
    label: "Expenses",
    icon: Wallet,
    children: [
      { label: "Expenses", href: "/expenses", permission: "manage_expenses" },
      { label: "Expense Categories", href: "/expense-categories", permission: "manage_expense_categories" },
    ],
  },
  {
    type: "group",
    label: "Peoples",
    icon: Users,
    children: [
      { label: "Customers", href: "/customers", permission: "manage_customers" },
      { label: "Suppliers", href: "/peoples/suppliers", permission: "manage_suppliers" },
      { label: "Users", href: "/users", permission: "manage_users" },
    ],
  },
  { type: "link", label: "Roles/Permissions", href: "/roles", icon: ShieldCheck, permission: "manage_roles" },
  { type: "link", label: "Warehouse", href: "/warehouse", icon: Warehouse, permission: "manage_warehouses" },
  { type: "link", label: "Reports", href: "/reports", icon: BarChart3, permission: "manage_reports" },
  { type: "link", label: "Currencies", href: "/currencies", icon: DollarSign, permission: "manage_currency" },
  { type: "link", label: "Languages", href: "/languages", icon: Languages, permission: "manage_language" },
  {
    type: "group",
    label: "Templates",
    icon: LayoutTemplate,
    children: [
      { label: "SMS Templates", href: "/templates/sms", permission: "manage_sms_templates" },
      { label: "Email Templates", href: "/templates/email", permission: "manage_email_templates" },
    ],
  },
  { type: "link", label: "Settings", href: "/settings", icon: Settings, permission: "manage_setting" },
];

export function getPageTitle(pathname: string): string {
  for (const entry of NAV) {
    if (entry.type === "link" && entry.href === pathname) {
      return entry.label;
    }
    if (entry.type === "group") {
      const child = entry.children.find((c) => c.href === pathname);
      if (child) return child.label;
    }
  }
  return "Dashboard";
}
