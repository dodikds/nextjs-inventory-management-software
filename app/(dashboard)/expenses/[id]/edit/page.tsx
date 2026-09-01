import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { hasPermission } from "@/lib/permissions";
import { toDateInputValue } from "@/lib/format";
import ExpenseForm from "@/components/expenses/ExpenseForm";
import { getExpenseById, getWarehouseOptions, getExpenseCategoryOptions } from "../../queries";
import { updateExpense } from "../../actions";

type EditExpensePageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const session = await auth();
  if (!hasPermission(session, "manage_expenses")) {
    redirect("/expenses");
  }

  const { id } = await params;
  const expense = await getExpenseById(id);
  if (!expense) {
    notFound();
  }

  const [warehouses, expenseCategories] = await Promise.all([getWarehouseOptions(), getExpenseCategoryOptions()]);

  return (
    <>
      <div className="page-head">
        <h1 className="gg-page-title">Edit Expense</h1>
        <Link href="/expenses" className="gg-btn gg-btn--secondary">
          <ArrowLeft /> Back
        </Link>
      </div>

      <ExpenseForm
        warehouses={warehouses}
        expenseCategories={expenseCategories}
        initial={{
          date: toDateInputValue(expense.date),
          title: expense.title,
          warehouseId: expense.warehouseId,
          expenseCategoryId: expense.expenseCategoryId,
          amount: expense.amount.toString(),
          details: expense.details ?? "",
        }}
        action={updateExpense.bind(null, id)}
      />
    </>
  );
}
