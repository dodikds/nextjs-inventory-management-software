import ExpenseTableSkeleton from "@/components/expenses/ExpenseTableSkeleton";

export default function ExpensesLoading() {
  return (
    <>
      <div className="gg-table-toolbar">
        <div className="gg-input-icon" style={{ maxWidth: 460, width: "100%" }}>
          <input className="gg-input" placeholder="Search" disabled />
        </div>
        <div className="gg-spacer" />
      </div>
      <div className="gg-card gg-card-pad">
        <ExpenseTableSkeleton />
      </div>
    </>
  );
}
