// Single source of truth for every permission in the app. The Role form's
// checkbox grid, the seed script, and every module's hasPermission()/can()
// check all import from here — never retype a permission string elsewhere.
// Order matches design/Create Role.html's `perms` array so the checkbox
// grid renders in the same layout as the design.
export const PERMISSIONS = [
  { key: "manage_adjustments", label: "Manage Adjustments" },
  { key: "manage_transfers", label: "Manage Transfers" },
  { key: "manage_roles", label: "Manage Roles" },
  { key: "manage_brands", label: "Manage Brands" },
  { key: "manage_currency", label: "Manage Currency" },
  { key: "manage_warehouses", label: "Manage Warehouses" },
  { key: "manage_units", label: "Manage Units" },
  { key: "manage_product_categories", label: "Manage Product Categories" },
  { key: "manage_products", label: "Manage Products" },
  { key: "manage_suppliers", label: "Manage Suppliers" },
  { key: "manage_customers", label: "Manage Customers" },
  { key: "manage_users", label: "Manage Users" },
  { key: "manage_expense_categories", label: "Manage Expense Categories" },
  { key: "manage_expenses", label: "Manage Expenses" },
  { key: "manage_setting", label: "Manage Setting" },
  { key: "manage_dashboard", label: "Manage Dashboard" },
  { key: "manage_pos_screen", label: "Manage Pos Screen" },
  { key: "manage_purchases", label: "Manage Purchase" },
  { key: "manage_sales", label: "Manage Sale" },
  { key: "manage_purchase_returns", label: "Manage Purchase Return" },
  { key: "manage_sale_returns", label: "Manage Sale Return" },
  { key: "manage_email_templates", label: "Manage Email Templates" },
  { key: "manage_reports", label: "Manage Reports" },
  { key: "manage_quotations", label: "Manage Quotations" },
  { key: "manage_sms_templates", label: "Manage Sms Templates" },
  { key: "manage_sms_apis", label: "Manage Sms Apis" },
  { key: "manage_language", label: "Manage Language" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];

export const PERMISSION_KEYS: Permission[] = PERMISSIONS.map((p) => p.key);

const PERMISSION_KEY_SET: ReadonlySet<string> = new Set(PERMISSION_KEYS);

export function isPermission(value: string): value is Permission {
  return PERMISSION_KEY_SET.has(value);
}
