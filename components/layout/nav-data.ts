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

export type IconType = ComponentType<{ className?: string }>;

export type NavLink = {
  type: "link";
  label: string;
  href: string;
  icon: IconType;
};

export type NavGroup = {
  type: "group";
  label: string;
  icon: IconType;
  children: { label: string; href: string }[];
};

export type NavEntry = NavLink | NavGroup;

export const NAV: NavEntry[] = [
  { type: "link", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    type: "group",
    label: "Products",
    icon: Boxes,
    children: [
      { label: "Products", href: "/products" },
      { label: "Product Categories", href: "/products/categories" },
      { label: "Brands", href: "/products/brands" },
      { label: "Units", href: "/products/units" },
      { label: "Base Units", href: "/products/base-units" },
      { label: "Print Barcode", href: "/products/print-barcode" },
    ],
  },
  { type: "link", label: "Adjustments", href: "/adjustments", icon: SlidersHorizontal },
  { type: "link", label: "Quotations", href: "/quotations", icon: FileText },
  {
    type: "group",
    label: "Purchases",
    icon: Receipt,
    children: [
      { label: "Purchases", href: "/purchases" },
      { label: "Purchases Returns", href: "/purchases/returns" },
    ],
  },
  {
    type: "group",
    label: "Sales",
    icon: ShoppingCart,
    children: [
      { label: "Sales", href: "/sales" },
      { label: "Sales Returns", href: "/sales/returns" },
    ],
  },
  { type: "link", label: "Transfers", href: "/transfers", icon: Repeat },
  {
    type: "group",
    label: "Expenses",
    icon: Wallet,
    children: [
      { label: "Expenses", href: "/expenses" },
      { label: "Expense Categories", href: "/expenses/categories" },
    ],
  },
  {
    type: "group",
    label: "Peoples",
    icon: Users,
    children: [
      { label: "Customers", href: "/customers" },
      { label: "Suppliers", href: "/peoples/suppliers" },
      { label: "Users", href: "/users" },
    ],
  },
  { type: "link", label: "Roles/Permissions", href: "/roles", icon: ShieldCheck },
  { type: "link", label: "Warehouse", href: "/warehouse", icon: Warehouse },
  { type: "link", label: "Reports", href: "/reports", icon: BarChart3 },
  { type: "link", label: "Currencies", href: "/currencies", icon: DollarSign },
  { type: "link", label: "Languages", href: "/languages", icon: Languages },
  {
    type: "group",
    label: "Templates",
    icon: LayoutTemplate,
    children: [
      { label: "SMS Templates", href: "/templates/sms" },
      { label: "Email Templates", href: "/templates/email" },
    ],
  },
  { type: "link", label: "Settings", href: "/settings", icon: Settings },
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
