import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import ExpenseForm from "@/components/expenses/ExpenseForm";
import { getWarehouseOptions, getExpenseCategoryOptions } from "../queries";
import { createExpense } from "../actions";

export default async function CreateExpensePage() {
  const session = await auth();
  if (!hasPermission(session, "manage_expenses")) {
    redirect("/expenses");
  }

  const [warehouses, expenseCategories] = await Promise.all([getWarehouseOptions(), getExpenseCategoryOptions()]);

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Create Expense</h1>
        <Link href="/expenses" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <ExpenseForm warehouses={warehouses} expenseCategories={expenseCategories} action={createExpense} />
    </>
  );
}
